import assert from "node:assert/strict";
import test from "node:test";
import {
  EPIC_C_CONNECTORS,
  SOURCE_REGISTRY,
  canonicalMoroccoSample,
  createConnector,
  contentItemsForTopic,
  createContentGraph,
  createInterestGraph,
  createOpenScrollGraphBundle,
  createAttributionNotice,
  createWikidataClient,
  createOpenLicenseGateDecision,
  createRightsSafeDownloadPolicy,
  createSourceRegistry,
  createSeedKnowledgeGraph,
  createUniversalContentObject,
  evaluateRights,
  getLicenseRecord,
  ingestKnowledgeGraph,
  normalizeLicenseId,
  resolveEntity,
  openLicenseGate,
  topicBranchesForInterest,
  traverseGraph,
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

test("OS-028 Knowledge Graph ingestion builds fixture and API-backed entity graphs", async () => {
  const fixture = await ingestKnowledgeGraph({ query: "Morocco" });
  assert.equal(fixture.status, "fixture");
  assert.equal(fixture.graph.schemaVersion, "knowledge-graph.v1");
  assert.ok(fixture.graph.nodes.some((node) => node.id === "wd:Q1028"));
  assert.ok(fixture.graph.edges.some((edge) => edge.type === "contains-place"));

  const calls = [];
  const client = createWikidataClient({
    userAgent: "OpenScroll test",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), headers: options.headers });
      const action = url.searchParams.get("action");
      if (action === "wbsearchentities") return { ok: true, json: async () => ({ search: [{ id: "Q1028", label: "Morocco", description: "Country", match: { text: "Maroc" } }] }) };
      if (action === "wbgetentities") return { ok: true, json: async () => ({ entities: { Q1028: { id: "Q1028", labels: { en: { value: "Morocco" }, ar: { value: "المغرب" } }, descriptions: { en: { value: "Country in North Africa" } }, aliases: { en: [{ value: "Maroc" }] }, claims: { P17: [] } } } }) };
      return { ok: true, json: async () => ({ results: { bindings: [] } }) };
    }
  });
  const live = await ingestKnowledgeGraph({ query: "Morocco", client });
  assert.equal(live.status, "live");
  assert.equal(live.graph.provenance.mode, "wikidata-api");
  assert.ok(calls.some((call) => call.url.includes("wbsearchentities")));
  assert.equal(calls[0].headers["User-Agent"], "OpenScroll test");
});

test("OS-029 Entity resolution handles aliases, languages, Wikidata IDs, and ambiguity", () => {
  const graph = createSeedKnowledgeGraph();
  assert.equal(resolveEntity("Fès", graph).selected.entityId, "wd:Q80985");
  assert.equal(resolveEntity("فاس", graph).selected.entityId, "wd:Q80985");
  assert.equal(resolveEntity("Q1028", graph).selected.entityId, "wd:Q1028");
  const ambiguous = resolveEntity("Mar", graph);
  assert.equal(ambiguous.status, "ambiguous");
  assert.ok(ambiguous.candidates.length >= 2);
});

test("OS-030 Content Graph links content to entities, topics, places, sources, media, and collections", () => {
  const knowledgeGraph = createSeedKnowledgeGraph();
  const contentGraph = createContentGraph(canonicalMoroccoSample, knowledgeGraph);
  assert.equal(contentGraph.objectCount, canonicalMoroccoSample.length);
  assert.ok(contentGraph.edges.some((edge) => edge.type === "about-entity"));
  assert.ok(contentGraph.edges.some((edge) => edge.type === "from-source"));
  assert.ok(contentGraph.edges.some((edge) => edge.type === "has-media-kind"));
  assert.ok(contentItemsForTopic(contentGraph, "Music").some((node) => node.objectId.includes("gnawa")));
});

test("OS-031 Interest Graph stores explicit local choices, weights, media, sources, depth, and surprise", () => {
  const knowledgeGraph = createSeedKnowledgeGraph();
  const entityResolution = resolveEntity("Maroc", knowledgeGraph);
  const graph = createInterestGraph({
    interest: "Maroc",
    entityResolution,
    selectedTopics: ["Music", "Darija"],
    excludedTopics: ["Shopping"],
    settings: { locale: "fr", media: { video: false }, sources: { openverse: false } },
    weights: { Music: 0.95 },
    depth: 3,
    surprise: 0.4
  });
  assert.equal(graph.root.entityId, "wd:Q1028");
  assert.deepEqual(graph.selectedTopics, ["Music", "Darija"]);
  assert.equal(graph.weights.Music, 0.95);
  assert.equal(graph.preferences.media.video, false);
  assert.equal(graph.preferences.sources.openverse, false);
  assert.equal(graph.preferences.depth, 3);
  assert.equal(graph.preferences.surprise, 0.4);
  assert.equal(graph.storage.mode, "browser-local");
});

test("OS-032 Graph relationship APIs expose topic branches, traversals, ranked matches, and explanations", () => {
  const bundle = createOpenScrollGraphBundle({ interest: "Morocco", selectedTopics: ["Music", "Architecture", "History"] });
  assert.equal(bundle.relationshipApi.schemaVersion, "graph-relationship-api.v1");
  assert.ok(bundle.topicBranches.some((branch) => branch.label === "Darija"));
  assert.ok(bundle.contentMatches.length >= 3);
  const explanation = bundle.relationshipApi.explain(bundle.contentMatches[0].object.id);
  assert.ok(explanation.reason.includes("OpenScroll graph"));
  assert.ok(explanation.pathLabels.length >= 2);
  const traversal = traverseGraph({ from: bundle.interestGraph.root.entityId, graphs: [bundle.knowledgeGraph, bundle.contentGraph], depth: 2 });
  assert.ok(traversal.paths.length);
  const branches = topicBranchesForInterest({ knowledgeGraph: bundle.knowledgeGraph, contentGraph: bundle.contentGraph, entityResolution: bundle.entityResolution });
  assert.ok(branches.every((branch) => branch.path[0] === "wd:Q1028"));
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
