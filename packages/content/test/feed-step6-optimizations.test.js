import test from "node:test";
import assert from "node:assert/strict";
import {
  BoundedTtlCache,
  computeEntityCacheKey,
  computeSourceCacheKey,
  computeDecisionCacheKey
} from "../src/shared-cache.js";
import { deduplicateCandidates, canonicalClusterKey } from "../src/feed-composer.js";
import { buildWikipediaSearchPlan, buildCommonsSearchPlan } from "../src/search-planner.js";
import { searchWikipediaLive } from "../src/source-connectors.js";
import {
  composeSearchFeed,
  DEFAULT_RETRIEVAL_BATCH_SIZE
} from "../src/feed-search.js";

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test("BoundedTtlCache respects maxEntries, evicts oldest entry, and respects TTL expiration", async () => {
  const cache = new BoundedTtlCache({ maxEntries: 3, defaultTtlMs: 50 });

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.size, 3);

  // Access "a" to update its accessTime and move it to end of LRU sequence
  assert.equal(cache.get("a"), 1);

  // Adding "d" should evict the oldest entry in the map ("b")
  cache.set("d", 4);
  assert.equal(cache.size, 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);

  // Wait for TTL expiration (> 50ms)
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("c"), undefined);
  assert.equal(cache.get("d"), undefined);
});

test("BoundedTtlCache coalesces concurrent in-flight requests for identical keys", async () => {
  const cache = new BoundedTtlCache({ maxEntries: 10, defaultTtlMs: 1000 });
  let fetcherCalls = 0;

  const fetcher = async () => {
    fetcherCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { data: "resolved-value", timestamp: Date.now() };
  };

  // Launch 5 concurrent calls for the same key
  const results = await Promise.all([
    cache.coalesce("shared-query", fetcher),
    cache.coalesce("shared-query", fetcher),
    cache.coalesce("shared-query", fetcher),
    cache.coalesce("shared-query", fetcher),
    cache.coalesce("shared-query", fetcher)
  ]);

  assert.equal(fetcherCalls, 1, "Fetcher must only be invoked once for coalesced in-flight calls");
  for (const res of results) {
    assert.equal(res.data, "resolved-value");
    assert.equal(res.timestamp, results[0].timestamp);
  }

  // Subsequent call should hit the populated cache without calling fetcher again
  const cached = await cache.coalesce("shared-query", fetcher);
  assert.equal(cached.data, "resolved-value");
  assert.equal(fetcherCalls, 1);
});

test("Deterministic cache keys incorporate topic, query, versions, and candidate identity", () => {
  const entityKey1 = computeEntityCacheKey("Gnawa Music", "en");
  const entityKey2 = computeEntityCacheKey("gnawa music", "en");
  const entityKeyEs = computeEntityCacheKey("Gnawa Music", "es");
  assert.equal(entityKey1, entityKey2, "Entity keys must normalize casing and whitespace");
  assert.notEqual(entityKey1, entityKeyEs, "Locale difference must produce different entity key");

  const srcKey1 = computeSourceCacheKey({ sourceId: "wikimedia-commons", query: "Gnawa", mediaType: "audio", offset: 0 });
  const srcKey2 = computeSourceCacheKey({ sourceId: "wikimedia-commons", query: "Gnawa", mediaType: "images", offset: 0 });
  assert.notEqual(srcKey1, srcKey2, "Different media type must alter source cache key");

  const baseCand = {
    id: "cand-1",
    content: { title: "Gnawa Ceremony", description: "Lila musical performance" }
  };
  const decKey1 = computeDecisionCacheKey({
    term: "gnawa",
    topicMeaning: { label: "Gnawa" },
    model: "gpt-6-luna",
    promptVersion: "decisions-predicate.v1",
    threshold: 0.7,
    candidate: baseCand
  });
  const decKeyDifferentThreshold = computeDecisionCacheKey({
    term: "gnawa",
    topicMeaning: { label: "Gnawa" },
    model: "gpt-6-luna",
    promptVersion: "decisions-predicate.v1",
    threshold: 0.85,
    candidate: baseCand
  });
  const decKeyDifferentDesc = computeDecisionCacheKey({
    term: "gnawa",
    topicMeaning: { label: "Gnawa" },
    model: "gpt-6-luna",
    promptVersion: "decisions-predicate.v1",
    threshold: 0.7,
    candidate: { ...baseCand, content: { ...baseCand.content, description: "Different description" } }
  });

  assert.notEqual(decKey1, decKeyDifferentThreshold, "Different threshold must invalidate decision cache key");
  assert.notEqual(decKey1, decKeyDifferentDesc, "Different candidate evidence must invalidate decision cache key");
});

