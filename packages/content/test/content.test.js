import assert from "node:assert/strict";
import test from "node:test";
import {
  EPIC_C_CONNECTORS,
  SOURCE_REGISTRY,
  canonicalMoroccoSample,
  createConnector,
  createSourceRegistry,
  createUniversalContentObject,
  evaluateRights,
  runConnectorConformance,
  runIngestion,
  validateSourceRecord,
  validateUniversalContentObject
} from "../src/index.js";

test("OS-013 Universal Content Objects validate every canonical section with field provenance", () => {
  for (const object of canonicalMoroccoSample) {
    const validation = validateUniversalContentObject(object);
    assert.equal(validation.valid, true, validation.errors.join("; "));
    for (const path of ["identity.sourceItemId", "content.title", "creator.names", "media", "rights", "source"]) {
      assert.ok(object.system.provenance[path], `${path} provenance is required`);
    }
    assert.ok(object.identity.sourceItemId);
    assert.ok(object.creator.names.length);
    assert.ok(object.rights.eligibility === "eligible");
  }
});

test("OS-014 Source Registry stores behavior, rights, quality, refresh, terms, and health", () => {
  const registry = createSourceRegistry();
  assert.equal(registry.records.length, 10);
  assert.deepEqual([...registry.connectorIds].sort(), ["cultural-aggregators", "openverse", "wikimedia-commons", "wikimedia-knowledge"].sort());
  for (const source of SOURCE_REGISTRY) {
    const validation = validateSourceRecord(source);
    assert.equal(validation.valid, true, `${source.id}: ${validation.errors.join("; ")}`);
    assert.ok(source.rightsModel.verifyAtSource);
    assert.ok(source.rightsModel.failClosed);
    assert.ok(source.terms.url);
    assert.ok(source.refresh.cadence);
    assert.ok(source.health.status);
  }
});

test("OS-015 through OS-020 connectors pass the SDK conformance suite", async () => {
  const results = await Promise.all(EPIC_C_CONNECTORS.map((connector) => runConnectorConformance(connector, { query: "Morocco" })));
  for (const result of results) assert.equal(result.passed, true, `${result.connectorId}: ${JSON.stringify(result.checks)}`);
  assert.ok(results.find((result) => result.connectorId === "wikimedia-knowledge").objects.some((object) => object.source.id === "wiktionary"));
  assert.ok(results.find((result) => result.connectorId === "wikimedia-commons").objects.some((object) => object.media.kind === "video"));
  assert.ok(results.find((result) => result.connectorId === "openverse").rejected.some((item) => item.reason === "incompatible-license"));
  assert.ok(results.find((result) => result.connectorId === "cultural-aggregators").objects.some((object) => object.source.id === "europeana"));
});

test("OS-016 ingestion is idempotent, rejects unverifiable candidates, and isolates connector failures", async () => {
  const run = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  const rerun = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  assert.equal(run.status, "complete");
  assert.deepEqual(run.objects.map((object) => object.id), rerun.objects.map((object) => object.id));
  assert.ok(run.checkpoints.length >= 4);
  assert.ok(run.rejected.some((item) => item.reason === "incompatible-license"));

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

test("rights fail closed for unknown, noncommercial, or source-unverified inputs", () => {
  assert.equal(evaluateRights({ licenseId: "cc-by-nc-4.0", sourceVerified: true }).eligibility, "rejected");
  assert.equal(evaluateRights({ licenseId: "cc-by-4.0", sourceVerified: false }).eligibility, "rejected");
  assert.equal(evaluateRights({ licenseId: "cc0", sourceVerified: true }).eligibility, "eligible");
});

test("Epic C content platform excludes consumer accounts and publishing vocabulary", () => {
  const serialized = JSON.stringify({ SOURCE_REGISTRY, canonicalMoroccoSample });
  assert.doesNotMatch(serialized, /\b(login|account prompt|consumer account|publish|upload|post|comment|profile)s?\b/i);
});

test("invalid source and invalid rights do not pass Universal Content Object validation", () => {
  const object = createUniversalContentObject({
    id: "restricted",
    sourceId: "openverse",
    sourceItemId: "restricted",
    sourceUrl: "https://example.org/restricted",
    type: "image",
    title: "Restricted",
    creators: [{ name: "Unknown", role: "creator" }],
    media: { kind: "image", url: "https://example.org/restricted.jpg" },
    rights: { licenseId: "unknown", sourceVerified: false }
  });
  const validation = validateUniversalContentObject(object);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("rights")));
});
