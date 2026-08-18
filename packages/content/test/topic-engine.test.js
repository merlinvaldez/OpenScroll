import test from "node:test";
import assert from "node:assert/strict";
import { TOPIC_DIMENSIONS, expandTopics, resolveEntity, buildQueryPlan } from "../src/topic-engine.js";

test("topic engine resolves entity and expands across 5-7 dimensions", async () => {
  const expanded = await expandTopics("Morocco", { useLiveApi: false });
  assert.equal(expanded.entity.label, "Morocco");
  assert.ok(expanded.dimensions.length >= 5, "must have at least 5 dimensions");
  assert.ok(expanded.flatTopics.length >= 10, "must produce rich topic chips");
  
  const dimIds = expanded.dimensions.map((d) => d.dimensionId);
  assert.ok(dimIds.includes("arts-music"));
  assert.ok(dimIds.includes("history-roots"));
  assert.ok(dimIds.includes("architecture-places"));
});

test("expandTopics generates comprehensive mindmap with nodes, edges, and real concepts for Jazz", async () => {
  const expanded = await expandTopics("Jazz", { useLiveApi: false });
  assert.equal(expanded.entity.label, "Jazz");
  assert.ok(expanded.mindmap, "must include mindmap topology");
  assert.ok(expanded.mindmap.nodes.length >= 15, "must have at least 15 mindmap concept nodes");
  assert.ok(expanded.mindmap.edges.length >= 15, "must have at least 15 mindmap edges");
  
  const topicNames = expanded.flatTopics.map((t) => t.name);
  assert.ok(topicNames.some((n) => n.includes("Bebop")), "must include Bebop");
  assert.ok(topicNames.some((n) => n.includes("Miles Davis")), "must include Miles Davis");
  assert.ok(topicNames.some((n) => n.includes("Improvisation")), "must include Improvisation");
});

test("expandTopics generates mindmap for Ancient Egypt and Quantum Physics", async () => {
  const egypt = await expandTopics("Ancient Egypt", { useLiveApi: false });
  assert.ok(egypt.mindmap.nodes.length >= 12);
  assert.ok(egypt.flatTopics.some((t) => t.name.includes("Pyramid") || t.name.includes("Hieroglyph") || t.name.includes("Tutankhamun")));

  const quantum = await expandTopics("Quantum Physics", { useLiveApi: false });
  assert.ok(quantum.mindmap.nodes.length >= 12);
  assert.ok(quantum.flatTopics.some((t) => t.name.includes("Superposition") || t.name.includes("Entanglement") || t.name.includes("Double-Slit")));
});

test("query planner constructs multi-source search vectors", () => {
  const entity = { id: "Q1028", label: "Morocco" };
  const plan = buildQueryPlan(entity, ["Gnawa", "Architecture", "Darija"], "en");
  assert.equal(plan.entityLabel, "Morocco");
  assert.ok(plan.searchTerms.wikimedia.includes("Gnawa"));
  assert.ok(plan.searchTerms.commons.includes("Morocco"));
});
