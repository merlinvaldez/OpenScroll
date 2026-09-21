import { queryLiveConnectors, evaluateFeedCandidates, composeDiversityFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

const PASSING_RESULTS_PER_BATCH = 25;
const EVALUATION_BATCH_SIZE = 5;
const MAX_REQUERY_ROUNDS = 20;
const MEDIA_TYPE_KINDS = Object.freeze({ images: "image", audio: "audio", video: "video", text: "text", data: "data" });

function normalizeMediaTypes(value) {
  if (!Array.isArray(value)) return Object.keys(MEDIA_TYPE_KINDS);
  return Array.from(new Set(value.filter((mediaType) => Object.hasOwn(MEDIA_TYPE_KINDS, mediaType))));
}

function normalizeMediaOffsets(value, mediaTypes) {
  const offsets = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(mediaTypes.map((mediaType) => [
    mediaType,
    Number.isInteger(offsets[mediaType]) && offsets[mediaType] >= 0 ? offsets[mediaType] : 0
  ]));
}

async function fetchPassingTermResults(term, mediaTypes, startOffsets = {}) {
  const passingByMediaType = new Map(mediaTypes.map((mediaType) => [mediaType, []]));
  const seenIds = new Set();
  const nextOffsets = normalizeMediaOffsets(startOffsets, mediaTypes);
  const exhaustedMediaTypes = new Set();

  const passingCount = () => Array.from(passingByMediaType.values()).reduce((count, items) => count + items.length, 0);

  for (let round = 0; round < MAX_REQUERY_ROUNDS && passingCount() < PASSING_RESULTS_PER_BATCH; round += 1) {
    const activeMediaTypes = mediaTypes.filter((mediaType) => !exhaustedMediaTypes.has(mediaType));
    if (!activeMediaTypes.length) break;

    const responses = await Promise.all(activeMediaTypes.map(async (mediaType) => ({
      mediaType,
      candidates: await queryLiveConnectors(term, {
        limit: EVALUATION_BATCH_SIZE,
        offset: nextOffsets[mediaType],
        mediaType: MEDIA_TYPE_KINDS[mediaType],
        sources: ["wikimedia-commons"],
        allowFixtureFallback: false
      })
    })));

    const freshCandidates = responses.flatMap(({ mediaType, candidates }) => {
      nextOffsets[mediaType] += candidates.length;
      if (candidates.length < EVALUATION_BATCH_SIZE) exhaustedMediaTypes.add(mediaType);

      return candidates.filter((candidate) => {
        if (!candidate?.id || seenIds.has(candidate.id)) return false;
        seenIds.add(candidate.id);
        return true;
      });
    });

    if (!freshCandidates.length) {
      break;
    }

    const evaluation = await evaluateFeedCandidates(term, freshCandidates);
    for (const candidate of evaluation.accepted) {
      const mediaType = mediaTypes.find((type) => MEDIA_TYPE_KINDS[type] === candidate.media?.kind);
      if (mediaType && passingCount() < PASSING_RESULTS_PER_BATCH) {
        passingByMediaType.get(mediaType).push(candidate);
      }
    }
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

  return {
    items: passing,
    nextOffsets,
    hasMore: exhaustedMediaTypes.size < mediaTypes.length
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      interest = "",
      feedback = [],
      cursor = 0,
      pageSize = 25,
      seed,
      sourceOffsets = {},
      mediaTypes
    } = body;

    const searchTerm = typeof interest === "string" ? interest.trim() : "";
    if (!searchTerm) {
      return NextResponse.json({ error: "A search term is required" }, { status: 400 });
    }

    const selectedMediaTypes = normalizeMediaTypes(mediaTypes);
    if (!selectedMediaTypes.length) {
      return NextResponse.json({ error: "At least one media type is required" }, { status: 400 });
    }

    // Search each selected media type concurrently, return all responses to the
    // evaluation stage, then keep only candidates OpenAI judges relevant.
    const savedOffsets = sourceOffsets?.[searchTerm];
    const termResult = await fetchPassingTermResults(
      searchTerm,
      selectedMediaTypes,
      savedOffsets && typeof savedOffsets === "object" ? savedOffsets : {}
    );
    const candidates = termResult.items.map((item) => ({
      ...item,
      knowledge: {
        ...(item.knowledge || {}),
        topics: Array.from(new Set([...(item.knowledge?.topics || []), searchTerm]))
      }
    }));

    const result = composeDiversityFeed(candidates, {
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

    return NextResponse.json({
      version: "1",
      requestId: crypto.randomUUID(),
      data: {
        ...result,
        mediaTypes: selectedMediaTypes,
        sourceOffsets: { [searchTerm]: termResult.nextOffsets },
        sourceHasMore: termResult.hasMore
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to compose feed",
        message: error.message
      },
      { status: 500 }
    );
  }
}
