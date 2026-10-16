import { cleanString, deepFreeze, unique } from "./utils.js";

const MAX_VARIANTS = 5;

function normalizeQuery(value, maxLength = 120) {
  return cleanString(value, maxLength).replace(/\s+/g, " ");
}

function quotePhrase(value) {
  const normalized = normalizeQuery(value, 100).replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.includes(" ") ? `"${normalized}"` : normalized;
}

function normalizedKey(value) {
  return normalizeQuery(value, 120).toLocaleLowerCase();
}

function addVariant(variants, seenQueries, query, strategy, stage = 1) {
  const normalized = normalizeQuery(query);
  const key = normalizedKey(normalized);
  if (!normalized || seenQueries.has(key)) return;
  seenQueries.add(key);
  variants.push({
    key: `${strategy}-${variants.length + 1}`,
    query: normalized,
    strategy,
    stage
  });
}

export function buildCommonsSearchPlan(query, entity = null) {
  const rawQuery = normalizeQuery(query);
  const canonicalLabel = normalizeQuery(entity?.label);
  const aliases = unique([
    ...(Array.isArray(entity?.aliases) ? entity.aliases : [])
  ].map((alias) => normalizeQuery(alias)).filter(Boolean));
  const variants = [];
  const seenQueries = new Set();

  // Stage 1: Original user query and canonical entity
  addVariant(variants, seenQueries, rawQuery, "user-query", 1);

  if (canonicalLabel && normalizedKey(canonicalLabel) !== normalizedKey(rawQuery)) {
    addVariant(variants, seenQueries, canonicalLabel, "canonical-entity", 1);
  }

  // Stage 2: Aliases and title matches added only when needed
  aliases
    .filter((alias) => normalizedKey(alias) !== normalizedKey(rawQuery))
    .slice(0, 2)
    .forEach((alias) => addVariant(variants, seenQueries, alias, "entity-alias", 2));

  const titlePhrase = quotePhrase(canonicalLabel || rawQuery);
  if (titlePhrase) {
    addVariant(variants, seenQueries, `intitle:${titlePhrase}`, "title-match", 2);
  }

  return deepFreeze({
    sourceKind: "wikimedia-commons",
    rawQuery,
    entity: canonicalLabel ? {
      label: canonicalLabel,
      aliases: aliases.slice(0, 3)
    } : null,
    variants: variants.slice(0, MAX_VARIANTS)
  });
}

export function buildWikipediaSearchPlan(query, entity = null) {
  const rawQuery = normalizeQuery(query);
  const canonicalLabel = normalizeQuery(entity?.label);
  const aliases = unique([
    ...(Array.isArray(entity?.aliases) ? entity.aliases : [])
  ].map((alias) => normalizeQuery(alias)).filter(Boolean));
  const variants = [];
  const seenQueries = new Set();

  // Stage 1: User query and canonical title
  addVariant(variants, seenQueries, rawQuery, "user-query", 1);

  if (canonicalLabel && normalizedKey(canonicalLabel) !== normalizedKey(rawQuery)) {
    addVariant(variants, seenQueries, canonicalLabel, "canonical-entity", 1);
  }

  // Stage 2: Entity aliases for topic coverage (no Commons file/intitle syntax)
  aliases
    .filter((alias) => normalizedKey(alias) !== normalizedKey(rawQuery))
    .slice(0, 2)
    .forEach((alias) => addVariant(variants, seenQueries, alias, "entity-alias", 2));

  return deepFreeze({
    sourceKind: "wikipedia",
    rawQuery,
    entity: canonicalLabel ? {
      label: canonicalLabel,
      aliases: aliases.slice(0, 3)
    } : null,
    variants: variants.slice(0, MAX_VARIANTS)
  });
}

export function buildSearchPlans(query, entity, mediaTypes) {
  return Object.fromEntries((Array.isArray(mediaTypes) ? mediaTypes : []).map((mediaType) => [
    mediaType,
    mediaType === "text"
      ? buildWikipediaSearchPlan(query, entity)
      : buildCommonsSearchPlan(query, entity)
  ]));
}
