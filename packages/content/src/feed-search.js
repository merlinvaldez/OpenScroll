import { composeDiversityFeed, canonicalClusterKey } from "./feed-composer.js";
import { resolveEntity, evaluateFeedCandidates } from "./topic-engine.js";
import { queryLiveConnectors, asyncPool } from "./source-connectors.js";
import { buildSearchPlans, expandSearchPlans } from "./search-planner.js";
import { createFeedMetrics, reportFeedMetrics } from "./feed-metrics.js";
import {
  CONTINUATION_TOKEN_PREFIX,
  createContinuationToken,
  createFeedContinuationState,
  getContinuationStore,
  parseContinuationToken,
  validateFeedRequest,
  ContinuationExpiredError,
  FeedRequestValidationError
} from "./feed-continuation.js";

export const FEED_MEDIA_TYPE_KINDS = Object.freeze({ images: "image", audio: "audio", video: "video", text: "text", data: "data" });
export const FEED_MEDIA_TYPE_SOURCES = Object.freeze({ images: ["wikimedia-commons"], audio: ["wikimedia-commons"], video: ["wikimedia-commons"], text: ["wikipedia"], data: ["wikimedia-commons"] });

export const DEFAULT_RETRIEVAL_BATCH_SIZE = 10;
export const DEFAULT_MAX_ROUNDS = 4;
export const DEFAULT_MAX_CANDIDATES = 40;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_TIME_BUDGET_MS = 3500;
const TEXT_CONTENT_TYPES = new Set(["article", "reader", "source-text", "dictionary", "travel-guide", "text"]);

function candidateMatchesMediaType(candidate, mediaType) {
  if (mediaType === "text") return candidate.media?.kind === "text" || TEXT_CONTENT_TYPES.has(candidate.content?.type);
  return candidate.media?.kind === FEED_MEDIA_TYPE_KINDS[mediaType];
}

function normalizeMediaTypes(value) {
  if (!Array.isArray(value)) return Object.keys(FEED_MEDIA_TYPE_KINDS);
  return Array.from(new Set(value.filter((mediaType) => Object.hasOwn(FEED_MEDIA_TYPE_KINDS, mediaType))));
}

function variantOffsetsFor(startOffsets, mediaType, variants) {
  const value = startOffsets?.[mediaType];
  const variantOffsets = value?.variants && typeof value.variants === "object" && !Array.isArray(value.variants)
    ? value.variants
    : {};
  const legacyOffset = Number.isInteger(value) && value >= 0 ? value : 0;

  return Object.fromEntries(variants.map((variant, index) => [
    variant.key,
    Number.isInteger(variantOffsets[variant.key]) && variantOffsets[variant.key] >= 0
      ? variantOffsets[variant.key]
      : index === 0 ? legacyOffset : 0
  ]));
}

function normalizeStartOffsets(startOffsets, plans) {
  return Object.fromEntries(Object.entries(plans).map(([mediaType, plan]) => [
    mediaType,
    { variants: variantOffsetsFor(startOffsets, mediaType, plan.variants) }
  ]));
}

function formatOffsets(upstreamContinuations, mediaTypes, searchPlan) {
  const result = {};
  for (const mediaType of mediaTypes) {
    result[mediaType] = { variants: {} };
    const variants = searchPlan?.variants?.[mediaType] || [];
    for (const variant of variants) {
      const pairKey = `${mediaType}:${variant.key}`;
      result[mediaType].variants[variant.key] = upstreamContinuations?.[pairKey]?.offset ?? 0;
    }
  }
  return result;
}

