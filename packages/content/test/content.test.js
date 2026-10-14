import assert from "node:assert/strict";
import test from "node:test";
import {
  EPIC_C_CONNECTORS,
  EPIC_C_RAW_ITEMS,
  SOURCE_REGISTRY,
  canonicalMoroccoSample,
  createConnector,
  createSourceRegistry,
  createUniversalContentObject,
  runConnectorConformance,
  runIngestion,
  validateSourceRecord,
  validateUniversalContentObject,
} from "../src/index.js";

test("OS-013 Universal Content Objects validate every canonical section with field provenance", () => {
  for (const object of canonicalMoroccoSample) {
    const validation = validateUniversalContentObject(object);
    assert.equal(validation.valid, true, validation.errors.join("; "));
    for (const path of ["identity.sourceItemId", "content.title", "creator.names", "media", "source"]) {
      assert.ok(object.system.provenance[path], `${path} provenance is required`);
    }
    assert.ok(object.identity.sourceItemId);
    assert.ok(object.creator.names.length);
    assert.equal(object.schemaVersion, "uco.v2");
    assert.equal(object.rights, undefined);
  }
});

test("OS-014 Source Registry stores behavior, quality, refresh, terms, and health", () => {
  const registry = createSourceRegistry();
  assert.equal(registry.records.length, 10);
  assert.deepEqual([...registry.connectorIds].sort(), ["cultural-aggregators", "openverse", "wikimedia-commons", "wikimedia-knowledge"].sort());
  for (const source of SOURCE_REGISTRY) {
    const validation = validateSourceRecord(source);
    assert.equal(validation.valid, true, `${source.id}: ${validation.errors.join("; ")}`);
    assert.equal(source.rightsModel, undefined);
    assert.equal(source.registryVersion, 2);
    assert.ok(source.terms.url);
    assert.ok(source.refresh.cadence);
    assert.ok(source.health.status);
  }
});

test("article content preserves reading text, sections, and images through UCO normalization", () => {
  const article = createUniversalContentObject({
    ...EPIC_C_RAW_ITEMS[0],
    type: "article",
    content: {
      type: "reader",
      text: "The article begins with an accessible lead.",
      sections: [{ heading: "History", content: "The article continues with its first section." }],
      images: [{ url: "https://example.org/article-image.jpg", altText: "An archival scene", caption: "Archival scene" }]
    },
    media: {
      kind: "image",
      url: "https://example.org/article-image.jpg",
      accessibility: { altText: "An archival scene" }
    }
  });

  assert.equal(article.content.type, "article");
  assert.equal(article.content.text, "The article begins with an accessible lead.");
  assert.equal(article.content.sections[0].heading, "History");
  assert.equal(article.content.images[0].altText, "An archival scene");
});

test("article content preserves full text line breaks for in-app reading", () => {
  const article = createUniversalContentObject({
    ...EPIC_C_RAW_ITEMS[0],
    type: "article",
    content: {
      type: "reader",
      text: "Overview",
      fullText: "Overview\n\nHistory\nThe article continues here."
    }
  });

  assert.equal(article.content.fullText, "Overview\n\nHistory\nThe article continues here.");
});

test("OS-015 through OS-020 connectors pass the SDK conformance suite", async () => {
  const results = await Promise.all(EPIC_C_CONNECTORS.map((connector) => runConnectorConformance(connector, { query: "Morocco" })));
  for (const result of results) assert.equal(result.passed, true, `${result.connectorId}: ${JSON.stringify(result.checks)}`);
  assert.ok(results.find((result) => result.connectorId === "wikimedia-knowledge").objects.some((object) => object.source.id === "wiktionary"));
  assert.ok(results.find((result) => result.connectorId === "wikimedia-commons").objects.some((object) => object.media.kind === "video"));
  assert.equal(results.find((result) => result.connectorId === "openverse").objects.length, 3);
  assert.ok(results.find((result) => result.connectorId === "cultural-aggregators").objects.some((object) => object.source.id === "europeana"));
});

test("OS-016 ingestion is idempotent, accepts usable candidates, and isolates connector failures", async () => {
  const run = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  const rerun = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  assert.equal(run.status, "complete");
  assert.deepEqual(run.objects.map((object) => object.id), rerun.objects.map((object) => object.id));
  assert.ok(run.checkpoints.length >= 4);
  assert.equal(run.rejected.length, 0);
  assert.equal(run.reviewQueue, undefined);

  const failing = createConnector({
    ...EPIC_C_CONNECTORS[0],
    id: "failing-fixture",
    sourceIds: ["wikipedia"],
    async search() { throw new Error("source schema changed"); }
  });
  const partial = await runIngestion({ connectors: [failing, EPIC_C_CONNECTORS[1]], query: "Morocco", maxRetries: 1 });
  assert.equal(partial.status, "partial");
  assert.equal(partial.deadLetters[0].connectorId, "failing-fixture");
  assert.ok(partial.objects.some((object) => object.source.id === "wikimedia-commons"));
});

test("Epic C content platform excludes consumer accounts and publishing vocabulary", () => {
  const serialized = JSON.stringify({ SOURCE_REGISTRY, canonicalMoroccoSample });
  assert.doesNotMatch(serialized, /\b(login|account prompt|consumer account|publish|upload|post|comment|profile)s?\b/i);
});

test("license metadata never controls UCO eligibility; invalid identity still fails", () => {
  for (const rights of [undefined, { licenseId: "unknown" }, { licenseId: "cc-by-nc-4.0", sourceVerified: false }]) {
    const raw = { ...EPIC_C_RAW_ITEMS[0], rights };
    const object = createUniversalContentObject(raw);
    assert.equal(validateUniversalContentObject(object).valid, true);
    assert.equal(object.rights, undefined);
    assert.equal(object.system.provenance.rights, undefined);
    assert.equal(object.canonicalUrl, raw.canonicalUrl || raw.sourceUrl);
    assert.equal(object.identity.sourceItemId, raw.sourceItemId);
    assert.deepEqual(object.creator.names, raw.creators);
    assert.equal(validateUniversalContentObject({ ...object, identity: {} }).valid, false);
    assert.equal(validateUniversalContentObject({ ...object, source: { id: "unknown" } }).valid, false);
  }
});

test("generated provenance and capture time survive normalization without rights", () => {
  const object = createUniversalContentObject({ ...EPIC_C_RAW_ITEMS[0], provenance: { origin: "generated", capturedAt: "2026-10-14T12:00:00.000Z" } });
  assert.equal(object.system.origin, "generated");
  assert.equal(object.time.retrievedAt, "2026-10-14T12:00:00.000Z");
});

test("ingestion rejects invalid records without requiring extractRights", async () => {
  const connector = createConnector({ ...EPIC_C_CONNECTORS[0], async normalize(record) {
    const object = createUniversalContentObject(record);
    return { ...object, identity: {} };
  } });
  assert.equal(connector.extractRights, undefined);
  const run = await runIngestion({ connectors: [connector] });
  assert.equal(run.objects.length, 0);
  assert.ok(run.rejected.length > 0);
  assert.match(run.rejected[0].reason, /identity/);
  const conformance = await runConnectorConformance(connector);
  assert.equal(conformance.passed, false);
  assert.equal(conformance.objects.length, 0);
});
