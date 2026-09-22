import test from "node:test";
import assert from "node:assert/strict";
import { buildCommonsSearchPlan, buildSearchPlans } from "../src/search-planner.js";

test("Commons search planner creates bounded canonical and title variants", () => {
  const plan = buildCommonsSearchPlan("Gnawa music Morocco", {
    label: "Gnawa",
    aliases: ["Gnawa", "Gnaoua", "Gnawa music", "Too many aliases"]
  });

  assert.equal(plan.rawQuery, "Gnawa music Morocco");
  assert.ok(plan.variants.some((variant) => variant.strategy === "user-query"));
  assert.ok(plan.variants.some((variant) => variant.strategy === "canonical-entity" && variant.query === "Gnawa"));
  assert.ok(plan.variants.some((variant) => variant.strategy === "entity-alias" && variant.query === "Gnaoua"));
  assert.ok(plan.variants.some((variant) => variant.strategy === "title-match" && variant.query === "intitle:Gnawa"));
  assert.ok(plan.variants.length <= 5);
});

test("Commons search planner removes duplicate variants and preserves media plans", () => {
  const plans = buildSearchPlans("Morocco", { label: "Morocco", aliases: ["Morocco"] }, ["images", "audio"]);

  assert.deepEqual(Object.keys(plans), ["images", "audio"]);
  assert.equal(plans.images.variants.length, plans.audio.variants.length);
  assert.equal(new Set(plans.images.variants.map((variant) => variant.query)).size, plans.images.variants.length);
});