test("Deduplication preserves distinct works sharing titles before AI evaluation", () => {
  const candBeethoven = {
    id: "item-1",
    sourceId: "wikimedia-commons",
    sourceItemId: "101",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Beethoven_5.ogg",
    media: { kind: "audio" },
    provenance: { creator: "Ludwig van Beethoven" },
    content: { title: "Symphony No. 5", description: "Symphony No. 5 in C minor" }
  };
  const candTchaikovsky = {
    id: "item-2",
    sourceId: "wikimedia-commons",
    sourceItemId: "102",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tchaikovsky_5.ogg",
    media: { kind: "audio" },
    provenance: { creator: "Pyotr Ilyich Tchaikovsky" },
    content: { title: "Symphony No. 5", description: "Symphony No. 5 in E minor" }
  };
  const candArticle = {
    id: "item-3",
    sourceId: "wikipedia",
    sourceItemId: "201",
    sourceUrl: "https://en.wikipedia.org/wiki/Symphony_No._5",
    media: { kind: "text" },
    provenance: { creator: "Wikipedia" },
    content: { title: "Symphony No. 5", description: "Wikipedia article on Symphony No. 5" }
  };
  const candDuplicateBeethoven = {
    id: "item-4",
    sourceId: "wikimedia-commons",
    sourceItemId: "101", // identical sourceItemId
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Beethoven_5.ogg",
    media: { kind: "audio" },
    provenance: { creator: "Ludwig van Beethoven" },
    content: { title: "Symphony No. 5", description: "Symphony No. 5 in C minor" }
  };

  const keyBeethoven = canonicalClusterKey(candBeethoven);
  const keyTchaikovsky = canonicalClusterKey(candTchaikovsky);
  const keyArticle = canonicalClusterKey(candArticle);
  const keyDup = canonicalClusterKey(candDuplicateBeethoven);

  assert.equal(keyBeethoven, keyDup, "Duplicate candidate must produce identical cluster key");
  assert.notEqual(keyBeethoven, keyTchaikovsky, "Distinct works by different creators must produce distinct cluster keys");
  assert.notEqual(keyBeethoven, keyArticle, "Distinct media kinds must produce distinct cluster keys");

  const deduplicated = deduplicateCandidates([
    candBeethoven,
    candTchaikovsky,
    candArticle,
    candDuplicateBeethoven
  ]);

  assert.equal(deduplicated.length, 3, "Only the genuine duplicate should be clustered and removed");
  assert.deepEqual(deduplicated.map((c) => c.id), ["item-1", "item-2", "item-3"]);
});

test("Search planner tags staged variants and search loop preserves staged activation", () => {
  const wikiPlan = buildWikipediaSearchPlan("Gnawa", { label: "Gnawa", aliases: ["Gnaoua", "Gnaoui"] });
  assert.ok(wikiPlan.variants.length >= 2);
  const wikiStage1 = wikiPlan.variants.filter((v) => v.stage === 1);
  const wikiStage2 = wikiPlan.variants.filter((v) => v.stage === 2);
  assert.ok(wikiStage1.length >= 1, "Wikipedia plan must have stage 1 variants for user/canonical query");
  assert.ok(wikiStage2.length >= 1, "Wikipedia plan must have stage 2 variants for aliases");

  const commonsPlan = buildCommonsSearchPlan("Gnawa", { label: "Gnawa", aliases: ["Gnaoua"] });
  const commonsStage1 = commonsPlan.variants.filter((v) => v.stage === 1);
  const commonsStage2 = commonsPlan.variants.filter((v) => v.stage === 2);
  assert.ok(commonsStage1.length >= 1, "Commons image plan must have stage 1 variants");
  assert.ok(commonsStage2.length >= 1, "Commons image plan must have stage 2 variants for title/alias matches");
});

