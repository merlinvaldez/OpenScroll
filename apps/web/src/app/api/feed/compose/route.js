import { EPIC_C_CONNECTORS, composeDiversityFeed } from "@openscroll/content";
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

    // Search across all connectors
    const candidateRuns = await Promise.all(
      EPIC_C_CONNECTORS.map(async (connector) => {
        try {
          const searchResults = await connector.search({ query: interest });
          const objects = await Promise.all(
            searchResults.map(async (item) => {
              try {
                const raw = await connector.fetch(item.id);
                return await connector.normalize(raw);
              } catch {
                return null;
              }
            })
          );
          return objects.filter(Boolean);
        } catch {
          return [];
        }
      })
    );

    const candidates = candidateRuns.flat();

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
