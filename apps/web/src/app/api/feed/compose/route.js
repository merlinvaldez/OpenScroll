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
      pageSize = 25,
      seed
    } = body;

    const searchQueries = Array.from(new Set((Array.isArray(topics) ? topics : []).filter((topic) => typeof topic === "string" && topic.trim())));
    if (!searchQueries.length) {
      return NextResponse.json({ error: "At least one topic is required" }, { status: 400 });
    }

    // Fetch exactly up to five Wikimedia Commons results for every selected topic.
    const candidateBatches = await Promise.all(
      searchQueries.map(async (query) => {
        const items = await queryLiveConnectors(query, {
          limit: 5,
          sources: ["wikimedia-commons"],
          allowFixtureFallback: false
        });
        return items.map((item) => ({
          ...item,
          knowledge: {
            ...(item.knowledge || {}),
            topics: Array.from(new Set([...(item.knowledge?.topics || []), query]))
          }
        }));
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
      pageSize,
      seed
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
