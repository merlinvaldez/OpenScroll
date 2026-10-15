import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  FEED_CONTINUATION_VERSION,
  MAX_CONTINUATION_TOKEN_LENGTH,
  CONTINUATION_TOKEN_PREFIX,
  ContinuationExpiredError,
  InvalidContinuationError,
  FeedRequestValidationError,
  createContinuationToken,
  parseContinuationToken,
  createFeedContinuationState,
  validateFeedContinuation,
  validateFeedRequest,
  FileFeedContinuationStore,
  MemoryFeedContinuationStore,
  composeSearchFeed
} from "../src/index.js";
import { feedContinuationSchema } from "@openscroll/contracts";

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test("feed continuation contract binds query, topic, media types, sources, seed, plan, and eval config", () => {
  const state = createFeedContinuationState({
    query: " Gnawa music Morocco ",
    topicMeaning: { label: "Gnawa", description: "Moroccan spiritual music tradition", aliases: ["Gnaoua"] },
    mediaTypes: ["images", "audio"],
    sources: { images: ["wikimedia-commons"], audio: ["wikimedia-commons"] },
    seed: 12345,
    planVersion: "search-plan.v1",
    searchPlan: { rawQuery: "Gnawa music Morocco", variants: { images: [{ key: "img-1", query: "Gnawa" }] } },
    evalConfig: { evaluator: "topic-engine.v1", model: "gpt-6-luna", threshold: 0.7 }
  });

  assert.equal(state.schemaVersion, FEED_CONTINUATION_VERSION);
  assert.equal(state.query, "Gnawa music Morocco");
  assert.equal(state.topicMeaning.label, "Gnawa");
  assert.deepEqual(state.mediaTypes, ["images", "audio"]);
  assert.equal(state.seed, 12345);
  assert.equal(state.planVersion, "search-plan.v1");
  assert.equal(state.evalConfig.model, "gpt-6-luna");
  assert.equal(state.exhausted, false);
  assert.ok(Array.isArray(state.pendingAccepted));
  assert.ok(Array.isArray(state.deliveredIds));
  assert.ok(Array.isArray(state.seenIds));

  const validation = validateFeedContinuation(state);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  // Schema conformance
  assert.equal(feedContinuationSchema.$id, "https://openscroll.app/contracts/feed-continuation.v1.json");
  for (const field of feedContinuationSchema.required) {
    assert.ok(Object.hasOwn(state, field), `Missing required schema field: ${field}`);
  }
});

test("request validation rejects oversized queries, invalid page sizes, and malformed continuation tokens", () => {
  // Missing or empty query on initial search
  assert.throws(() => validateFeedRequest({ interest: "" }), FeedRequestValidationError);
  assert.throws(() => validateFeedRequest({ interest: "   " }), FeedRequestValidationError);
  assert.throws(() => validateFeedRequest({}), FeedRequestValidationError);

  // Query length limit (200 characters)
  const longQuery = "a".repeat(201);
  assert.throws(() => validateFeedRequest({ interest: longQuery }), /exceeds maximum length/);

  // Page size bounds (1 - 100)
  assert.throws(() => validateFeedRequest({ interest: "Gnawa", pageSize: 0 }), /pageSize must be an integer/);
  assert.throws(() => validateFeedRequest({ interest: "Gnawa", pageSize: 101 }), /pageSize must be an integer/);
  assert.throws(() => validateFeedRequest({ interest: "Gnawa", pageSize: -5 }), /pageSize must be an integer/);
  assert.equal(validateFeedRequest({ interest: "Gnawa", pageSize: 25 }), true);

  // Empty mediaTypes
  assert.throws(() => validateFeedRequest({ interest: "Gnawa", mediaTypes: [] }), /media type is required/);

  // Malformed continuation tokens
  assert.throws(() => validateFeedRequest({ continuation: "invalid_prefix_token" }), InvalidContinuationError);
  assert.throws(() => validateFeedRequest({ continuation: `${CONTINUATION_TOKEN_PREFIX}${"x".repeat(600)}` }), /exceeds maximum length/);
  assert.throws(() => validateFeedRequest({ continuation: `${CONTINUATION_TOKEN_PREFIX}bad` }), InvalidContinuationError);
});

