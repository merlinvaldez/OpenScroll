import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_BATCH_VERSION,
  SourceRequestError,
  createSourceBatch,
  failedSourceBatch,
  validateSourceBatch,
  fetchJsonWithRetry,
  normalizeSourceRecords,
  parseRetryAfter
} from "../src/index.js";

test("createSourceBatch constructs a valid batch with array interoperability", () => {
  const item = { id: "test:1", title: "Test item" };
  const batch = createSourceBatch({
    sourceId: "wikimedia-commons",
    query: "test query",
    items: [item],
    rawCount: 1,
    continuation: { gsroffset: 10 }
  });

  assert.equal(batch.version, SOURCE_BATCH_VERSION);
  assert.equal(batch.sourceId, "wikimedia-commons");
  assert.equal(batch.query, "test query");
  assert.equal(batch.status, "ok");
  assert.equal(batch.rawCount, 1);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].id, "test:1");
  assert.deepEqual(batch.continuation, { gsroffset: 10 });
  assert.equal(batch.exhausted, false);
  assert.equal(batch.failure, null);

  // Array methods return normal Arrays
  const mapped = batch.map((i) => i.id);
  assert.deepEqual(mapped, ["test:1"]);
  assert.ok(Array.isArray(mapped));

  const validation = validateSourceBatch(batch);
  assert.equal(validation.valid, true);
});

test("failedSourceBatch preserves requested continuation for retrying", () => {
  const error = new SourceRequestError("rate-limited", "Rate limited", { status: 429, retryAfterMs: 3000 });
  const batch = failedSourceBatch({
    sourceId: "wikipedia",
    query: "search",
    error,
    requestContinuation: { sroffset: 20 }
  });

  assert.equal(batch.status, "failed");
  assert.equal(batch.length, 0);
  assert.equal(batch.failure?.kind, "rate-limited");
  assert.equal(batch.failure?.retryable, true);
  assert.equal(batch.failure?.status, 429);
  assert.equal(batch.failure?.retryAfterMs, 3000);
  assert.deepEqual(batch.continuation, { sroffset: 20 });
  assert.equal(batch.exhausted, false);
});

test("fetchJsonWithRetry enforces per-attempt timeouts and body reading deadlines", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (url, opts) => {
    attempts += 1;
    return new Promise((resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  };

  try {
    await assert.rejects(
      fetchJsonWithRetry("https://example.org/api", {
        timeoutMs: 10,
        maxRetries: 1,
        baseDelayMs: 5
      }),
      (err) => err instanceof SourceRequestError && err.kind === "timeout"
    );
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchJsonWithRetry retries 5xx server errors up to maxRetries", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) {
      return { ok: false, status: 503, headers: new Headers({ "retry-after": "0" }), json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };

  try {
    const data = await fetchJsonWithRetry("https://example.org/api", {
      maxRetries: 3,
      baseDelayMs: 1
    });
    assert.deepEqual(data, { success: true });
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchJsonWithRetry fails on malformed non-JSON body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError("Unexpected token < in JSON at position 0"); }
  });

  try {
    await assert.rejects(
      fetchJsonWithRetry("https://example.org/api", { maxRetries: 0 }),
      (err) => err instanceof SourceRequestError && err.kind === "malformed"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parseRetryAfter parses both delta-seconds and HTTP-date strings", () => {
  assert.equal(parseRetryAfter("12"), 12000);
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(null), null);
  const future = new Date(Date.now() + 5000).toUTCString();
  const parsed = parseRetryAfter(future);
  assert.ok(parsed >= 4000 && parsed <= 6000);
});

test("normalizeSourceRecords isolates invalid records and reports them explicitly", () => {
  const validRecord = {
    id: "wikipedia:1",
    sourceId: "wikipedia",
    sourceItemId: "1",
    canonicalUrl: "https://en.wikipedia.org/wiki/Test",
    sourceUrl: "https://en.wikipedia.org/wiki/Test",
    title: "Valid Title",
    content: { type: "reader", text: "Some article text here" },
    creators: [{ name: "Author", role: "author" }]
  };
  const malformedRecord = {
    sourceId: "wikipedia",
    // Missing title and required fields
    content: {}
  };

  const { items, invalid } = normalizeSourceRecords([validRecord, malformedRecord]);
  assert.equal(items.length, 1);
  assert.equal(items[0].content.title, "Valid Title");
  assert.equal(invalid.length, 1);
  assert.ok(invalid[0].reason.length > 0);
});
