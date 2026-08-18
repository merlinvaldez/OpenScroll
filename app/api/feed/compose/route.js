import { queryLiveConnectors, composeDiversityFeed } from "@openscroll/content";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      interest = "Morocco",
      topics = [],
      topicWeights = {},
      excludedTopics = [],
      feedback = [],
      cursor = 0,
      pageSize = 25
    } = body;

    // Search live connectors for the interest and specific selected topics
    const searchQueries = [interest, ...topics.slice(0, 3)];
    const candidateBatches = await Promise.all(
      searchQueries.map((q) => queryLiveConnectors(q, { limit: 20 }).catch(() => []))
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