function providedSearchPlans(searchPlan, mediaTypes) {
  if (!searchPlan?.variants || typeof searchPlan.variants !== "object") return null;

  const plans = Object.fromEntries((Array.isArray(mediaTypes) ? mediaTypes : []).map((mediaType) => {
    const variants = searchPlan.variants[mediaType];
    if (!Array.isArray(variants) || !variants.length) return [mediaType, null];
    return [mediaType, {
      rawQuery: searchPlan.rawQuery || "",
      entity: searchPlan.entity || null,
      variants: variants.filter((variant) => variant?.key && variant?.query).map((variant) => ({
        key: String(variant.key),
        query: String(variant.query),
        strategy: String(variant.strategy || "user-query")
      }))
    }];
  }));

  return Object.values(plans).some((plan) => !plan?.variants?.length) ? null : plans;
}

function progress(onProgress, payload) {
  if (typeof onProgress === "function") onProgress(payload);
}

async function fetchPassingSearchResults({
  term,
  mediaTypes,
  plans,
  state,
  neededCount,
  onProgress,
  metrics,
  signal,
  deadline,
  options = {}
}) {
  const retrievalLimit = Number.isInteger(options.retrievalBatchSize) && options.retrievalBatchSize > 0
    ? options.retrievalBatchSize
    : Number(process.env.FEED_RETRIEVAL_BATCH_SIZE) || DEFAULT_RETRIEVAL_BATCH_SIZE;

  const maxRounds = Number.isInteger(options.maxRounds) && options.maxRounds > 0
    ? options.maxRounds
    : Number(process.env.FEED_SEARCH_MAX_ROUNDS) || DEFAULT_MAX_ROUNDS;

  const maxCandidates = Number.isInteger(options.maxCandidates) && options.maxCandidates > 0
    ? options.maxCandidates
    : Number(process.env.FEED_SEARCH_MAX_CANDIDATES) || DEFAULT_MAX_CANDIDATES;

  const maxConcurrency = Number.isInteger(options.maxConcurrency) && options.maxConcurrency > 0
    ? options.maxConcurrency
    : DEFAULT_CONCURRENCY;

  let allPairs = mediaTypes.flatMap((mediaType) =>
    (plans[mediaType]?.variants || []).map((variant) => ({ mediaType, variant }))
  );

  state.activeStage = state.activeStage || 1;
  state.mediaTypeAttempts = state.mediaTypeAttempts || {};
  const exhaustedPairsSet = new Set(state.exhaustedPairs || []);
  const seenIdsSet = new Set(state.seenIds || []);
  const deliveredIdsSet = new Set(state.deliveredIds || []);
  const acceptedThisFetch = [];
  let evaluatedCount = 0;

  for (let round = 0; round < maxRounds && acceptedThisFetch.length < neededCount; round += 1) {
    if (evaluatedCount >= maxCandidates) break;
    if (deadline && Date.now() >= deadline) break;

    // Filter active pairs for current stage
    let activePairs = allPairs.filter(({ mediaType, variant }) => {
      const pairKey = `${mediaType}:${variant.key}`;
      if (exhaustedPairsSet.has(pairKey)) return false;
      return (variant.stage || 1) <= state.activeStage;
    });

    // Advance to higher stages or dynamically expand search plans when active pairs are exhausted
    while (!activePairs.length && state.activeStage < 8) {
      state.activeStage += 1;

      // Expand search plans dynamically with facet variants if this stage doesn't have variants yet
      const hasStageVariants = allPairs.some(({ variant }) => (variant.stage || 1) === state.activeStage);
      if (!hasStageVariants && state.activeStage >= 3) {
        const expanded = expandSearchPlans(plans, state.query, state.topicMeaning, mediaTypes, state.activeStage);
        for (const [mType, plan] of Object.entries(expanded)) {
          plans[mType] = plan;
          if (state.searchPlan?.variants) {
            state.searchPlan.variants[mType] = plan.variants.map((v) => ({
              key: v.key,
              query: v.query,
              strategy: v.strategy,
              stage: v.stage
            }));
          }
        }
        allPairs = mediaTypes.flatMap((mediaType) =>
          (plans[mediaType]?.variants || []).map((variant) => ({ mediaType, variant }))
        );
      }

      activePairs = allPairs.filter(({ mediaType, variant }) => {
        const pairKey = `${mediaType}:${variant.key}`;
        if (exhaustedPairsSet.has(pairKey)) return false;
        return (variant.stage || 1) <= state.activeStage;
      });
    }

    if (!activePairs.length) break;

    metrics.increment("rounds");

    // Prioritize underrepresented selected media types without waiting indefinitely for scarce types
    const typeRepresentations = new Map();
    for (const mt of mediaTypes) {
      const pendingCount = (state.pendingAccepted || []).filter((item) => candidateMatchesMediaType(item, mt)).length;
      const currentCount = acceptedThisFetch.filter((item) => candidateMatchesMediaType(item, mt)).length;
      typeRepresentations.set(mt, pendingCount + currentCount);
    }

    activePairs.sort((a, b) => {
      const countA = typeRepresentations.get(a.mediaType) ?? 0;
      const countB = typeRepresentations.get(b.mediaType) ?? 0;
      if (countA !== countB) return countA - countB;
      return (a.variant.stage || 1) - (b.variant.stage || 1);
    });

    progress(onProgress, {
      phase: "retrieving",
      label: "Searching Wikimedia Commons",
      detail: `Retrieval batch ${round + 1}: ${activePairs.length} focused searches`
    });

    // Bounded concurrent query pool avoiding the all-queries barrier
    const queryResults = await metrics.measure("retrieval", () => asyncPool(maxConcurrency, activePairs, async ({ mediaType, variant }) => {
      if (acceptedThisFetch.length >= neededCount && round > 0) return null;

      const pairKey = `${mediaType}:${variant.key}`;
      const pairContinuation = state.upstreamContinuations[pairKey] || { offset: 0, continuation: null };
      const sources = FEED_MEDIA_TYPE_SOURCES[mediaType];
      const sourceId = sources[0];

      const candidates = await queryLiveConnectors(variant.query, {
        limit: retrievalLimit,
        offset: pairContinuation.offset,
        continuations: pairContinuation.continuation ? { [sourceId]: pairContinuation.continuation } : {},
        mediaType: FEED_MEDIA_TYPE_KINDS[mediaType],
        sources,
        allowFixtureFallback: false,
        originalQuery: term,
        metrics,
        signal,
        deadline,
        skipCache: options.skipCache,
        searchContext: {
          strategy: variant.strategy,
          variantKey: variant.key,
          entity: plans[mediaType]?.entity
        }
      });

      return { mediaType, variant, pairKey, candidates };
    }));

    const rawCandidates = [];
    for (const res of queryResults) {
      if (!res) continue;
      const { mediaType, pairKey, candidates } = res;

      if (!state.upstreamContinuations[pairKey]) {
        state.upstreamContinuations[pairKey] = { offset: 0, continuation: null };
      }
      state.upstreamContinuations[pairKey].offset += candidates.length;

      const firstBatch = candidates.batches?.[0];
      if (firstBatch?.continuation) {
        state.upstreamContinuations[pairKey].continuation = firstBatch.continuation;
      }

      const hasFailure = candidates.failures?.length > 0 || candidates.batches?.some((b) => b.status === "failed");
      const hasContinuation = Boolean(firstBatch?.continuation);
      const isExhausted = candidates.exhausted || (candidates.batches?.length > 0 && candidates.batches.every((b) => b.exhausted));

      if (isExhausted && !hasFailure) {
        exhaustedPairsSet.add(pairKey);
      } else if (candidates.length < retrievalLimit && !hasContinuation && !hasFailure) {
        exhaustedPairsSet.add(pairKey);
      }

      if (candidates.length === 0 && !hasFailure) {
        state.mediaTypeAttempts[mediaType] = (state.mediaTypeAttempts[mediaType] || 0) + 1;
      }

      rawCandidates.push(...candidates);
    }

    state.exhaustedPairs = Array.from(exhaustedPairsSet);

    // Deduplicate by stable source identity + canonical clustering BEFORE AI calls
    const uniqueCandidates = [];
    const seenClusterKeys = new Set();

    for (const candidate of rawCandidates) {
      if (!candidate?.id) {
        metrics.increment("invalidCandidates");
        continue;
      }
      if (seenIdsSet.has(candidate.id) || deliveredIdsSet.has(candidate.id)) {
        metrics.increment("duplicates");
        continue;
      }

      const clusterKey = canonicalClusterKey(candidate);
      if (seenClusterKeys.has(clusterKey)) {
        metrics.increment("duplicates");
        continue;
      }
      seenClusterKeys.add(clusterKey);

      seenIdsSet.add(candidate.id);
      if (!state.seenIds.includes(candidate.id)) {
        state.seenIds.push(candidate.id);
      }

      // Check session candidateCache first
      if (state.candidateCache?.[candidate.id]) {
        const cached = state.candidateCache[candidate.id];
        metrics.increment("cacheHits");
        if (cached.accepted) {
          candidate.decision = { ...cached, pass: true };
          candidate.ranking = { ...(candidate.ranking || {}), relevanceProbability: cached.probability };
          const mType = mediaTypes.find((type) => candidateMatchesMediaType(candidate, type));
          if (mType && acceptedThisFetch.length < neededCount) {
            acceptedThisFetch.push(candidate);
            metrics.increment("retained");
          } else {
            state.pendingAccepted.push(candidate);
            metrics.increment("retained");
            metrics.increment("pending");
          }
        }
        continue;
      }

      uniqueCandidates.push(candidate);
    }

    if (!uniqueCandidates.length) {
      if (state.activeStage < 2 && acceptedThisFetch.length < neededCount) {
        state.activeStage = 2;
      }
      continue;
    }

    progress(onProgress, {
      phase: "evaluating",
      label: "Checking relevance with OpenScroll's evaluator",
      detail: `Evaluating ${uniqueCandidates.length} new candidates`
    });

    metrics.capture(uniqueCandidates);
    const evaluation = await metrics.measure("evaluation", () => evaluateFeedCandidates(term, uniqueCandidates, {
      metrics,
      topicMeaning: state.topicMeaning,
      evalConfig: state.evalConfig,
      signal,
      deadline,
      skipCache: options.skipCache
    }));

    const unevaluatedCount = evaluation.unevaluated?.length || 0;
    const evaluatedTotal = uniqueCandidates.length - unevaluatedCount;
    metrics.increment("evaluated", evaluatedTotal);
    metrics.increment("accepted", evaluation.accepted.length);
    metrics.increment("rejected", Math.max(0, evaluatedTotal - evaluation.accepted.length));
    if (unevaluatedCount > 0) {
      metrics.increment("unevaluated", unevaluatedCount);
    }
    evaluatedCount += evaluatedTotal;

    for (const candidate of evaluation.accepted) {
      if (candidate?.id) {
        state.candidateCache[candidate.id] = {
          accepted: true,
          probability: candidate.decision?.probability ?? 1,
          provenance: candidate.decision?.provenance,
          evaluatedAt: Date.now()
        };
      }
      const mediaType = mediaTypes.find((type) => candidateMatchesMediaType(candidate, type));
      if (mediaType && (acceptedThisFetch.length < neededCount)) {
        acceptedThisFetch.push(candidate);
        metrics.increment("retained");
      } else {
        state.pendingAccepted.push(candidate);
        metrics.increment("retained");
        metrics.increment("pending");
      }
    }

    for (const ev of (evaluation.evaluations || [])) {
      if (ev && !ev.unevaluated && !ev.accepted) {
        const candidate = uniqueCandidates[ev.candidateIndex];
        if (candidate?.id && !state.candidateCache[candidate.id]) {
          state.candidateCache[candidate.id] = {
            accepted: false,
            probability: ev.probability,
            provenance: ev.provenance,
            evaluatedAt: Date.now()
          };
        }
      }
    }

    if (acceptedThisFetch.length < neededCount && state.activeStage < 2) {
      state.activeStage = 2;
    }

    progress(onProgress, {
      phase: "evaluating",
      label: "Checking relevance with OpenScroll's evaluator",
      detail: `${acceptedThisFetch.length + state.pendingAccepted.length} relevant results kept from ${evaluatedCount} candidates`
    });
  }

  return { acceptedThisFetch };
}

