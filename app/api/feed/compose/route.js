import { queryLiveConnectors, evaluateFeedCandidates, composeDiversityFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

const PASSING_RESULTS_PER_TOPIC = 5;
const EVALUATION_BATCH_SIZE = 5;
const MAX_REQUERY_ROUNDS = 20;

async function fetchPassingTopicResults(mainTopic, subtopic, startOffset = 0) {
  const passing = [];
  const seenIds = new Set();
  let offset = Number.isInteger(startOffset) && startOffset >= 0 ? startOffset : 0;
  let sourceExhausted = false;

  for (let round = 0; round < MAX_REQUERY_ROUNDS && passing.length < PASSING_RESULTS_PER_TOPIC; round += 1) {
    const searchQuery = `${mainTopic} ${subtopic}`.trim();
    const candidates = await queryLiveConnectors(searchQuery, {
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

    const evaluation = await evaluateFeedCandidates(mainTopic, subtopic, freshCandidates);
    for (const candidate of evaluation.accepted) {
      if (passing.length < PASSING_RESULTS_PER_TOPIC) passing.push(candidate);
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
      interest = "Culture",
      topics = [],
      topicWeights = {},
      excludedTopics = [],
      feedback = [],
      cursor = 0,
      pageSize = 25,
      seed,
      sourceOffsets = {}
    } = body;

    const searchQueries = Array.from(new Set((Array.isArray(topics) ? topics : []).filter((topic) => typeof topic === "string" && topic.trim())));
    if (!searchQueries.length) {
      return NextResponse.json({ error: "At least one topic is required" }, { status: 400 });
    }

    // Fetch exactly up to five evaluated Wikimedia Commons results for every selected topic.
    const topicResults = await Promise.all(
      searchQueries.map(async (query) => {
        const result = await fetchPassingTopicResults(interest, query, sourceOffsets?.[query]);
        const items = result.items.map((item) => ({
          ...item,
          knowledge: {
            ...(item.knowledge || {}),
            topics: Array.from(new Set([...(item.knowledge?.topics || []), interest, query]))
          }
        }));
        return {
          query,
          items,
          nextOffset: result.nextOffset,
          hasMore: result.hasMore
        };
      })
    );

    const candidates = topicResults.flatMap(({ items }) => items);
    const nextSourceOffsets = Object.fromEntries(
      topicResults.map(({ query, nextOffset }) => [query, nextOffset])
    );

    const result = composeDiversityFeed(candidates, {
      interestGraph: {
        interest,
        topics,
        topicWeights,
        excludedTopics
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
        sourceOffsets: nextSourceOffsets,
        sourceHasMore: topicResults.some(({ hasMore }) => hasMore)
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
