import test from "node:test";
import assert from "node:assert/strict";
import { expandTopics, resolveEntity, buildQueryPlan } from "../src/topic-engine.js";

function graphResponse() {
  return {
    entity: {
      label: "Morocco",
      description: "A country in North Africa with layered Amazigh, Arab, African, Mediterranean, and Atlantic histories.",
      aliases: ["Morocco", "Kingdom of Morocco"]
    },
    categories: [
      { categoryId: "sacred-practices", categoryLabel: "Sacred Practices and Ritual Life", categoryDescription: "Religious and ceremonial traditions connected to the query.", icon: "sparkles", color: "#ec4899" },
      { categoryId: "trade-diaspora", categoryLabel: "Trade Routes and Diaspora", categoryDescription: "Movement, exchange, and communities connected to the query.", icon: "compass", color: "#f59e0b" },
      { categoryId: "language-poetry", categoryLabel: "Language and Poetic Forms", categoryDescription: "Language, literature, and oral traditions connected to the query.", icon: "book-open", color: "#6366f1" },
      { categoryId: "built-landscapes", categoryLabel: "Built Landscapes and Memory", categoryDescription: "Places and material culture connected to the query.", icon: "landmark", color: "#10b981" },
      { categoryId: "living-craft", categoryLabel: "Living Craft and Performance", categoryDescription: "Contemporary cultural practice connected to the query.", icon: "music", color: "#8b5cf6" }
    ].map((category) => ({
      ...category,
      topics: [
        { name: `${category.categoryLabel} topic one`, description: "A specific concept returned by OpenAI.", weight: 1, icon: category.icon },
        { name: `${category.categoryLabel} topic two`, description: "Another specific concept returned by OpenAI.", weight: 0.9, icon: category.icon },
        { name: `${category.categoryLabel} topic three`, description: "A third specific concept returned by OpenAI.", weight: 0.8, icon: category.icon }
      ]
    }))
  };
}

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function withMockedFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("topic expansion uses OpenAI output and builds the mindmap", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse({ choices: [{ message: { content: JSON.stringify(graphResponse()) } }] });
  });

  try {
    const expanded = await expandTopics("Morocco", { apiKey: "test-key", model: "test-model" });
    assert.equal(expanded.entity.label, "Morocco");
    assert.equal(expanded.source, "OpenAI (test-model)");
    assert.equal(expanded.categories.length, 5);
    assert.equal(expanded.categories[0].categoryLabel, "Sacred Practices and Ritual Life");
    assert.ok(expanded.mindmap.nodes.length >= 16);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(requests[0].init.headers.Authorization, "Bearer test-key");
    const requestBody = JSON.parse(requests[0].init.body);
    assert.equal(requestBody.temperature, undefined);
    assert.match(requestBody.messages[1].content, /Generate the category IDs, labels, and descriptions/);
    assert.match(requestBody.messages[1].content, /do not use a fixed taxonomy/);
  } finally {
    restore();
  }
});

test("OpenAI failures are surfaced instead of falling back", async () => {
  const restore = withMockedFetch(async () => mockResponse({ error: { message: "model unavailable" } }, 503));

  try {
    await assert.rejects(
      () => expandTopics("Jazz", { apiKey: "test-key", model: "test-model" }),
      /model unavailable/
    );
  } finally {
    restore();
  }
});

test("topic expansion fails when the OpenAI key is not configured", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () => expandTopics("Ancient Egypt", { model: "test-model" }),
      /OPENAI_API_KEY is required/
    );
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("entity resolution also uses OpenAI only", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse({
      choices: [{ message: { content: JSON.stringify({ label: "Jazz", description: "A musical tradition.", aliases: ["Jazz music"] }) } }]
    });
  });

  try {
    const entity = await resolveEntity("Jazz", { apiKey: "test-key", model: "test-model" });
    assert.equal(entity.label, "Jazz");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.openai.com/v1/chat/completions");
  } finally {
    restore();
  }
});

test("query planner constructs multi-source search vectors", () => {
  const entity = { id: "AI-morocco", label: "Morocco" };
  const plan = buildQueryPlan(entity, ["Gnawa", "Architecture", "Darija"], "en");
  assert.equal(plan.entityLabel, "Morocco");
  assert.ok(plan.searchTerms.wikimedia.includes("Gnawa"));
  assert.ok(plan.searchTerms.commons.includes("Morocco"));
});
