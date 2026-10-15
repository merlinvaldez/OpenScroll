import test from "node:test";
import assert from "node:assert/strict";
import { createFeedMetrics, reportFeedMetrics } from "../src/feed-metrics.js";
import { composeSearchFeed } from "../src/feed-search.js";
import { searchCommonsLive } from "../src/source-connectors.js";
import { summarizeRuns, estimateCost } from "../../../scripts/feed-baseline-summary.mjs";

test("metrics accumulate phase wall time, provider usage and request-local counters", async () => {
  let clock = 10;
  const metrics = createFeedMetrics({ now: () => clock });
  await metrics.measure("retrieval", async () => { clock += 20; });
  await metrics.measure("retrieval", async () => { clock += 5; });
  metrics.increment("visible", 2);
  metrics.increment("aiCalls");
  metrics.addUsage({ model: "test", usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 20 } } }, "requested");
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.phasesMs.retrieval, 25);
  assert.equal(snapshot.fullPageMs, 25);
  assert.equal(snapshot.firstCardReadyMs, 25);
  assert.equal(createFeedMetrics().snapshot().counters.visible, 0);
  assert.equal(estimateCost(snapshot, { test: { input: 2, cachedInput: 1, output: 3 } }), 0.00021);
  assert.equal(estimateCost(snapshot, null), null);
  assert.doesNotThrow(() => reportFeedMetrics(() => { throw new Error("observer"); }, metrics, "ok"));
});

test("failed feed records metrics without replacing the error", async () => {
  let metrics;
  await assert.rejects(composeSearchFeed({ interest: "" }, { onMetrics: (value) => { metrics = value; } }), /search term/);
  assert.equal(metrics.status, "error");
  assert.equal(metrics.counters.pipelineFailures, 1);
  assert.equal(metrics.firstCardReadyMs, null);
  await assert.rejects(composeSearchFeed({}, { onMetrics: () => { throw new Error("observer"); } }), /search term/);
});

test("source failures are visible in telemetry and return failed batch", async () => {
  const originalFetch = globalThis.fetch;
  const metrics = createFeedMetrics();
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    const batch = await searchCommonsLive("test", 5, { metrics, maxRetries: 0 });
    assert.equal(batch.length, 0);
    assert.equal(batch.status, "failed");
    assert.equal(batch.failure?.kind, "rate-limited");
    assert.equal(batch.failure?.status, 429);
    assert.equal(metrics.snapshot().counters.sourceCalls, 1);
    assert.equal(metrics.snapshot().counters.sourceFailures, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("baseline summary excludes failed sources and null first-card timings", () => {
  const runs = [10, 20, 100].map((fullPageMs) => ({ temperature: "first", metrics: {
    status: "ok", fullPageMs, firstCardReadyMs: fullPageMs,
    counters: { visible: 1, sourceFailures: fullPageMs === 100 ? 1 : 0, sourceCalls: 2, aiCalls: 1 }
  } }));
  const summary = summarizeRuns(runs).first;
  assert.equal(summary.attempts, 3);
  assert.equal(summary.successful, 2);
  assert.equal(summary.medianFullPageMs, 15);
  assert.equal(summary.p95FullPageMs, 20);
  assert.equal(summarizeRuns([]).repeat.medianFirstCardReadyMs, null);
});
