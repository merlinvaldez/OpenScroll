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
