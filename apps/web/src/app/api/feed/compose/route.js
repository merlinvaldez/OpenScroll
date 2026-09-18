import { queryLiveConnectors, evaluateFeedCandidates, composeDiversityFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

const PASSING_RESULTS_PER_BATCH = 25;
const EVALUATION_BATCH_SIZE = 5;
const MAX_REQUERY_ROUNDS = 20;

async function fetchPassingTermResults(term, startOffset = 0) {
  const passing = [];
  const seenIds = new Set();
  let offset = Number.isInteger(startOffset) && startOffset >= 0 ? startOffset : 0;
  let sourceExhausted = false;

  for (let round = 0; round < MAX_REQUERY_ROUNDS && passing.length < PASSING_RESULTS_PER_BATCH; round += 1) {
    const candidates = await queryLiveConnectors(term, {
      limit: EVALUATION_BATCH_SIZE,
      offset,
      sources: ["wikimedia-commons"],
      allowFixtureFallback: false
    });
    const freshCandidates = candidates.filter((candidate) => {
      if (!candidate?.id || seenIds.has(candidate.id)) return false;
      seenIds.add(candidate.id);
      return true;
    });

    if (!freshCandidates.length) {
      sourceExhausted = true;
      break;
    }

    const evaluation = await evaluateFeedCandidates(term, freshCandidates);
    for (const candidate of evaluation.accepted) {
      if (passing.length < PASSING_RESULTS_PER_BATCH) passing.push(candidate);
    }

    offset += candidates.length;
    if (candidates.length < EVALUATION_BATCH_SIZE) {
      sourceExhausted = true;
      break;
    }
  }

  return {
    items: passing,
    nextOffset: offset,
    hasMore: !sourceExhausted
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
      sourceOffsets = {}
    } = body;

    const searchTerm = typeof interest === "string" ? interest.trim() : "";
    if (!searchTerm) {
      return NextResponse.json({ error: "A search term is required" }, { status: 400 });
    }

    // Fetch a single term-based batch from Wikimedia Commons, then keep only
    // candidates that OpenAI judges semantically relevant to that term.
    const termResult = await fetchPassingTermResults(searchTerm, sourceOffsets?.[searchTerm]);
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
        sourceOffsets: { [searchTerm]: termResult.nextOffset },
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
