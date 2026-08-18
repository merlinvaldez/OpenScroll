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

test("query planner constructs multi-source search vectors", () => {
  const entity = { id: "Q1028", label: "Morocco" };
  const plan = buildQueryPlan(entity, ["Gnawa", "Architecture", "Darija"], "en");
  assert.equal(plan.entityLabel, "Morocco");
  assert.ok(plan.searchTerms.wikimedia.includes("Gnawa"));
  assert.ok(plan.searchTerms.commons.includes("Morocco"));
});