test("opaque continuation token generates and parses signed tokens securely", () => {
  const sessionId = "sess-abc-123";
  const seq = 3;
  const token = createContinuationToken(sessionId, seq);

  assert.ok(token.startsWith(CONTINUATION_TOKEN_PREFIX));
  assert.ok(token.length < MAX_CONTINUATION_TOKEN_LENGTH);

  const parsed = parseContinuationToken(token);
  assert.equal(parsed.sessionId, sessionId);
  assert.equal(parsed.seq, seq);

  // Tampered token fails verification
  const tampered = token.slice(0, -4) + "ZZZZ";
  assert.throws(() => parseContinuationToken(tampered), InvalidContinuationError);
});

test("file and memory stores handle put, get, touch, TTL expiration, and pruning", async () => {
  const tmpDir = path.join(os.tmpdir(), `openscroll-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const fileStore = new FileFeedContinuationStore({ storeDir: tmpDir, defaultTtlMs: 200 });
  const memoryStore = new MemoryFeedContinuationStore({ defaultTtlMs: 200 });

  for (const store of [fileStore, memoryStore]) {
    const state = createFeedContinuationState({
      id: "test-session-1",
      query: "Gnawa music",
      mediaTypes: ["images"],
      ttlMs: 200
    });

    await store.put(state.id, state, { ttlMs: 200 });
    const fetched = await store.get("test-session-1");
    assert.ok(fetched);
    assert.equal(fetched.query, "Gnawa music");

    // Touch extends expiration
    const touched = await store.touch("test-session-1", { ttlMs: 500 });
    assert.ok(touched.expiresAt > fetched.expiresAt);

    // Expired state returns null and gets pruned
    await store.put("test-session-expired", state, { ttlMs: -10 });
    const expired = await store.get("test-session-expired");
    assert.equal(expired, null);

    const { prunedCount } = await store.prune();
    assert.ok(prunedCount >= 0);

    // Delete
    await store.delete("test-session-1");
    assert.equal(await store.get("test-session-1"), null);
  }

  try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* cleanup */ }
});

test("feed composition preserves overflow in pendingAccepted and fulfills next page without extra source calls", async () => {
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.OPENAI_API_KEY;
  const prevModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";

  const store = new MemoryFeedContinuationStore();
  let aiCallCount = 0;
  let sourceCallCount = 0;

  globalThis.fetch = async (url, init = {}) => {
    if (url === "https://api.openai.com/v1/chat/completions") {
      aiCallCount += 1;
      const body = JSON.parse(init.body);
      const prompt = body.messages[1].content;
      if (prompt.includes("Resolve the concept")) {
        return mockResponse({
          choices: [{ message: { content: JSON.stringify({ label: "Gnawa", description: "Music tradition", aliases: ["Gnaoua"] }) } }]
        });
      }
      const candidateJson = prompt.split("Candidates:\n")[1];
      const candidates = JSON.parse(candidateJson);
      return mockResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              evaluations: candidates.map((_, index) => ({
                candidateIndex: index,
                termRelated: true,
                pass: true,
                reason: "Direct match"
              }))
            })
          }
        }]
      });
    }

    sourceCallCount += 1;
    // Return 8 items per search
    const pages = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [String(id), {
      pageid: id,
      title: `File:Gnawa performance ${id}.jpg`,
      imageinfo: [{
        url: `https://upload.wikimedia.org/gnawa-${id}.jpg`,
        thumburl: `https://upload.wikimedia.org/gnawa-${id}-thumb.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Gnawa_performance_${id}.jpg`,
        width: 1200,
        height: 800,
        mime: "image/jpeg",
        extmetadata: {
          LicenseShortName: { value: "Public domain" },
          Artist: { value: "OpenScroll artist" },
          ImageDescription: { value: "Gnawa musician in Essaouira" },
          Categories: { value: "Gnawa" }
        }
      }]
    }]));
    return mockResponse({ query: { pages }, continue: { sroffset: 8 } });
  };

  try {
    // 1. Initial Page: pageSize = 2
    let metrics1;
    const page1 = await composeSearchFeed(
      { interest: "Gnawa music", mediaTypes: ["images"], pageSize: 2, seed: 42 },
      { store, onMetrics: (m) => { metrics1 = m; } }
    );

    assert.equal(page1.items.length, 2);
    assert.ok(page1.continuation);
    assert.equal(page1.pagination.hasMore, true);
    assert.equal(metrics1.counters.droppedAccepted, 0, "No accepted candidate should be dropped");
    assert.ok(metrics1.counters.pending > 0, "Overflow candidates are preserved in pendingAccepted");

    const sessionAfterP1 = await store.get(parseContinuationToken(page1.continuation).sessionId);
    assert.ok(sessionAfterP1.pendingAccepted.length > 0);
    assert.equal(sessionAfterP1.deliveredIds.length, 2);

    const aiCallsAfterP1 = aiCallCount;
    const sourceCallsAfterP1 = sourceCallCount;

    // 2. Next Page: requested with continuation: page1.continuation
    let metrics2;
    const page2 = await composeSearchFeed(
      { continuation: page1.continuation, pageSize: 2 },
      { store, onMetrics: (m) => { metrics2 = m; } }
    );

    assert.equal(page2.items.length, 2);
    assert.ok(page2.continuation);
    assert.equal(metrics2.status, "ok");
    // Page 2 should be fulfilled entirely from pendingAccepted: NO extra AI or source calls needed!
    assert.equal(aiCallCount, aiCallsAfterP1, "Page 2 should consume pending pool without new AI calls");
    assert.equal(sourceCallCount, sourceCallsAfterP1, "Page 2 should consume pending pool without new source calls");

    // Delivered IDs must not overlap (no duplicate cards delivered across pages)
    const p1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      assert.equal(p1Ids.has(item.id), false, `Item ${item.id} from page 2 was already delivered in page 1`);
    }

    // 3. Idempotent Retry: Replaying page 1 continuation before page 2 was committed
    // Replaying page1.continuation returns the exact same page 2 items without losing cards!
    const page2Retry = await composeSearchFeed(
      { continuation: page1.continuation, pageSize: 2 },
      { store }
    );
    assert.deepEqual(page2Retry.items.map((i) => i.id), page2.items.map((i) => i.id), "Replaying interrupted batch is idempotent");

  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = prevModel;
  }
});

