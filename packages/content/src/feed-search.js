import { composeDiversityFeed } from "./feed-composer.js";
import { resolveEntity, evaluateFeedCandidates } from "./topic-engine.js";
import { queryLiveConnectors } from "./source-connectors.js";
import { buildSearchPlans } from "./search-planner.js";

export const FEED_MEDIA_TYPE_KINDS = Object.freeze({ images: "image", audio: "audio", video: "video", text: "text", data: "data" });
export const FEED_MEDIA_TYPE_SOURCES = Object.freeze({ images: ["wikimedia-commons"], audio: ["wikimedia-commons"], video: ["wikimedia-commons"], text: ["wikipedia"], data: ["wikimedia-commons"] });

const PASSING_RESULTS_PER_BATCH = 25;
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

async function fetchPassingSearchResults({ term, mediaTypes, plans, startOffsets, onProgress }) {
  const passingByMediaType = new Map(mediaTypes.map((mediaType) => [mediaType, []]));
  const nextOffsets = normalizeStartOffsets(startOffsets, plans);
  const exhaustedPairs = new Set();
  const seenIds = new Set();
  let evaluatedCount = 0;

  const passingCount = () => Array.from(passingByMediaType.values()).reduce((count, items) => count + items.length, 0);
  const pairs = mediaTypes.flatMap((mediaType) => plans[mediaType].variants.map((variant) => ({ mediaType, variant })));

  for (let round = 0; round < MAX_REQUERY_ROUNDS && passingCount() < PASSING_RESULTS_PER_BATCH; round += 1) {
    const activePairs = pairs.filter(({ mediaType, variant }) => !exhaustedPairs.has(`${mediaType}:${variant.key}`));
    if (!activePairs.length) break;

    progress(onProgress, {
      phase: "retrieving",
      label: "Searching Wikimedia Commons",
      detail: `Retrieval batch ${round + 1}: ${activePairs.length} focused searches`
    });

    const responses = await Promise.all(activePairs.map(async ({ mediaType, variant }) => ({
      mediaType,
      variant,
      candidates: await queryLiveConnectors(variant.query, {
        limit: EVALUATION_BATCH_SIZE,
        offset: nextOffsets[mediaType].variants[variant.key],
        mediaType: FEED_MEDIA_TYPE_KINDS[mediaType],
        sources: FEED_MEDIA_TYPE_SOURCES[mediaType],
        allowFixtureFallback: false,
        originalQuery: term,
        searchContext: {
          strategy: variant.strategy,
          variantKey: variant.key,
          entity: plans[mediaType].entity
        }
      })
    })));

    const freshCandidates = responses.flatMap(({ mediaType, variant, candidates }) => {
      nextOffsets[mediaType].variants[variant.key] += candidates.length;
      if (candidates.length < EVALUATION_BATCH_SIZE) exhaustedPairs.add(`${mediaType}:${variant.key}`);

      return candidates.filter((candidate) => {
        if (!candidate?.id || seenIds.has(candidate.id)) return false;
        seenIds.add(candidate.id);
        return true;
      });
    });

    if (!freshCandidates.length) continue;

    progress(onProgress, {
      phase: "evaluating",
      label: "Checking relevance with OpenScroll's evaluator",
      detail: `Evaluating ${freshCandidates.length} new candidates`
    });
    const evaluation = await evaluateFeedCandidates(term, freshCandidates);
    evaluatedCount += freshCandidates.length;

    for (const candidate of evaluation.accepted) {
      const mediaType = mediaTypes.find((type) => candidateMatchesMediaType(candidate, type));
      if (mediaType && passingCount() < PASSING_RESULTS_PER_BATCH) {
        passingByMediaType.get(mediaType).push(candidate);
      }
    }

    progress(onProgress, {
      phase: "evaluating",
      label: "Checking relevance with OpenScroll's evaluator",
      detail: `${passingCount()} relevant results kept from ${evaluatedCount} candidates`
    });
  }

  const passing = [];
  let added = true;
  while (passing.length < PASSING_RESULTS_PER_BATCH && added) {
    added = false;
    for (const mediaType of mediaTypes) {
      const queue = passingByMediaType.get(mediaType);
      if (!queue?.length || passing.length >= PASSING_RESULTS_PER_BATCH) continue;
      passing.push(queue.shift());
      added = true;
    }
  }

  const hasMore = exhaustedPairs.size < pairs.length;
  return {
    items: passing,
    nextOffsets,
    hasMore
  };
}

export async function composeSearchFeed(body = {}, { onProgress } = {}) {
  const {
    interest = "",
    feedback = [],
    cursor = 0,
    pageSize = 25,
    seed,
    sourceOffsets = {},
    mediaTypes,
    searchPlan
  } = body;

  const searchTerm = typeof interest === "string" ? interest.trim() : "";
  if (!searchTerm) {
    const error = new Error("A search term is required");
    error.status = 400;
    throw error;
  }

  const selectedMediaTypes = normalizeMediaTypes(mediaTypes);
  if (!selectedMediaTypes.length) {
    const error = new Error("At least one media type is required");
    error.status = 400;
    throw error;
  }

  progress(onProgress, {
    phase: "planning",
    label: "Understanding your search",
    detail: searchPlan ? "Reusing the search interpretation for this next batch" : "Resolving the topic and preparing focused Commons searches"
  });
  const existingPlans = providedSearchPlans(searchPlan, selectedMediaTypes);
  const entity = existingPlans ? searchPlan.entity : await resolveEntity(searchTerm);
  const plans = existingPlans || buildSearchPlans(searchTerm, entity, selectedMediaTypes);

  progress(onProgress, {
    phase: "planning",
    label: "Understanding your search",
    detail: `Prepared ${Object.values(plans)[0]?.variants.length || 1} search variants`
  });

  const savedOffsets = sourceOffsets?.[searchTerm];
  const searchResult = await fetchPassingSearchResults({
    term: searchTerm,
    mediaTypes: selectedMediaTypes,
    plans,
    startOffsets: savedOffsets && typeof savedOffsets === "object" ? savedOffsets : {},
    onProgress
  });

  progress(onProgress, {
    phase: "composing",
    label: "Arranging your open feed",
    detail: `Balancing ${searchResult.items.length} relevant results`
  });
  const labeledItems = searchResult.items.map((item) => ({
    ...item,
    knowledge: {
      ...(item.knowledge || {}),
      topics: Array.from(new Set([
        ...(item.knowledge?.topics || []),
        entity?.label || searchTerm
      ]))
    }
  }));
  const result = composeDiversityFeed(labeledItems, {
    interestGraph: {
      interest: searchTerm,
      topics: [],
      topicWeights: {},
      excludedTopics: []
    },
    feedback,
    cursor,
    pageSize,
    seed
  });

  return {
    ...result,
    mediaTypes: selectedMediaTypes,
    sourceOffsets: { [searchTerm]: searchResult.nextOffsets },
    sourceHasMore: searchResult.hasMore,
    searchPlan: {
      rawQuery: searchTerm,
      entity: entity ? { label: entity.label, aliases: entity.aliases } : null,
      variants: Object.fromEntries(Object.entries(plans).map(([mediaType, plan]) => [
        mediaType,
        plan.variants.map((variant) => ({ key: variant.key, query: variant.query, strategy: variant.strategy }))
      ]))
    }
  };
}