export async function composeSearchFeed(body = {}, options = {}) {
  const { onProgress, onMetrics, onCandidates, signal, deadline } = options;
  const metrics = createFeedMetrics({ onCandidates });
  try {
    const result = await composeMeasuredSearchFeed(body, { ...options, onProgress, metrics, signal, deadline, store: options.store });
    reportFeedMetrics(onMetrics, metrics, "ok");
    return result;
  } catch (error) {
    metrics.increment("pipelineFailures");
    reportFeedMetrics(onMetrics, metrics, "error");
    throw error;
  }
}

async function composeMeasuredSearchFeed(body = {}, options = {}) {
  const { onProgress, metrics, signal, deadline, store: customStore, ...extraOptions } = options;
  validateFeedRequest(body);

  const {
    interest = "",
    feedback = [],
    pageSize = 25,
    seed,
    sourceOffsets = {},
    mediaTypes,
    searchPlan,
    continuation,
    cursor
  } = body;

  const requestedPageSize = Number.isInteger(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 25;
  const token = typeof continuation === "string" ? continuation : (typeof cursor === "string" && cursor.startsWith(CONTINUATION_TOKEN_PREFIX) ? cursor : null);
  const store = getContinuationStore({ store: customStore });

  let state;
  let seq = 0;

  if (token) {
    const parsed = parseContinuationToken(token);
    state = await store.get(parsed.sessionId);
    if (!state) {
      throw new ContinuationExpiredError();
    }
    seq = parsed.seq;

    if (interest && typeof interest === "string" && interest.trim().length > 0) {
      if (state.query.toLowerCase() !== interest.trim().toLowerCase()) {
        throw new FeedRequestValidationError("Search term does not match active continuation session");
      }
    }

    // Idempotent delivery check: if this batch was already prepared, return it without changes
    if (state.deliveredBatches?.[seq]) {
      const existing = state.deliveredBatches[seq];
      metrics.increment("planReuses");
      metrics.increment("visible", existing.items?.length || 0);
      metrics.set("pending", state.pendingAccepted?.length || 0);
      return existing;
    }

    // Acknowledge/commit previously delivered batch
    if (seq > 0 && state.deliveredBatches?.[seq - 1]) {
      const prevBatch = state.deliveredBatches[seq - 1];
      for (const item of prevBatch.items || []) {
        if (!state.deliveredIds.includes(item.id)) {
          state.deliveredIds.push(item.id);
        }
      }
    }
  } else {
    // Initial search
    const searchTerm = typeof interest === "string" ? interest.trim() : "";
    const selectedMediaTypes = normalizeMediaTypes(mediaTypes);

    progress(onProgress, {
      phase: "planning",
      label: "Understanding your search",
      detail: searchPlan ? "Reusing the search interpretation for this next batch" : "Resolving the topic and preparing focused Commons searches"
    });

    const { entity, plans } = await metrics.measure("planning", async () => {
      const existingPlans = providedSearchPlans(searchPlan, selectedMediaTypes);
      if (existingPlans) metrics.increment("planReuses");
      const entity = existingPlans ? searchPlan.entity : await resolveEntity(searchTerm, { metrics });
      return { entity, plans: existingPlans || buildSearchPlans(searchTerm, entity, selectedMediaTypes) };
    });

    progress(onProgress, {
      phase: "planning",
      label: "Understanding your search",
      detail: `Prepared ${Object.values(plans)[0]?.variants.length || 1} search variants`
    });

    state = createFeedContinuationState({
      query: searchTerm,
      topicMeaning: entity,
      mediaTypes: selectedMediaTypes,
      sources: FEED_MEDIA_TYPE_SOURCES,
      seed,
      searchPlan: {
        rawQuery: searchTerm,
        entity: entity ? { label: entity.label, aliases: entity.aliases } : null,
        variants: Object.fromEntries(Object.entries(plans).map(([type, plan]) => [
          type,
          plan.variants.map((variant) => ({
            key: variant.key,
            query: variant.query,
            strategy: variant.strategy,
            stage: variant.stage || 1
          }))
        ]))
      }
    });

    // Populate initial offsets if legacy sourceOffsets provided
    const savedOffsets = sourceOffsets?.[searchTerm];
    if (savedOffsets && typeof savedOffsets === "object") {
      const initialOffsets = normalizeStartOffsets(savedOffsets, plans);
      for (const [type, data] of Object.entries(initialOffsets)) {
        for (const [vKey, offset] of Object.entries(data.variants || {})) {
          state.upstreamContinuations[`${type}:${vKey}`] = { offset, continuation: null };
        }
      }
    }

    seq = 0;
  }

  const selectedMediaTypes = state.mediaTypes;
  const plans = Object.fromEntries(selectedMediaTypes.map((type) => {
    const variants = state.searchPlan?.variants?.[type] || [];
    return [type, {
      rawQuery: state.query,
      entity: state.topicMeaning,
      variants
    }];
  }));

  const pairs = selectedMediaTypes.flatMap((mediaType) => plans[mediaType].variants.map((variant) => ({ mediaType, variant })));
  const totalPairs = pairs.length;

  // If already exhausted and no pending items remain, return empty completion immediately
  if (state.exhausted && (!state.pendingAccepted || state.pendingAccepted.length === 0)) {
    return {
      items: [],
      pagination: {
        startIndex: state.deliveredIds.length,
        pageSize: requestedPageSize,
        totalCount: state.deliveredIds.length,
        hasMore: false,
        nextCursor: null
      },
      continuation: null,
      mediaTypes: selectedMediaTypes,
      sourceOffsets: { [state.query]: formatOffsets(state.upstreamContinuations, selectedMediaTypes, state.searchPlan) },
      sourceHasMore: false,
      searchPlan: state.searchPlan,
      sourcesRepresented: [],
      mediaKindsRepresented: []
    };
  }

  // 1. Compose from pending accepted items first
  const deliveredIdsSet = new Set(state.deliveredIds);
  const hiddenItemIds = new Set(
    feedback
      .filter((fb) => fb.action === "hide")
      .map((fb) => fb.itemId)
  );

  const batchCandidates = [];
  const retainedPending = [];

  for (const item of state.pendingAccepted) {
    if (deliveredIdsSet.has(item.id) || hiddenItemIds.has(item.id)) {
      continue;
    }
    if (batchCandidates.length < requestedPageSize) {
      batchCandidates.push(item);
    } else {
      retainedPending.push(item);
    }
  }

  state.pendingAccepted = retainedPending;

  // 2. Refill toward requested visible page size if needed
  const neededCount = requestedPageSize - batchCandidates.length;

  const effectiveRetrievalBatchSize = Number.isInteger(body.retrievalBatchSize) && body.retrievalBatchSize > 0
    ? body.retrievalBatchSize
    : (Number.isInteger(extraOptions.retrievalBatchSize) && extraOptions.retrievalBatchSize > 0 ? extraOptions.retrievalBatchSize : undefined);

  const effectiveMaxRounds = Number.isInteger(body.maxRounds) && body.maxRounds > 0
    ? body.maxRounds
    : (Number.isInteger(extraOptions.maxRounds) && extraOptions.maxRounds > 0 ? extraOptions.maxRounds : undefined);

  const effectiveMaxCandidates = Number.isInteger(body.maxCandidates) && body.maxCandidates > 0
    ? body.maxCandidates
    : (Number.isInteger(extraOptions.maxCandidates) && extraOptions.maxCandidates > 0 ? extraOptions.maxCandidates : undefined);

  const effectiveMaxConcurrency = Number.isInteger(body.maxConcurrency) && body.maxConcurrency > 0
    ? body.maxConcurrency
    : (Number.isInteger(extraOptions.maxConcurrency) && extraOptions.maxConcurrency > 0 ? extraOptions.maxConcurrency : undefined);

  if (neededCount > 0 && !state.exhausted) {
    const searchResult = await fetchPassingSearchResults({
      term: state.query,
      mediaTypes: selectedMediaTypes,
      plans,
      state,
      neededCount,
      onProgress,
      metrics,
      signal,
      deadline,
      options: {
        ...extraOptions,
        retrievalBatchSize: effectiveRetrievalBatchSize,
        maxRounds: effectiveMaxRounds,
        maxCandidates: effectiveMaxCandidates,
        maxConcurrency: effectiveMaxConcurrency
      }
    });

    batchCandidates.push(...searchResult.acceptedThisFetch);
  }

  // Persist exhaustion only when all source variants across all stages are exhausted and pending pool is empty
  const currentTotalPairs = selectedMediaTypes.flatMap((type) => plans[type]?.variants || []).length;
  const allPairsExhausted = (state.exhaustedPairs?.length || 0) >= currentTotalPairs && (state.activeStage >= 8);
  if (allPairsExhausted && state.pendingAccepted.length === 0) {
    state.exhausted = true;
  }

  progress(onProgress, {
    phase: "composing",
    label: "Arranging your open feed",
    detail: `Balancing ${batchCandidates.length} relevant results`
  });

  const labeledItems = batchCandidates.map((item) => ({
    ...item,
    knowledge: {
      ...(item.knowledge || {}),
      topics: Array.from(new Set([
        ...(item.knowledge?.topics || []),
        state.topicMeaning?.label || state.query
      ]))
    }
  }));

  // Cursor is 0 for this batch because page position within retained pool is separated from source retrieval
  const composedResult = await metrics.measure("composition", () => composeDiversityFeed(labeledItems, {
    interestGraph: {
      interest: state.query,
      topics: [],
      topicWeights: {},
      excludedTopics: []
    },
    feedback,
    cursor: 0,
    pageSize: requestedPageSize,
    seed: state.seed
  }));

  // Track delivered card IDs
  for (const item of composedResult.items) {
    if (!state.deliveredIds.includes(item.id)) {
      state.deliveredIds.push(item.id);
    }
  }

  metrics.increment("compositionExcluded", labeledItems.length - composedResult.pagination.totalCount);
  metrics.increment("visible", composedResult.items.length);
  metrics.set("pending", state.pendingAccepted.length);

  const hasMore = state.pendingAccepted.length > 0 || !state.exhausted;
  const nextCursor = hasMore ? createContinuationToken(state.id, seq + 1) : null;

  const result = {
    ...composedResult,
    continuation: nextCursor,
    pagination: {
      ...composedResult.pagination,
      startIndex: state.deliveredIds.length - composedResult.items.length,
      nextCursor,
      hasMore
    },
    mediaTypes: selectedMediaTypes,
    sourceOffsets: { [state.query]: formatOffsets(state.upstreamContinuations, selectedMediaTypes, state.searchPlan) },
    sourceHasMore: !state.exhausted,
    exhausted: Boolean(state.exhausted),
    pendingAcceptedCount: state.pendingAccepted.length,
    searchPlan: state.searchPlan,
    topicMeaning: state.topicMeaning
  };

  // Cache batch for idempotent replay
  if (!state.deliveredBatches) state.deliveredBatches = {};
  state.deliveredBatches[seq] = result;
  state.currentSeq = seq;

  // Prune older batches to keep memory/storage bounded
  for (const oldSeq of Object.keys(state.deliveredBatches)) {
    if (Number(oldSeq) < seq - 1) {
      delete state.deliveredBatches[oldSeq];
    }
  }

  await store.put(state.id, state);
  return result;
}
