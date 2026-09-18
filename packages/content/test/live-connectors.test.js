import test from "node:test";
import assert from "node:assert/strict";
import { queryLiveConnectors, searchWikipediaLive, searchCommonsLive } from "../src/index.js";

test("live Wikipedia search returns real, rich reader UCO items", async () => {
  const items = await searchWikipediaLive("Tokyo", 3);
  if (items.length > 0) {
    const first = items[0];
    assert.ok(first.id.startsWith("wikipedia:"));
    assert.ok(first.title);
    assert.equal(first.content.type, "reader");
    assert.ok(first.content.text.length > 20);
    assert.equal(first.rights.licenseId, "CC-BY-SA-4.0");
    assert.ok(first.rights.attributionNotice.text.includes("Wikipedia contributors"));
  }
});

test("live Wikimedia Commons search returns real media items with license metadata", async () => {
  const items = await searchCommonsLive("Renaissance Art", 4);
  if (items.length > 0) {
    const first = items[0];
    assert.ok(first.id.startsWith("wikimedia-commons:"));
    assert.ok(first.media?.url);
    assert.ok(first.rights.licenseId);
  }
});

test("queryLiveConnectors aggregates across multiple live sources and falls back safely", async () => {
  const items = await queryLiveConnectors("Quantum Mechanics");
  assert.ok(items.length > 0, "must return items for any topic");
  for (const item of items) {
    const title = item.content?.title || item.title;
    assert.ok(title, "must have title");
    assert.ok(item.rights, "must have rights passport");
  }
});

test("queryLiveConnectors can fetch exactly five Commons results without fixture fallback", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const pages = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [String(index + 1), {
      pageid: index + 1,
      title: `File:Topic result ${index + 1}.jpg`,
      imageinfo: [{
        url: `https://commons.wikimedia.org/topic-${index + 1}.jpg`,
        thumburl: `https://commons.wikimedia.org/topic-${index + 1}-thumb.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Topic_result_${index + 1}.jpg`,
        width: 1200,
        height: 800,
        mime: "image/jpeg",
        extmetadata: {
          LicenseShortName: { value: "Public domain" },
          Artist: { value: "OpenScroll test" },
          ImageDescription: { value: "A test topic result" }
        }
      }]
    }]));

    return { ok: true, json: async () => ({ query: { pages } }) };
  };

  try {
    const items = await queryLiveConnectors("Generated topic", {
      sources: ["wikimedia-commons"],
      limit: 5,
      offset: 5,
      allowFixtureFallback: false
    });
    assert.equal(items.length, 5);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /commons\.wikimedia\.org/);
    assert.match(calls[0], /gsrlimit=5/);
    assert.match(calls[0], /gsroffset=5/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
