import { composeDiversityFeed } from "./feed-composer.js";
import { resolveEntity, evaluateFeedCandidates } from "./topic-engine.js";
import { queryLiveConnectors } from "./source-connectors.js";
import { buildSearchPlans } from "./search-planner.js";
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

const EVALUATION_BATCH_SIZE = 5;
const MAX_REQUERY_ROUNDS = 20;
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
  deadline
}) {
  const pairs = mediaTypes.flatMap((mediaType) => plans[mediaType].variants.map((variant) => ({ mediaType, variant })));
  const exhaustedPairsSet = new Set(state.exhaustedPairs || []);
  const seenIdsSet = new Set(state.seenIds || []);
  const deliveredIdsSet = new Set(state.deliveredIds || []);
  const acceptedThisFetch = [];
  let evaluatedCount = 0;

  for (let round = 0; round < MAX_REQUERY_ROUNDS && acceptedThisFetch.length < neededCount; round += 1) {
    const activePairs = pairs.filter(({ mediaType, variant }) => !exhaustedPairsSet.has(`${mediaType}:${variant.key}`));
    if (!activePairs.length) break;
    metrics.increment("rounds");

    progress(onProgress, {
      phase: "retrieving",
      label: "Searching Wikimedia Commons",
      detail: `Retrieval batch ${round + 1}: ${activePairs.length} focused searches`
    });

    const responses = await metrics.measure("retrieval", () => Promise.all(activePairs.map(async ({ mediaType, variant }) => {
      const pairKey = `${mediaType}:${variant.key}`;
      const pairContinuation = state.upstreamContinuations[pairKey] || { offset: 0, continuation: null };
      const sources = FEED_MEDIA_TYPE_SOURCES[mediaType];
      const sourceId = sources[0];

      return {
        mediaType,
        variant,
        pairKey,
        candidates: await queryLiveConnectors(variant.query, {
          limit: EVALUATION_BATCH_SIZE,
          offset: pairContinuation.offset,
          continuations: pairContinuation.continuation ? { [sourceId]: pairContinuation.continuation } : {},
          mediaType: FEED_MEDIA_TYPE_KINDS[mediaType],
          sources,
          allowFixtureFallback: false,
          originalQuery: term,
          metrics,
          signal,
          deadline,
          searchContext: {
            strategy: variant.strategy,
            variantKey: variant.key,
            entity: plans[mediaType].entity
          }
        })
      };
    })));

    const freshCandidates = responses.flatMap(({ pairKey, candidates }) => {
      if (!state.upstreamContinuations[pairKey]) {
        state.upstreamContinuations[pairKey] = { offset: 0, continuation: null };
      }
      state.upstreamContinuations[pairKey].offset += candidates.length;

      const firstBatch = candidates.batches?.[0];
      if (firstBatch?.continuation) {
        state.upstreamContinuations[pairKey].continuation = firstBatch.continuation;
      }

      const hasFailure = candidates.failures?.length > 0 || candidates.batches?.some((b) => b.status === "failed");
      const isExhausted = candidates.exhausted || (candidates.batches?.length > 0 && candidates.batches.every((b) => b.exhausted));

      if (isExhausted && !hasFailure) {
        exhaustedPairsSet.add(pairKey);
      } else if (candidates.length < EVALUATION_BATCH_SIZE && !hasFailure) {
        exhaustedPairsSet.add(pairKey);
      }

      return candidates.filter((candidate) => {
        if (!candidate?.id) { metrics.increment("invalidCandidates"); return false; }
        if (seenIdsSet.has(candidate.id) || deliveredIdsSet.has(candidate.id)) {
          metrics.increment("duplicates");
          return false;
        }
        seenIdsSet.add(candidate.id);
        if (!state.seenIds.includes(candidate.id)) {
          state.seenIds.push(candidate.id);
        }
        return true;
      });
    });

    state.exhaustedPairs = Array.from(exhaustedPairsSet);

    if (!freshCandidates.length) continue;

    progress(onProgress, {
      phase: "evaluating",
      label: "Checking relevance with OpenScroll's evaluator",
      detail: `Evaluating ${freshCandidates.length} new candidates`
    });
    metrics.capture(freshCandidates);
    const evaluation = await metrics.measure("evaluation", () => evaluateFeedCandidates(term, freshCandidates, {
      metrics,
      topicMeaning: state.topicMeaning,
      evalConfig: state.evalConfig,
      signal,
      deadline
    }));
    const unevaluatedCount = evaluation.unevaluated?.length || 0;
    const evaluatedTotal = freshCandidates.length - unevaluatedCount;
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
        // OVERFLOW IS PRESERVED IN pendingAccepted, NEVER DROPPED!
        state.pendingAccepted.push(candidate);
        metrics.increment("retained");
        metrics.increment("pending");
      }
    }

    // Cache definitively rejected candidates; leave unevaluated retryable
    for (const ev of (evaluation.evaluations || [])) {
      if (ev && !ev.unevaluated && !ev.accepted) {
        const candidate = freshCandidates[ev.candidateIndex];
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
    const result = await composeMeasuredSearchFeed(body, { onProgress, metrics, signal, deadline, store: options.store });
    reportFeedMetrics(onMetrics, metrics, "ok");
    return result;
  } catch (error) {
    metrics.increment("pipelineFailures");
    reportFeedMetrics(onMetrics, metrics, "error");
    throw error;
  }
}

async function composeMeasuredSearchFeed(body = {}, { onProgress, metrics, signal, deadline, store: customStore }) {
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
          plan.variants.map((variant) => ({ key: variant.key, query: variant.query, strategy: variant.strategy }))
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

  if (neededCount > 0 && (!state.exhaustedPairs || state.exhaustedPairs.length < totalPairs)) {
    const searchResult = await fetchPassingSearchResults({
      term: state.query,
      mediaTypes: selectedMediaTypes,
      plans,
      state,
      neededCount,
      onProgress,
      metrics,
      signal,
      deadline
    });

    batchCandidates.push(...searchResult.acceptedThisFetch);
  }

  // Persist exhaustion when all source searches are exhausted and pending pool is empty
  const allPairsExhausted = (state.exhaustedPairs?.length || 0) >= totalPairs;
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
    searchPlan: state.searchPlan
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
