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
      skipCache: true,
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

test("passes topic interpretation consistently through retrieval and Decisions evaluation", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const requests = [];
  process.env.OPENAI_API_KEY = "test-key";

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
            text: JSON.stringify({
              label: "Gnawa",
              description: "A Moroccan musical tradition.",
              aliases: ["Gnaoua", "Tagnaouite"],
              disambiguation: []
            })
          }]
        }]
      });
    }

    if (url === "https://api.openai.com/v1/decisions") {
      const body = JSON.parse(init.body);
      const answers = (body.questions || []).map((q) => ({
        type: "predicate",
        name: q.name,
        probability: 0.95
      }));
      return mockResponse({ model: "gpt-6-luna", answers });
    }

    const pages = {
      1: {
        pageid: 1,
        title: "File:Gnawa music ritual.jpg",
        imageinfo: [{
          url: "https://upload.wikimedia.org/gnawa-1.jpg",
          mime: "image/jpeg",
          extmetadata: { ImageDescription: { value: "Gnawa musicians in Essaouira" } }
        }]
      }
    };
    return mockResponse({ query: { pages } });
  };

  try {
    const result = await composeSearchFeed({
      interest: "Gnawa",
      mediaTypes: ["images"],
      pageSize: 1
    }, { skipCache: true });

    // Verify topic meaning is present on result
    assert.ok(result.topicMeaning, "Result must contain topicMeaning");
    assert.equal(result.topicMeaning.label, "Gnawa");
    assert.deepEqual(result.topicMeaning.aliases, ["Gnawa", "Gnaoua", "Tagnaouite"]);

    // Verify Decisions API received the exact topic meaning
    const decisionsReq = requests.find((r) => r.url === "https://api.openai.com/v1/decisions");
    assert.ok(decisionsReq, "Decisions request must be made");
    const decisionsBody = JSON.parse(decisionsReq.init.body);
    assert.match(decisionsBody.input, /Resolved topic meaning: Gnawa — A Moroccan musical tradition\./);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("article search items include preview image metadata when Wikipedia returns thumbnail without originalimage", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  globalThis.fetch = async (url, init = {}) => {
    if (url === "https://api.openai.com/v1/responses") {
      return mockResponse({
        id: "resp_entity",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  label: "Atlas Mountains",
                  description: "Mountain range in the Maghreb",
                  aliases: ["Idraren Draren"]
                })
              }
            ]
          }
        ]
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
        answers
      });
    }

    if (url.includes("api.php") && url.includes("list=search")) {
      return mockResponse({
        query: {
          search: [
            { title: "Atlas Mountains", pageid: 456 }
          ]
        }
      });
    }

    if (url.includes("/page/summary/")) {
      return mockResponse({
        type: "standard",
        title: "Atlas Mountains",
        pageid: 456,
        extract: "The Atlas Mountains are a mountain range in the Maghreb.",
        thumbnail: {
          source: "https://upload.wikimedia.org/atlas_thumb.jpg",
          width: 320,
          height: 240
        }
      });
    }

    return mockResponse({ query: { pages: {} } });
  };

  try {
    const result = await composeSearchFeed({
      interest: "Atlas Mountains",
      mediaTypes: ["text"],
      pageSize: 1
    }, { skipCache: true });

    assert.equal(result.items.length, 1);
    const article = result.items[0];
    assert.equal(article.content.type, "reader");
    assert.ok(article.media, "Article card must retain media when thumbnail is present");
    assert.equal(article.media.thumbnailUrl, "https://upload.wikimedia.org/atlas_thumb.jpg");
    assert.equal(article.content.images.length, 1);
    assert.equal(article.content.images[0].url, "https://upload.wikimedia.org/atlas_thumb.jpg");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("stable append-only delivered order: subsequent continuation batches never reshuffle delivered cards", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  globalThis.fetch = async (url, init = {}) => {
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
            text: JSON.stringify({ label: "Gnawa", description: "Music", aliases: [] })
          }]
        }]
      });
    }

    if (url === "https://api.openai.com/v1/decisions") {
      const body = JSON.parse(init.body);
      return mockResponse({
        model: "gpt-6-luna",
        answers: (body.questions || []).map((q) => ({ type: "predicate", name: q.name, probability: 0.9 }))
      });
    }

    // Return multiple distinct items
    return mockResponse({
      query: {
        pages: {
          1: { pageid: 1, title: "File:Gnawa 1.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/1.jpg", mime: "image/jpeg" }] },
          2: { pageid: 2, title: "File:Gnawa 2.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/2.jpg", mime: "image/jpeg" }] },
          3: { pageid: 3, title: "File:Gnawa 3.jpg", imageinfo: [{ url: "https://upload.wikimedia.org/3.jpg", mime: "image/jpeg" }] }
        }
      }
    });
  };

  try {
    // Page 1 (pageSize: 1)
    const page1 = await composeSearchFeed({ interest: "Gnawa", mediaTypes: ["images"], pageSize: 1, seed: 42 });
    assert.equal(page1.items.length, 1);
    const item1Id = page1.items[0].id;
    assert.ok(page1.continuation, "Page 1 must return a continuation token");

    // Page 2 (pageSize: 1 using continuation)
    const page2 = await composeSearchFeed({ continuation: page1.continuation, pageSize: 1 });
    assert.equal(page2.items.length, 1);
    const item2Id = page2.items[0].id;

    // Must be distinct items and not reshuffle
    assert.notEqual(item2Id, item1Id, "Subsequent continuation page must not re-deliver already delivered items");

    // Idempotent retry: replaying page1.continuation must return identical item2Id
    const replayPage2 = await composeSearchFeed({ continuation: page1.continuation, pageSize: 1 });
    assert.equal(replayPage2.items[0].id, item2Id, "Replaying continuation batch must return the exact same delivered item");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

