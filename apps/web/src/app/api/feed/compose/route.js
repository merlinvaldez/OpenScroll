import { queryLiveConnectors, composeDiversityFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

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
      pageSize = 25
    } = body;

    // Concurrently query live connectors for the root curiosity and each selected topic
    const searchQueries = Array.from(new Set([interest, ...topics])).slice(0, 6);
    const candidateBatches = await Promise.all(
      searchQueries.map(async (query) => {
        try {
          const items = await queryLiveConnectors(query, { limit: 12 });
          return items.map((item) => ({
            ...item,
            knowledge: {
              ...(item.knowledge || {}),
              topics: Array.from(new Set([...(item.knowledge?.topics || []), query]))
            }
          }));
        } catch {
          return [];
        }
      })
    );

    const candidates = candidateBatches.flat();

    const result = composeDiversityFeed(candidates, {
      interestGraph: {
        interest,
        topics,
        topicWeights,
        excludedTopics
      },
      feedback,
      cursor,
      pageSize
    });

    return NextResponse.json({
      version: "1",
      requestId: crypto.randomUUID(),
      data: result
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