test("continuation expiry throws 410 ContinuationExpiredError with canRestart", async () => {
  const store = new MemoryFeedContinuationStore();
  const token = createContinuationToken("non-existent-session", 1);

  await assert.rejects(
    composeSearchFeed({ continuation: token }, { store }),
    (err) => {
      assert.equal(err instanceof ContinuationExpiredError, true);
      assert.equal(err.status, 410);
      assert.equal(err.code, "CONTINUATION_EXPIRED");
      assert.equal(err.canRestart, true);
      return true;
    }
  );
});

test("persists exhaustion when sources and pending items are exhausted without restarting empty searches", async () => {
  const store = new MemoryFeedContinuationStore();
  const state = createFeedContinuationState({
    id: "exhausted-session",
    query: "Exhausted query",
    mediaTypes: ["images"],
    searchPlan: { rawQuery: "Exhausted query", variants: { images: [{ key: "img-1", query: "Exhausted" }] } }
  });
  state.exhausted = true;
  state.exhaustedPairs = ["images:img-1"];
  state.pendingAccepted = [];
  state.deliveredIds = ["uco:1", "uco:2"];
  await store.put(state.id, state);

  const token = createContinuationToken("exhausted-session", 1);
  const result = await composeSearchFeed({ continuation: token }, { store });

  assert.equal(result.items.length, 0);
  assert.equal(result.pagination.hasMore, false);
  assert.equal(result.pagination.nextCursor, null);
  assert.equal(result.sourceHasMore, false);
});
