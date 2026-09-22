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
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === "https://api.openai.com/v1/chat/completions") {
      const body = JSON.parse(init.body);
      const prompt = body.messages[1].content;
      if (prompt.includes("Resolve the concept")) {
        return mockResponse({
          choices: [{ message: { content: JSON.stringify({ label: "Gnawa", description: "A music tradition.", aliases: ["Gnaoua"] }) } }]
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
                reason: "The candidate matches the requested topic."
              }))
            })
          }
        }]
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
      onProgress: (progress) => phases.push(progress.phase)
    });

    assert.ok(requests.filter((request) => request.url === "https://api.openai.com/v1/chat/completions").length >= 2);
    assert.ok(result.searchPlan.variants.images.length >= 4);
    assert.ok(result.items.length > 0);
    assert.deepEqual([...new Set(phases)], ["planning", "retrieving", "evaluating", "composing"]);
    assert.equal(result.items[0].knowledge.retrieval.categories[0], "Gnawa");
    assert.equal(result.items[0].knowledge.topics[0], "Gnawa");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});
