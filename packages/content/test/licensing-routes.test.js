import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
// Resolve Next's bundler-style import for standalone Node while exercising the real handlers.
async function loadRoute(path) {
  let code = await readFile(new URL(`../../../app/api/${path}`, import.meta.url), "utf8");
  code = code.replace('"next/server"', JSON.stringify(import.meta.resolve("next/server.js")))
    .replace('"@openscroll/content"', JSON.stringify(import.meta.resolve("@openscroll/content")));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { GET: itemGET } = await loadRoute("item/%255B...id%255D/route.js");
const { GET: articleGET } = await loadRoute("article/route.js");

test("item routes return formerly license-blocked records as v2 with source identity", async () => {
  for (const id of ["openverse-rejected-nc", "openverse-review-unverified"]) {
    const response = await itemGET(new Request("http://localhost/api/item"), { params: Promise.resolve({ id: [id] }) });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.item.schemaVersion, "uco.v2");
    assert.ok(data.item.identity.sourceRecordUrl);
    assert.ok(data.item.creator.names.length);
    assert.equal(data.item.rights, undefined);
    assert.equal(data.rightsSnapshot, undefined);
    assert.equal(data.attribution, undefined);
  }
});

test("article route preserves reading content without dereferencing removed rights", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => new URL(url).searchParams.get("action") === "parse"
    ? { parse: { text: { "*": "<p>Full article</p>" } } }
    : { query: { pages: { "42": { pageid: 42, title: "Topic", fullurl: "https://en.wikipedia.org/wiki/Topic", extract: "Full article" } } } } });
  try {
    const response = await articleGET(new Request("http://localhost/api/article?title=Topic"));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.item.schemaVersion, "uco.v2");
    assert.equal(data.item.content.fullText, "Full article");
    assert.equal(data.item.rights, undefined);
    assert.equal(data.canonicalUrl, "https://en.wikipedia.org/wiki/Topic");
  } finally { globalThis.fetch = originalFetch; }
});

test("root and workspace article/item entry points stay synchronized", async () => {
  for (const path of ["article/route.js", "item/%255B...id%255D/route.js"]) {
    const [root, workspace] = await Promise.all([
      readFile(new URL(`../../../app/api/${path}`, import.meta.url), "utf8"),
      readFile(new URL(`../../../apps/web/src/app/api/${path}`, import.meta.url), "utf8")
    ]);
    assert.equal(root.replaceAll("\r\n", "\n"), workspace.replaceAll("\r\n", "\n"));
  }
});
