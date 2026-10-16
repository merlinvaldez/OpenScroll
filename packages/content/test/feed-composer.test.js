import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMoroccoSample, composeDiversityFeed, deduplicateCandidates } from "../src/index.js";

test("composition ignores legacy licenses while preserving availability and explicit hide checks", () => {
  const base = canonicalMoroccoSample[0];
  const make = (id, overrides = {}) => ({ ...base, id, content: { ...base.content, title: id }, ...overrides });
  const candidates = [
    make("absent"),
    make("restricted", { rights: { eligibility: "rejected", licenseId: "cc-by-nc-4.0" } }),
    make("hidden"),
    make("unavailable", { media: { ...base.media, status: "unavailable" } }),
    make("no-url", { media: { kind: "image" } }),
    make("invalid", { content: {} })
  ];
  const result = composeDiversityFeed(candidates, { feedback: [{ itemId: "hidden", action: "hide" }], seed: 42 });
  assert.deepEqual(new Set(result.items.map((item) => item.id)), new Set(["absent", "restricted"]));
});

test("feed composer enforces diversity constraints without licensing requirements", () => {
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
      source: { id: `image-source-${index}` }
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `audio-${index}`,
      content: { title: `Audio ${index}` },
      media: { kind: "audio", url: `https://example.org/audio-${index}.ogg` },
      source: { id: `audio-source-${index}` }
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `video-${index}`,
      content: { title: `Video ${index}` },
      media: { kind: "video", url: `https://example.org/video-${index}.webm` },
      source: { id: `video-source-${index}` }
    }))
  ];

  const kinds = composeDiversityFeed(candidates, { pageSize: 8, seed: 2468 }).items.map((item) => item.media.kind);

  assert.deepEqual(new Set(kinds.slice(0, 6)), new Set(["image", "audio", "video"]));
  for (let index = 1; index < 6; index += 1) {
    assert.notEqual(kinds[index], kinds[index - 1], "available media kinds should be interleaved");
  }
});

test("ranks accepted items within media buckets by calibrated relevance probability", () => {
  const candidates = [
    {
      id: "img-low",
      content: { title: "Moroccan street snapshot", description: "City street" },
      media: { kind: "image", url: "https://example.org/street.jpg" },
      source: { id: "commons" },
      ranking: { quality: 0.7, relevanceProbability: 0.71 }
    },
    {
      id: "img-high",
      content: { title: "Gnawa Guembri master performance", description: "Musician playing guembri" },
      media: { kind: "image", url: "https://example.org/gnawa.jpg" },
      source: { id: "commons" },
      ranking: { quality: 0.7, relevanceProbability: 0.96 }
    },
    {
      id: "audio-low",
      content: { title: "Ambient crowd noise Marrakech", description: "Market background" },
      media: { kind: "audio", url: "https://example.org/market.ogg" },
      source: { id: "commons" },
      ranking: { quality: 0.7, relevanceProbability: 0.65 }
    },
    {
      id: "audio-high",
      content: { title: "Gnawa Lila ceremonial rhythm", description: "Karkabous and guembri ritual recording" },
      media: { kind: "audio", url: "https://example.org/lila.ogg" },
      source: { id: "commons" },
      ranking: { quality: 0.7, relevanceProbability: 0.94 }
    }
  ];

  const result = composeDiversityFeed(candidates, { pageSize: 4, seed: 42 });
  const ids = result.items.map((item) => item.id);

  // Both high-relevance items must precede their lower-relevance counterparts of the same media kind
  const imgHighIdx = ids.indexOf("img-high");
  const imgLowIdx = ids.indexOf("img-low");
  const audioHighIdx = ids.indexOf("audio-high");
  const audioLowIdx = ids.indexOf("audio-low");

  assert.ok(imgHighIdx < imgLowIdx, "High relevance image must be ranked before low relevance image");
  assert.ok(audioHighIdx < audioLowIdx, "High relevance audio must be ranked before low relevance audio");
  // Mixed media discovery must still be preserved
  assert.deepEqual(new Set(result.mediaKindsRepresented), new Set(["image", "audio"]));
});

test("completeness and quality factor into ranking and seeded tie-breaking resolves equal scores", () => {
  const candidateBasic = {
    id: "item-basic",
    content: { title: "Title only" },
    media: { kind: "image", url: "https://example.org/basic.jpg" },
    source: { id: "commons" },
    ranking: { quality: 0.6, relevanceProbability: 0.8 }
  };

  const candidateComplete = {
    id: "item-complete",
    content: { title: "Rich Title", description: "Comprehensive description" },
    creator: { name: "Renowned Author" },
    media: {
      kind: "image",
      url: "https://example.org/complete.jpg",
      accessibility: { captions: "Descriptive captions" }
    },
    source: { id: "commons" },
    ranking: { quality: 0.9, relevanceProbability: 0.8 }
  };

  const result = composeDiversityFeed([candidateBasic, candidateComplete], { pageSize: 2, seed: 100 });
  assert.equal(result.items[0].id, "item-complete", "Complete and higher quality item must rank first when relevance is equal");

  // Tied items: test deterministic tie breaking with seed
  const tied1 = { id: "tied-a", content: { title: "A" }, media: { kind: "image", url: "https://example.org/a.jpg" }, source: { id: "s1" } };
  const tied2 = { id: "tied-b", content: { title: "B" }, media: { kind: "image", url: "https://example.org/b.jpg" }, source: { id: "s2" } };

  const resSeed1 = composeDiversityFeed([tied1, tied2], { pageSize: 2, seed: 1111 });
  const resSeed1Repeat = composeDiversityFeed([tied1, tied2], { pageSize: 2, seed: 1111 });
  assert.deepEqual(resSeed1.items.map((i) => i.id), resSeed1Repeat.items.map((i) => i.id), "Same seed must yield deterministic order for tied items");
});

