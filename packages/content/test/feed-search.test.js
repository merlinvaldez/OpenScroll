import test from "node:test";
import assert from "node:assert/strict";
import { composeSearchFeed } from "../src/feed-search.js";

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test("composed feed uses expanded Commons variants, main evaluator, and progress phases", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  const requests = [];
  const phases = [];
  let metrics;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-6-luna";

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
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
            text: JSON.stringify({ label: "Gnawa", description: "A music tradition.", aliases: ["Gnaoua"] })
          }]
        }],
        usage: { input_tokens: 20, output_tokens: 15, total_tokens: 35 }
      });
    }

    if (url === "https://api.openai.com/v1/decisions") {
      const body = JSON.parse(init.body);
      const answers = (body.questions || []).map((q) => ({
        type: "predicate",
        name: q.name,
        probability: 0.95
      }));
      return mockResponse({
        model: "gpt-6-luna",
        answers,
        usage: { input_tokens: 40, output_tokens: 0, total_tokens: 40 }
      });
    }

    const pages = Object.fromEntries([1, 2].map((pageid) => [String(pageid), {
      pageid,
      title: `File:Gnawa result ${pageid}.jpg`,
      imageinfo: [{
        url: `https://upload.wikimedia.org/gnawa-${pageid}.jpg`,
        thumburl: `https://upload.wikimedia.org/gnawa-${pageid}-thumb.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Gnawa_result_${pageid}.jpg`,
        width: 1200,
        height: 800,
        mime: "image/jpeg",
        extmetadata: {
          LicenseShortName: { value: "Public domain" },
          Artist: { value: "OpenScroll test" },
          ImageDescription: { value: "A Gnawa performance." },
          Categories: { value: "Gnawa|Music festivals" }
        }
      }]
    }]));
    return mockResponse({ query: { pages } });
  };

  try {
    const result = await composeSearchFeed({ interest: "Gnawa music Morocco", mediaTypes: ["images"], pageSize: 5, seed: 1 }, {
      onProgress: (progress) => phases.push(progress.phase),
      onMetrics: (value) => { metrics = value; }
    });

    assert.equal(requests.filter((request) => request.url === "https://api.openai.com/v1/responses").length, 1);
    assert.equal(requests.filter((request) => request.url === "https://api.openai.com/v1/decisions").length, 1);
    assert.ok(result.searchPlan.variants.images.length >= 4);
    assert.ok(result.items.length > 0);
    assert.deepEqual([...new Set(phases)], ["planning", "retrieving", "evaluating", "composing"]);
    assert.equal(result.items[0].knowledge.retrieval.categories[0], "Gnawa");
    assert.equal(result.items[0].knowledge.topics[0], "Gnawa");
    assert.equal(metrics.status, "ok");
    assert.equal(metrics.counters.aiCalls, 2);
    assert.equal(metrics.counters.sourceCalls, result.searchPlan.variants.images.length);
    assert.equal(metrics.counters.rawResults, metrics.counters.sourceCalls * 2);
    assert.equal(metrics.counters.normalizedCandidates, metrics.counters.rawResults);
    assert.equal(metrics.counters.duplicates, metrics.counters.rawResults - 2);
    assert.equal(metrics.counters.accepted, 2);
    assert.equal(metrics.counters.visible, result.items.length);
    assert.equal(metrics.counters.sourceFailures, 0);
    assert.equal(metrics.estimatedCostUsd, null);
    assert.ok(metrics.fullPageMs >= Object.values(metrics.phasesMs).reduce((a, b) => a + b, 0) - 0.1);
    assert.equal(Object.hasOwn(result, "metrics"), false);
    let reusedMetrics;
    const repeated = await composeSearchFeed({ interest: "Gnawa music Morocco", mediaTypes: ["images"], pageSize: 1, seed: 1, searchPlan: result.searchPlan }, {
      onMetrics: (value) => { reusedMetrics = value; },
      onCandidates: () => { throw new Error("diagnostic callback failed"); }
    });
    assert.equal(repeated.items.length, 1);
    assert.equal(reusedMetrics.counters.planReuses, 1);
    assert.equal(reusedMetrics.counters.aiCalls, 1);
    assert.equal(reusedMetrics.counters.pending, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});
