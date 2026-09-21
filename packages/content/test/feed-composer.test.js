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

test("feed order is randomized but stable for a scroll seed", () => {
  const options = {
    interestGraph: { interest: "Morocco", topics: ["Music", "Architecture", "History"] },
    pageSize: 10,
    seed: 12345
  };
  const first = composeDiversityFeed(canonicalMoroccoSample, options).items.map((item) => item.id);
  const repeated = composeDiversityFeed(canonicalMoroccoSample, options).items.map((item) => item.id);
  const differentSeed = composeDiversityFeed(canonicalMoroccoSample, { ...options, seed: 98765 }).items.map((item) => item.id);

  assert.deepEqual(repeated, first, "the same scroll seed must preserve pagination order");
  assert.notDeepEqual(differentSeed, first, "different scroll seeds must produce a different exploration order");
});

test("feed interleaves available media kinds before filling the dominant kind", () => {
  const candidates = [
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `image-${index}`,
      content: { title: `Image ${index}` },
      media: { kind: "image", url: `https://example.org/image-${index}.jpg` },
      source: { id: `image-source-${index}` },
      rights: { eligibility: "eligible" }
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `audio-${index}`,
      content: { title: `Audio ${index}` },
      media: { kind: "audio", url: `https://example.org/audio-${index}.ogg` },
      source: { id: `audio-source-${index}` },
      rights: { eligibility: "eligible" }
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `video-${index}`,
      content: { title: `Video ${index}` },
      media: { kind: "video", url: `https://example.org/video-${index}.webm` },
      source: { id: `video-source-${index}` },
      rights: { eligibility: "eligible" }
    }))
  ];

  const kinds = composeDiversityFeed(candidates, { pageSize: 8, seed: 2468 }).items.map((item) => item.media.kind);

  assert.deepEqual(new Set(kinds.slice(0, 6)), new Set(["image", "audio", "video"]));
  for (let index = 1; index < 6; index += 1) {
    assert.notEqual(kinds[index], kinds[index - 1], "available media kinds should be interleaved");
  }
});