test("item feedback (more, less, hide) strictly applies to exact items without broad preference inference", () => {
  const itemA = {
    id: "item-a",
    content: { title: "Gnawa Song A", topics: ["Music", "Morocco"] },
    media: { kind: "audio", url: "https://example.org/a.ogg" },
    source: { id: "s1" },
    ranking: { quality: 0.7, relevanceProbability: 0.8 }
  };
  const itemB = {
    id: "item-b",
    content: { title: "Gnawa Song B", topics: ["Music", "Morocco"] },
    media: { kind: "audio", url: "https://example.org/b.ogg" },
    source: { id: "s1" },
    ranking: { quality: 0.7, relevanceProbability: 0.8 }
  };
  const itemC = {
    id: "item-c",
    content: { title: "Gnawa Song C", topics: ["Music", "Morocco"] },
    media: { kind: "audio", url: "https://example.org/c.ogg" },
    source: { id: "s1" },
    ranking: { quality: 0.7, relevanceProbability: 0.8 }
  };

  // 'more-like-this' boosts exact item B to the front
  const resMore = composeDiversityFeed([itemA, itemB, itemC], {
    feedback: [{ itemId: "item-b", action: "more-like-this" }],
    seed: 42
  });
  assert.equal(resMore.items[0].id, "item-b", "more-like-this must boost exact item to the top of its bucket");

  // 'less-like-this' demotes exact item B behind A and C
  const resLess = composeDiversityFeed([itemA, itemB, itemC], {
    feedback: [{ itemId: "item-b", action: "less-like-this" }],
    seed: 42
  });
  assert.equal(resLess.items[2].id, "item-b", "less-like-this must demote exact item to the end of its bucket");
  // Crucially, items A and C sharing topics ["Music", "Morocco"] are NOT demoted (no inferred broad preferences)
  assert.deepEqual(new Set([resLess.items[0].id, resLess.items[1].id]), new Set(["item-a", "item-c"]));

  // 'hide' completely excludes exact item B
  const resHide = composeDiversityFeed([itemA, itemB, itemC], {
    feedback: [{ itemId: "item-b", action: "hide" }],
    seed: 42
  });
  assert.equal(resHide.items.length, 2);
  assert.ok(!resHide.items.some((i) => i.id === "item-b"), "hide must completely exclude exact item");
  assert.deepEqual(new Set(resHide.items.map((i) => i.id)), new Set(["item-a", "item-c"]));
});

test("interleaving prioritizes ready items without letting scarce media types stall the feed", () => {
  const candidates = [
    // 1 scarce video item
    {
      id: "video-solo",
      content: { title: "Sole Video Performance" },
      media: { kind: "video", url: "https://example.org/solo.webm" },
      source: { id: "commons" },
      ranking: { quality: 0.8, relevanceProbability: 0.9 }
    },
    // 5 image items
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `image-${i}`,
      content: { title: `Image Art ${i}` },
      media: { kind: "image", url: `https://example.org/art-${i}.jpg` },
      source: { id: `source-${i}` },
      ranking: { quality: 0.7, relevanceProbability: 0.85 }
    }))
  ];

  const result = composeDiversityFeed(candidates, { pageSize: 6, seed: 777 });
  assert.equal(result.items.length, 6, "Must deliver all 6 items without stalling for missing video");
  assert.ok(result.items.some((item) => item.id === "video-solo"), "Scarce video is included");
  assert.equal(result.items.filter((item) => item.media.kind === "image").length, 5);
});

test("raw query term matching gives specific searches priority over generic matches", () => {
  const genericJazz = {
    id: "jazz-generic",
    content: { title: "Jazz Ensemble in New Orleans" },
    media: { kind: "image", url: "https://example.org/jazz.jpg" },
    source: { id: "s1" },
    ranking: { quality: 0.8, relevanceProbability: 0.9 }
  };
  const specificPiano = {
    id: "jazz-piano-specific",
    content: { title: "Solo Jazz Piano Concert" },
    media: { kind: "image", url: "https://example.org/piano.jpg" },
    source: { id: "s2" },
    ranking: { quality: 0.8, relevanceProbability: 0.9 }
  };

  const resPianoSearch = composeDiversityFeed([genericJazz, specificPiano], {
    interestGraph: { interest: "Jazz Piano" },
    seed: 42
  });

  assert.equal(resPianoSearch.items[0].id, "jazz-piano-specific", "Candidates matching exact refined query terms must be ranked higher");
});


