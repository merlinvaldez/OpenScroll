import assert from "node:assert/strict";
import test from "node:test";
import {
  EPIC_C_CONNECTORS,
  EPIC_C_RAW_ITEMS,
  SOURCE_REGISTRY,
  canonicalMoroccoSample,
  createConnector,
  createAttributionNotice,
  createOpenLicenseGateDecision,
  createRightsSafeDownloadPolicy,
  createSourceRegistry,
  createUniversalContentObject,
  evaluateRights,
  getLicenseRecord,
  normalizeLicenseId,
  openLicenseGate,
  runConnectorConformance,
  runIngestion,
  validateSourceRecord,
  validateUniversalContentObject,
  verifySourceRights
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
    assert.equal(source.rightsModel.reviewQueue, "rights-review");
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

test("OS-015 through OS-020 connectors pass the SDK conformance suite", async () => {
  const results = await Promise.all(EPIC_C_CONNECTORS.map((connector) => runConnectorConformance(connector, { query: "Morocco" })));
  for (const result of results) assert.equal(result.passed, true, `${result.connectorId}: ${JSON.stringify(result.checks)}`);
  assert.ok(results.find((result) => result.connectorId === "wikimedia-knowledge").objects.some((object) => object.source.id === "wiktionary"));
  assert.ok(results.find((result) => result.connectorId === "wikimedia-commons").objects.some((object) => object.media.kind === "video"));
  assert.ok(results.find((result) => result.connectorId === "openverse").rejected.some((item) => item.reason === "incompatible-license"));
  assert.ok(results.find((result) => result.connectorId === "openverse").reviewQueue.some((item) => item.reason === "source-verification-review"));
  assert.ok(results.find((result) => result.connectorId === "cultural-aggregators").objects.some((object) => object.source.id === "europeana"));
});

test("OS-016 ingestion is idempotent, rejects unverifiable candidates, and isolates connector failures", async () => {
  const run = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  const rerun = await runIngestion({ connectors: EPIC_C_CONNECTORS, query: "Morocco" });
  assert.equal(run.status, "complete");
  assert.deepEqual(run.objects.map((object) => object.id), rerun.objects.map((object) => object.id));
  assert.ok(run.checkpoints.length >= 4);
  assert.ok(run.rejected.some((item) => item.reason === "incompatible-license"));
  assert.ok(run.reviewQueue.some((item) => item.id.startsWith("rights-review:openverse")));

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
  assert.equal(evaluateRights({ licenseId: "cc-by-4.0", sourceVerified: false }).eligibility, "review");
  assert.equal(evaluateRights({ licenseId: "cc0", sourceVerified: true }).eligibility, "eligible");
});

test("OS-021 license ontology normalizes open, public-domain, and blocked licenses", () => {
  assert.equal(normalizeLicenseId("https://creativecommons.org/licenses/by-sa/4.0/"), "cc-by-sa-4.0");
  assert.equal(normalizeLicenseId("Public Domain Mark"), "public-domain-mark");
  assert.equal(getLicenseRecord("CC BY-NC 4.0").status, "blocked");
  assert.equal(getLicenseRecord("CC BY 4.0").status, "qualified-open");
});

test("OS-022 Open License Gate accepts qualified open items and fails closed otherwise", () => {
  const accepted = openLicenseGate({ licenseId: "cc-by-4.0", sourceVerified: true }, { sourceId: "wikipedia", sourceName: "Wikipedia" });
  const rejected = openLicenseGate({ licenseId: "cc-by-nc-4.0", sourceVerified: true }, { sourceId: "openverse", sourceName: "Openverse" });
  const review = openLicenseGate({ licenseId: "cc-by-4.0", sourceVerified: false, sourceUrl: "https://example.org/item" }, { sourceId: "openverse", sourceName: "Openverse" });
  assert.equal(accepted.decision, "accept");
  assert.equal(accepted.canEnterScroll, true);
  assert.equal(rejected.decision, "reject");
  assert.equal(review.decision, "review");
  assert.equal(review.canEnterScroll, false);
});

test("OS-023 item-level source verification records original-source evidence", () => {
  const verification = verifySourceRights(
    { licenseId: "cc-by-4.0", sourceVerified: true, sourceUrl: "https://openverse.org/item", originalSourceUrl: "https://example.org/original" },
    { sourceId: "openverse", sourceName: "Openverse" }
  );
  assert.equal(verification.status, "verified");
  assert.equal(verification.originalSourceUrl, "https://example.org/original");
  assert.equal(verification.sourceId, "openverse");
});

test("OS-024 rights-review cases are deterministic and never enter the main Scroll", () => {
  const rights = evaluateRights({ licenseId: "cc-by-4.0", sourceVerified: false, sourceUrl: "https://example.org/item" }, { sourceId: "openverse", sourceName: "Openverse" });
  const decision = createOpenLicenseGateDecision(rights, { itemId: "openverse:item", sourceId: "openverse" });
  assert.equal(decision.decision, "review");
  assert.equal(decision.canEnterScroll, false);
});

test("OS-025 attribution notices include title, creator, source, license, and obligations", () => {
  const notice = createAttributionNotice(
    { licenseId: "cc-by-sa-4.0", attribution: "Commons contributor" },
    { title: "Gnawa recording", sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/item" }
  );
  assert.match(notice.text, /Gnawa recording/);
  assert.match(notice.text, /Commons contributor/);
  assert.match(notice.text, /CC BY-SA 4.0/);
  assert.deepEqual(notice.obligations, ["attribution", "share-alike"]);
});

test("OS-026 and OS-027 why-open explanations and download policies follow gate status", () => {
  const object = canonicalMoroccoSample.find((item) => item.source.id === "wikimedia-commons");
  assert.equal(object.rights.whyOpen.headline, "Verified open for OpenScroll");
  assert.ok(object.rights.whyOpen.bullets.some((bullet) => bullet.includes("allows access")));
  assert.equal(object.rights.downloadPolicy.allowed, true);

  const blocked = evaluateRights({ licenseId: "cc-by-nc-4.0", sourceVerified: true }, { sourceId: "openverse", sourceName: "Openverse" });
  const policy = createRightsSafeDownloadPolicy(blocked);
  assert.equal(policy.allowed, false);
  assert.equal(policy.access, "blocked");
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
