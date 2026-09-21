import test from "node:test";
import assert from "node:assert/strict";
import { fetchWikipediaArticleLive, queryLiveConnectors, searchWikipediaLive, searchCommonsLive } from "../src/index.js";

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

test("full Wikipedia article fetch returns the complete plaintext article", async () => {
  const originalFetch = globalThis.fetch;
  const articleText = "Overview paragraph.\n\nHistory\nThe full article continues beyond the overview.";
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (new URL(url).searchParams.get("action") === "parse") {
      return {
        ok: true,
        json: async () => ({ parse: { text: { "*": "<p>Overview paragraph.</p><h2>History</h2><ul><li>The full article continues.</li></ul>" } } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            "42": {
              pageid: 42,
              title: "OpenScroll",
              fullurl: "https://en.wikipedia.org/wiki/OpenScroll",
              extract: articleText
            }
          }
        }
      })
    };
  };

  try {
    const item = await fetchWikipediaArticleLive("OpenScroll");
    assert.equal(item.content.fullText, articleText);
    assert.match(item.content.html, /<h2>History<\/h2>/);
    assert.equal(item.content.sections.length, 0);
    assert.ok(calls.some((url) => url.includes("explaintext=1")));
    assert.ok(calls.some((url) => url.includes("action=parse")));
  } finally {
    globalThis.fetch = originalFetch;
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

test("Commons media classification uses MIME types and requests thumbnails", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const mediaCases = [
    { extension: "ogg", mime: "application/ogg", mediatype: "VIDEO", kind: "video" },
    { extension: "ogg", mime: "audio/ogg", kind: "audio" },
    { extension: "mid", mime: "audio/midi", kind: "audio" },
    { extension: "mpeg", mime: "video/mpeg", kind: "video" },
    { extension: "txt", mime: "text/plain", mediatype: "TEXT", kind: "text" },
    { extension: "zip", mime: "application/zip", mediatype: "ARCHIVE", kind: "data" }
  ];

  globalThis.fetch = async (url) => {
    calls.push(url);
    const pages = Object.fromEntries(mediaCases.map((item, index) => [String(index + 1), {
      pageid: index + 1,
      title: `File:Topic result ${index + 1}.${item.extension}`,
      imageinfo: [{
        url: `https://upload.wikimedia.org/topic-${index + 1}.${item.extension}`,
        thumburl: `https://upload.wikimedia.org/topic-${index + 1}-thumb.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Topic_result_${index + 1}`,
        width: 1200,
        height: 800,
        mime: item.mime,
        mediatype: item.mediatype,
        extmetadata: {
          LicenseShortName: { value: "CC BY 4.0" },
          Artist: { value: "OpenScroll test" },
          ImageDescription: { value: "A test media result" }
        }
      }]
    }]));

    return { ok: true, json: async () => ({ query: { pages } }) };
  };

  try {
    const items = await searchCommonsLive("Generated media", 4);
    assert.deepEqual(items.map((item) => item.media.kind), mediaCases.map((item) => item.kind));
    assert.ok(items.every((item) => item.media.thumbnailUrl?.endsWith("-thumb.jpg")));
    assert.match(calls[0], /iiurlwidth=640/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Commons media searches add a type-specific file filter", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ query: { pages: {} } }) };
  };

  try {
    await Promise.all([
      searchCommonsLive("Generated media", 2, { mediaType: "image" }),
      searchCommonsLive("Generated media", 2, { mediaType: "audio" }),
      searchCommonsLive("Generated media", 2, { mediaType: "video" }),
      searchCommonsLive("Generated media", 2, { mediaType: "text" }),
      searchCommonsLive("Generated media", 2, { mediaType: "data" })
    ]);

    const decodedCalls = calls.map((url) => decodeURIComponent(url));
    assert.equal(decodedCalls.length, 5);
    assert.ok(decodedCalls.some((url) => url.includes("filetype:bitmap")));
    assert.ok(decodedCalls.some((url) => url.includes("filetype:audio")));
    assert.ok(decodedCalls.some((url) => url.includes("filetype:video")));
    assert.ok(decodedCalls.some((url) => url.includes("filetype:text")));
    assert.ok(decodedCalls.some((url) => url.includes("filetype:office OR filetype:archive OR filetype:3d")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
