import { cleanString, deepFreeze, numberBetween, slug, unique } from "./utils.js";

export const ENTITY_RESOLUTION_VERSION = "entity-resolution.v1";

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

export function normalizeEntityQuery(value) {
  return cleanString(value, 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .toLowerCase();
}

function nodeSearchTerms(node) {
  return unique([
    node.id,
    node.externalIds?.wikidata ? `Q${String(node.externalIds.wikidata).replace(/^Q/i, "")}` : "",
    node.label,
    ...Object.values(node.labels || {}),
    ...(node.aliases || [])
  ].map((item) => cleanString(item, 180)).filter(Boolean));
}

function scoreNode(query, node, options = {}) {
  const normalizedQuery = normalizeEntityQuery(query);
  const terms = nodeSearchTerms(node).map((term) => ({ raw: term, normalized: normalizeEntityQuery(term) }));
  const exact = terms.find((term) => term.normalized === normalizedQuery);
  if (exact) return { score: exact.raw === node.id || exact.raw === node.externalIds?.wikidata ? 1 : 0.98, matchedOn: exact.raw };
  const starts = terms.find((term) => term.normalized.startsWith(normalizedQuery) || normalizedQuery.startsWith(term.normalized));
  if (starts && normalizedQuery.length >= 3) return { score: 0.82, matchedOn: starts.raw };
  const includes = terms.find((term) => term.normalized.includes(normalizedQuery) || normalizedQuery.includes(term.normalized));
  if (includes && normalizedQuery.length >= 4) return { score: 0.68, matchedOn: includes.raw };
  const typeHint = cleanString(options.typeHint, 80);
  if (typeHint && node.type === typeHint && normalizedQuery.split(" ").some((token) => terms.some((term) => term.normalized.includes(token)))) return { score: 0.58, matchedOn: typeHint };
  return { score: 0, matchedOn: "" };
}

function candidateFor(query, node, options = {}) {
  const score = scoreNode(query, node, options);
  if (score.score <= 0) return null;
  return {
    entityId: node.id,
    label: node.label,
    type: node.type,
    score: numberBetween(score.score, 0, 1, 0),
    matchedOn: score.matchedOn,
    aliases: node.aliases,
    externalIds: node.externalIds,
    source: node.source
  };
}

export function resolveEntity(query, graph, options = {}) {
  const candidates = (graph?.nodes || [])
    .filter((node) => node.type === "entity" || node.id.startsWith("wd:"))
    .map((node) => candidateFor(query, node, options))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, options.limit || 8);
  const top = candidates[0] || null;
  const runnerUp = candidates[1] || null;
  const ambiguous = Boolean(top && runnerUp && top.score - runnerUp.score < 0.08);
  const status = !top ? "not-found" : ambiguous ? "ambiguous" : "resolved";
  return deepFreeze({
    schemaVersion: ENTITY_RESOLUTION_VERSION,
    id: `entity-resolution:${slug(query)}`,
    query: cleanString(query, 180),
    normalizedQuery: normalizeEntityQuery(query),
    status,
    selected: status === "resolved" ? {
      entityId: top.entityId,
      label: top.label,
      type: top.type,
      confidence: top.score,
      matchedOn: top.matchedOn,
      externalIds: top.externalIds
    } : null,
    candidates,
    ambiguity: ambiguous ? {
      reason: "multiple-close-candidates",
      topEntityIds: candidates.slice(0, 2).map((candidate) => candidate.entityId)
    } : null,
    explanation: top
      ? `${cleanString(query, 80)} resolves to ${top.label} through ${top.matchedOn}.`
      : `${cleanString(query, 80)} did not match a known OpenScroll entity.`
  });
}

export function resolveEntityOrRoot(query, graph) {
  const resolution = resolveEntity(query, graph);
  if (resolution.status === "resolved") return resolution;
  const root = graph.nodes.find((node) => node.id === graph.rootEntityId) || graph.nodes.find((node) => node.type === "entity");
  return deepFreeze({
    ...resolution,
    status: root ? "fallback-root" : "not-found",
    selected: root ? { entityId: root.id, label: root.label, type: root.type, confidence: 0.45, matchedOn: "fallback-root", externalIds: root.externalIds } : null,
    explanation: root ? `${resolution.query || "The query"} uses ${root.label} as the fallback root for this Scroll.` : resolution.explanation
  });
}
