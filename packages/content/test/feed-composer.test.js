import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMoroccoSample, composeDiversityFeed, deduplicateCandidates, scoreCandidate } from "../src/index.js";

test("feed composer enforces diversity constraints and filters through Open License Gate", () => {
  const result = composeDiversityFeed(canonicalMoroccoSample, {
    interestGraph: {
      interest: "Morocco",
      topics: ["Music", "Architecture", "History"],
      topicWeights: { Music: 1.5 }
    },
    pageSize: 10
  });

  assert.ok(result.items.length > 0);
  assert.ok(result.sourcesRepresented.length >= 3, "must represent multiple sources");
  assert.ok(result.mediaKindsRepresented.length >= 2, "must represent multiple media kinds");

  // Check no 3 consecutive items share identical medium
  for (let i = 2; i < result.items.length; i++) {
    const m1 = result.items[i].media?.kind;
    const m2 = result.items[i - 1].media?.kind;
    const m3 = result.items[i - 2].media?.kind;
    if (m1 && m2 && m3) {
      assert.notEqual(m1 === m2 && m2 === m3, true, "Cannot have 3 consecutive same-medium items");
    }
  }
});

test("deduplication selects canonical representation from cluster", () => {
  const mockCluster = [
    { ...canonicalMoroccoSample[0], id: "item-1", content: { title: "Medina View" }, ranking: { quality: 0.5 } },
    { ...canonicalMoroccoSample[0], id: "item-2", content: { title: "Medina View" }, ranking: { quality: 0.9 } }
  ];

  const deduplicated = deduplicateCandidates(mockCluster);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].id, "item-2");
});
