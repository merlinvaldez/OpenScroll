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
  const contentKind = item.content?.type;
  if (["article", "reader", "source-text", "dictionary", "travel-guide", "text"].includes(contentKind)) return "text";
  return item.media?.kind || item.content?.type || "unknown";
}

export function interleaveMediaKinds(items, random) {
  const buckets = new Map();

  for (const entry of items) {
    const isScoredEntry = entry && typeof entry === "object" && "item" in entry && "score" in entry;
    const item = isScoredEntry ? entry.item : entry;
    const score = isScoredEntry ? entry.score : (item?.ranking?.quality ?? 0.75);
    const kind = mediaKind(item);
    if (!buckets.has(kind)) buckets.set(kind, []);
    buckets.get(kind).push({ item, score });
  }

  // Rank accepted items within media buckets by score descending (strongest matches first)
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => b.score - a.score);
  }

  const mediaOrder = shuffle([...buckets.keys()], random);
  const mixed = [];
  let remaining = true;

  while (remaining) {
    remaining = false;
    for (const kind of mediaOrder) {
      const bucket = buckets.get(kind);
      if (!bucket?.length) continue;
      mixed.push(bucket.shift().item);
      remaining = true;
    }
  }

  return mixed;
}

function normalizeClusterTitle(title) {
  return cleanString(title, 120).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalClusterKey(candidate) {
  if (!candidate || typeof candidate !== "object") return "invalid";
  const sourceId = candidate.source?.id || candidate.sourceId || "";
  const sourceItemId = candidate.identity?.sourceItemId || candidate.sourceItemId;
  const canonicalUrl = candidate.canonicalUrl || candidate.sourceUrl;
  const kind = mediaKind(candidate);
  const creator = cleanString(candidate.creators?.[0]?.name, 80).toLowerCase();
  const rawTitle = candidate.content?.title || candidate.title || "";
  const normTitle = normalizeClusterTitle(rawTitle);

  // Work clustering: same media kind + same creator + matching title represents a duplicate work
  if (creator && normTitle) {
    return `work:${kind}:${creator}:${normTitle}`;
  }

  // Exact source item match with matching title
  if (sourceId && sourceItemId && normTitle) {
    return `item:${sourceId}:${sourceItemId}:${normTitle}`;
  }

  if (canonicalUrl && normTitle) {
    return `url:${canonicalUrl}:${normTitle}`;
  }

  return `id:${candidate.id || normTitle || "unknown"}`;
}

export function deduplicateCandidates(candidates) {
  const clusters = new Map();

  for (const candidate of candidates) {
    const clusterKey = canonicalClusterKey(candidate);
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

export function scoreCandidate(candidate, interestGraph = {}, feedback = [], options = {}) {
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

  // Apply explicit feedback boost/penalty strictly to exact item (no broad preference inference)
  for (const fb of feedback) {
    if (fb.itemId === candidate.id || fb.itemId === candidate.identity?.sourceItemId) {
      if (fb.action === "more-like-this") score += 0.4;
      if (fb.action === "less-like-this") score -= 0.6;
      if (fb.action === "hide") return -1;
    }
  }

  // Completeness bonus (media URL, title/description, creator, accessibility)
  let completeness = 0;
  if (candidate.media?.url) completeness += 0.15;
  if (candidate.content?.title && candidate.content?.description) completeness += 0.05;
  if (candidate.creator?.name || candidate.creators?.[0]?.name) completeness += 0.05;
  if (candidate.media?.accessibility?.transcript || candidate.media?.accessibility?.captions) completeness += 0.1;
  score += completeness;

  // Preserve and factor Decisions calibrated relevance probability for ranking
  const relevanceProbability = candidate.ranking?.relevanceProbability ?? candidate.decision?.probability;
  if (Number.isFinite(relevanceProbability)) {
    score += relevanceProbability * 1.0;
  }

  // Boost candidates matching raw query terms in title or description to differentiate similar/refined searches
  const rawInterest = cleanString(interestGraph.interest || "", 120).toLowerCase();
  if (rawInterest) {
    const rawTerms = rawInterest.split(/\s+/).map((t) => t.replace(/[^a-z0-9]/g, "")).filter((t) => t.length > 2);
    if (rawTerms.length) {
      const candidateTitle = cleanString(candidate.content?.title || candidate.title || "", 200).toLowerCase();
      const candidateDesc = cleanString(candidate.content?.description || candidate.description || "", 500).toLowerCase();
      const candidateTopics = (candidate.knowledge?.topics || candidate.content?.topics || []).join(" ").toLowerCase();
      const fullCandidateText = `${candidateTitle} ${candidateDesc} ${candidateTopics}`;

      const titleMatches = rawTerms.filter((term) => candidateTitle.includes(term)).length;
      const anyMatches = rawTerms.filter((term) => fullCandidateText.includes(term)).length;

      if (titleMatches > 0) {
        score += (titleMatches / rawTerms.length) * 0.5;
      } else if (anyMatches > 0) {
        score += (anyMatches / rawTerms.length) * 0.3;
      }
    }
  }

  // Factor in retrieval match score from source connector if available
  if (Number.isFinite(candidate.ranking?.retrievalScore)) {
    score += candidate.ranking.retrievalScore * 0.25;
  }

  // Seeded deterministic tie-breaking jitter
  const seed = options.seed ?? interestGraph.seed;
  if (seed !== undefined && seed !== null && candidate.id) {
    const str = `${seed}:${candidate.id}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    score += (hash % 1000) * 1e-6;
  }

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

  // Keep usable records; licensing metadata has no effect on eligibility.
  const eligible = candidates.filter((item) => item?.id && item.content?.title && item.media?.kind && item.media?.url && item.media.status !== "unavailable");

  // 2. Deduplicate
  const deduplicated = deduplicateCandidates(eligible);

  // 3. Score and Filter. Scores determine eligibility and intra-bucket ranking.
  const scored = deduplicated
    .map((item) => {
      const score = scoreCandidate(item, interestGraph, feedback, { seed });
      return { item, score };
    })
    .filter((entry) => entry.score > 0);

  // 4. Interleave media buckets while preserving intra-bucket ranking and seeded tie-breaking.
  const random = seededRandom(seed);
  const pool = interleaveMediaKinds(scored, random);
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
    mediaKindsRepresented: unique(pageItems.map(mediaKind))
  });
}
