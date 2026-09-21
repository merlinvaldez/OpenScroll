import { openLicenseGate } from "./rights.js";
import { cleanString, deepFreeze, unique } from "./utils.js";

function seededRandom(seed) {
  let state = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : Math.floor(Math.random() * 0x100000000);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle(values, random) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function mediaKind(item) {
  return item.media?.kind || item.content?.type || "unknown";
}

function interleaveMediaKinds(items, random) {
  const buckets = new Map();

  for (const item of items) {
    const kind = mediaKind(item);
    if (!buckets.has(kind)) buckets.set(kind, []);
    buckets.get(kind).push(item);
  }

  const mediaOrder = shuffle([...buckets.keys()], random);
  const mixed = [];
  let remaining = true;

  while (remaining) {
    remaining = false;
    for (const kind of mediaOrder) {
      const bucket = buckets.get(kind);
      if (!bucket?.length) continue;
      mixed.push(bucket.shift());
      remaining = true;
    }
  }

  return mixed;
}

export function deduplicateCandidates(candidates) {
  const clusters = new Map();

  for (const candidate of candidates) {
    const titleKey = cleanString(candidate.content?.title || candidate.title, 80).toLowerCase();
    const sourceItemId = candidate.identity?.sourceItemId || candidate.id;
    const clusterKey = titleKey || `${candidate.source?.id || candidate.sourceId}:${sourceItemId}`;

    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, [candidate]);
    } else {
      clusters.get(clusterKey).push(candidate);
    }
  }

  // Pick highest quality canonical object from each cluster
  const canonicalList = [];
  for (const [, cluster] of clusters) {
    const sorted = [...cluster].sort((a, b) => {
      const qA = a.ranking?.quality ?? 0.7;
      const qB = b.ranking?.quality ?? 0.7;
      const hasMediaA = Boolean(a.media?.url) ? 1 : 0;
      const hasMediaB = Boolean(b.media?.url) ? 1 : 0;
      return (qB + hasMediaB) - (qA + hasMediaA);
    });
    canonicalList.push(sorted[0]);
  }

  return canonicalList;
}

export function scoreCandidate(candidate, interestGraph = {}, feedback = []) {
  let score = candidate.ranking?.quality ?? 0.75;
  const topics = candidate.knowledge?.topics || candidate.content?.topics || [];
  const selectedTopics = interestGraph.topics || [];
  const topicWeights = interestGraph.topicWeights || {};
  const hiddenTopics = new Set(interestGraph.excludedTopics || []);

  // Check for excluded/hidden topics
  for (const t of topics) {
    if (hiddenTopics.has(t)) return -1; // Block completely
  }

  // Explicit topic weight matching
  for (const t of topics) {
    if (selectedTopics.includes(t)) {
      score += 0.5 * (topicWeights[t] ?? 1);
    }
  }

  // Apply explicit feedback boost/penalty
  for (const fb of feedback) {
    if (fb.itemId === candidate.id || fb.itemId === candidate.identity?.sourceItemId) {
      if (fb.action === "more-like-this") score += 0.4;
      if (fb.action === "less-like-this") score -= 0.6;
      if (fb.action === "hide") return -1;
    }
  }

  // Medium completeness bonus
  if (candidate.media?.url) score += 0.2;
  if (candidate.media?.accessibility?.transcript || candidate.media?.accessibility?.captions) score += 0.1;

  return score;
}

export function composeDiversityFeed(candidates, options = {}) {
  const {
    interestGraph = {},
    feedback = [],
    pageSize = 25,
    cursor = 0,
    seed
  } = options;

  // 1. Pass through Open License Gate (Fail closed)
  const eligible = candidates.filter((item) => {
    if (!item.rights) return false;
    if (item.rights.eligibility === "eligible" || item.rights.gate?.decision === "accept") {
      return true;
    }
    const gate = openLicenseGate(item.rights, {
      sourceId: item.source?.id || item.sourceId,
      sourceName: item.source?.name,
      sourceUrl: item.identity?.sourceRecordUrl || item.sourceUrl,
      originalSourceUrl: item.identity?.originalSourceUrl || item.originalSourceUrl
    });
    return gate.decision === "accept";
  });

  // 2. Deduplicate
  const deduplicated = deduplicateCandidates(eligible);

  // 3. Score and Filter. Scores decide eligibility, not display order.
  const scored = deduplicated
    .map((item) => ({ item, score: scoreCandidate(item, interestGraph, feedback) }))
    .filter((entry) => entry.score > 0);

  // 4. Shuffle for open exploration, then keep the existing diversity guardrails.
  const random = seededRandom(seed);
  const pool = interleaveMediaKinds(shuffle(scored.map((entry) => entry.item), random), random);
  const composed = [];
  const remaining = [...pool];

  while (remaining.length > 0) {
    let nextIndex = 0;

    if (composed.length >= 2) {
      const prev1 = composed[composed.length - 1];
      const prev2 = composed[composed.length - 2];
      const prevMedium1 = prev1.media?.kind || prev1.content?.type;
      const prevMedium2 = prev2.media?.kind || prev2.content?.type;
      const prevSource1 = prev1.source?.id;
      const prevSource2 = prev2.source?.id;

      // Find an item that breaks streak if last 2 are identical medium or source
      const needsMediumBreak = prevMedium1 && prevMedium1 === prevMedium2;
      const needsSourceBreak = prevSource1 && prevSource1 === prevSource2;

      if (needsMediumBreak || needsSourceBreak) {
        const breakIndex = remaining.findIndex((candidate) => {
          const m = candidate.media?.kind || candidate.content?.type;
          const s = candidate.source?.id;
          const okMedium = !needsMediumBreak || m !== prevMedium1;
          const okSource = !needsSourceBreak || s !== prevSource1;
          return okMedium && okSource;
        });

        if (breakIndex !== -1) {
          nextIndex = breakIndex;
        }
      }
    }

    const chosen = remaining.splice(nextIndex, 1)[0];
    composed.push(chosen);
  }

  // 5. Paginate with stable cursor
  const startIndex = Number.isInteger(cursor) ? Math.max(0, cursor) : 0;
  const pageItems = composed.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < composed.length;
  const nextCursor = hasMore ? startIndex + pageSize : null;

  return deepFreeze({
    items: pageItems,
    pagination: {
      startIndex,
      pageSize,
      totalCount: composed.length,
      hasMore,
      nextCursor
    },
    sourcesRepresented: unique(pageItems.map((item) => item.source?.name || item.source?.id)),
    mediaKindsRepresented: unique(pageItems.map((item) => item.media?.kind || item.content?.type))
  });
}