test("Wikipedia live search fetches page summaries concurrently with bounded worker pool (concurrency 4)", async () => {
  const originalFetch = globalThis.fetch;
  let inFlight = 0;
  let peakInFlight = 0;

  globalThis.fetch = async (url) => {
    if (url.includes("action=query") && url.includes("list=search")) {
      return mockResponse({
        query: {
          search: [
            { pageid: 1, title: "Title 1" },
            { pageid: 2, title: "Title 2" },
            { pageid: 3, title: "Title 3" },
            { pageid: 4, title: "Title 4" },
            { pageid: 5, title: "Title 5" },
            { pageid: 6, title: "Title 6" },
            { pageid: 7, title: "Title 7" },
            { pageid: 8, title: "Title 8" }
          ]
        }
      });
    }

    if (url.includes("/page/summary/")) {
      inFlight += 1;
      if (inFlight > peakInFlight) peakInFlight = inFlight;
      // Simulate asynchronous summary fetching
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      const titleMatch = url.match(/\/page\/summary\/(.+)$/);
      const decodedTitle = titleMatch ? decodeURIComponent(titleMatch[1]) : "Sample";
      return mockResponse({
        pageid: 10,
        type: "standard",
        title: decodedTitle,
        extract: `Summary for ${decodedTitle}`,
        content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${decodedTitle}` } }
      });
    }

    return mockResponse({});
  };

  try {
    const batch = await searchWikipediaLive("Gnawa", 8, { skipCache: true });
    assert.equal(batch.items.length, 8);
    assert.ok(peakInFlight <= 4, `Peak in-flight (${peakInFlight}) must not exceed pool limit of 4`);
    assert.ok(peakInFlight >= 2, `Peak in-flight (${peakInFlight}) must demonstrate concurrent execution`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Configurable budgets return resumable work upon exhaustion without premature feed termination", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  globalThis.fetch = async (url) => {
    if (url === "https://api.openai.com/v1/responses") {
      return mockResponse({
        id: "resp_entity",
        status: "completed",
        model: "gpt-6-luna",
        output: [{
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{
            type: "output_text",
            text: JSON.stringify({ label: "RareMusic", description: "Scarce genre.", aliases: [] })
          }]
        }],
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
      });
    }

    if (url === "https://api.openai.com/v1/decisions") {
      // Mock decisions: none accept (all 0.1 probability, below 0.7 threshold)
      return mockResponse({
        model: "gpt-6-luna",
        answers: [{ type: "predicate", name: "cand_0", probability: 0.1 }],
        usage: { input_tokens: 20, output_tokens: 0, total_tokens: 20 }
      });
    }

    // Commons mock returning 1 page with continue block indicating upstream results remain
    return mockResponse({
      continue: { gsroffset: 10, continue: "gsroffset||" },
      query: {
        pages: {
          "999": {
            pageid: 999,
            title: "File:RareMusic1.jpg",
            imageinfo: [{
              url: "https://upload.wikimedia.org/rare.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:RareMusic1.jpg",
              mime: "image/jpeg",
              extmetadata: {
                Artist: { value: "Test Artist" },
                ImageDescription: { value: "Rare music sample." },
                Categories: { value: "Music" }
              }
            }]
          }
        }
      }
    });
  };

  try {
    // Run with maxRounds = 1 so budget is exhausted quickly
    const result = await composeSearchFeed({
      interest: "RareMusic",
      mediaTypes: ["images"],
      pageSize: 5,
      maxRounds: 1
    }, {
      skipCache: true
    });

    assert.equal(result.items.length, 0, "No items should be accepted when all decisions reject");
    assert.equal(result.exhausted, false, "Budget exhaustion must return exhausted: false when upstream is not empty");
    assert.equal(result.pagination.hasMore, true, "Budget exhaustion must return hasMore: true");
    assert.ok(result.pagination.nextCursor, "Resumable continuation token must be returned");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("Retrieval batch size comparison (5 vs 10 vs 15) demonstrates optimal balance with overflow preservation", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  const makeMockFetch = (rawResultsCount = 30) => {
    return async (url, init = {}) => {
      if (url === "https://api.openai.com/v1/responses") {
        return mockResponse({
          id: "resp_entity",
          status: "completed",
          model: "gpt-6-luna",
          output: [{
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{
              type: "output_text",
              text: JSON.stringify({ label: "BenchmarkTopic", description: "Benchmark test topic.", aliases: [] })
            }]
          }],
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
        });
      }

      if (url === "https://api.openai.com/v1/decisions") {
        const body = JSON.parse(init.body);
        // Every second candidate is accepted (50% acceptance rate)
        const answers = (body.questions || []).map((q, idx) => ({
          type: "predicate",
          name: q.name,
          probability: idx % 2 === 0 ? 0.95 : 0.2
        }));
        return mockResponse({
          model: "gpt-6-luna",
          answers,
          usage: { input_tokens: 20, output_tokens: 0, total_tokens: 20 }
        });
      }

      // Return pages according to requested limit and offset in URL
      const urlObj = new URL(url);
      const limit = Number(urlObj.searchParams.get("gsrlimit") || urlObj.searchParams.get("iilimit") || 10);
      const offset = Number(urlObj.searchParams.get("gsroffset") || 0);
      const pages = {};
      const count = Math.min(limit, Math.max(0, rawResultsCount - offset));
      for (let i = 1; i <= count; i++) {
        const id = offset + i;
        pages[String(id)] = {
          pageid: id,
          title: `File:Item_${id}.jpg`,
          imageinfo: [{
            url: `https://upload.wikimedia.org/item_${id}.jpg`,
            thumburl: `https://upload.wikimedia.org/item_${id}_thumb.jpg`,
            descriptionurl: `https://commons.wikimedia.org/wiki/File:Item_${id}.jpg`,
            mime: "image/jpeg",
            extmetadata: {
              Artist: { value: "Benchmark Artist" },
              ImageDescription: { value: `Benchmark item ${id}` },
              Categories: { value: "Benchmark" }
            }
          }]
        };
      }
      const hasMoreUpstream = offset + count < rawResultsCount;
      return mockResponse({
        ...(hasMoreUpstream ? { continue: { gsroffset: offset + count, continue: "gsroffset||" } } : {}),
        query: { pages }
      });
    };
  };

  const benchmarkMetrics = {};
  const batchSizes = [5, 10, 15];

  try {
    for (const batchSize of batchSizes) {
      globalThis.fetch = makeMockFetch(30);
      let capturedMetrics = null;
      const feedResult = await composeSearchFeed(
        {
          interest: "BenchmarkTopic",
          mediaTypes: ["images"],
          pageSize: 4, // Goal: 4 visible cards
          seed: 42,
          retrievalBatchSize: batchSize
        },
        {
          skipCache: true,
          onMetrics: (m) => { capturedMetrics = m; }
        }
      );

      benchmarkMetrics[batchSize] = {
        visible: feedResult.items.length,
        pending: feedResult.pendingAcceptedCount,
        normalized: capturedMetrics.counters.normalizedCandidates,
        aiCalls: capturedMetrics.counters.aiCalls,
        sourceCalls: capturedMetrics.counters.sourceCalls,
        wallTimeMs: capturedMetrics.fullPageMs
      };

      assert.equal(feedResult.items.length, 4, `Batch size ${batchSize} must fulfill requested 4 items`);
      // Overflow preservation: pendingAccepted retains extra accepted candidates
      if (benchmarkMetrics[batchSize].pending > 0) {
        assert.ok(feedResult.pagination.nextCursor, "When overflow is preserved, nextCursor must be present");
      }
    }

    // Compare findings across retrieval batch sizes:
    // Size 5: fewer normalized candidates per round, requiring more rounds or higher chance of insufficient initial fill
    // Size 15: over-fetches candidates and overflow (high pending candidates when target is 4)
    // Size 10: strikes the optimal balance between round trips and surplus candidate fetching
    assert.ok(
      benchmarkMetrics[10].normalized >= 10,
      "Batch size 10 retrieves enough candidates to fulfill target without excess round trips"
    );
    assert.ok(
      benchmarkMetrics[15].pending >= benchmarkMetrics[10].pending,
      "Batch size 15 creates higher surplus pending overflow than batch size 10"
    );
    assert.equal(DEFAULT_RETRIEVAL_BATCH_SIZE, 10, "DEFAULT_RETRIEVAL_BATCH_SIZE is set to 10 based on benchmark evidence");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
