import { createUniversalContentObject } from "./content-object.js";
import { createConnector } from "./connector-sdk.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";
import { evaluateRights } from "./rights.js";
import { SOURCE_REGISTRY, getSource } from "./source-registry.js";
import { cleanString, deepFreeze, slug, unique } from "./utils.js";

function searchableText(record) {
  const placeTokens = (record.places || []).flatMap((place) => [place.label, place.countryCode === "MA" ? "Morocco" : place.countryCode]);
  return [record.id, record.sourceItemId, record.title, record.originalTitle, record.description, record.sourceId, ...(record.topics || []), ...placeTokens].join(" ").toLowerCase();
}

function recordsFor(sourceIds, query = "Morocco") {
  const tokens = cleanString(query, 120).toLowerCase().split(/\s+/).filter(Boolean);
  return EPIC_C_RAW_ITEMS.filter((record) => sourceIds.includes(record.sourceId)).filter((record) => !tokens.length || tokens.some((token) => searchableText(record).includes(token)) || searchableText(record).includes("morocco"));
}

function highestRateLimit(sourceIds, registry = SOURCE_REGISTRY) {
  const sources = sourceIds.map((sourceId) => getSource(sourceId, registry)).filter(Boolean);
  return {
    requestsPerMinute: Math.min(...sources.map((source) => source.rateLimit.requestsPerMinute)),
    burst: Math.min(...sources.map((source) => source.rateLimit.burst)),
    policy: unique(sources.map((source) => source.rateLimit.policy)).join("; ")
  };
}

function healthFor(sourceIds, registry = SOURCE_REGISTRY) {
  const sources = sourceIds.map((sourceId) => getSource(sourceId, registry)).filter(Boolean);
  const degraded = sources.find((source) => source.health.status !== "healthy");
  return { status: degraded?.health.status || "healthy", checkedAt: "2026-08-10T00:00:00.000Z", sourceIds };
}

function createFixtureConnector({ id, sourceIds, originalRightsRecheck = false }) {
  return createConnector({
    id,
    sourceIds,
    async search({ query }) {
      return recordsFor(sourceIds, query).map((record) => ({ id: record.id, sourceId: record.sourceId, score: record.topics?.includes(query) ? 1 : 0.75 }));
    },
    async fetch(idToFetch) {
      const record = EPIC_C_RAW_ITEMS.find((item) => item.id === idToFetch && sourceIds.includes(item.sourceId));
      if (!record) throw new Error(`Fixture record not found: ${idToFetch}`);
      return record;
    },
    async normalize(record, { registry = SOURCE_REGISTRY } = {}) {
      return createUniversalContentObject(record, { registry, ingestRunId: `fixture:${id}` });
    },
    async extractRights(record, { registry = SOURCE_REGISTRY } = {}) {
      const source = getSource(record.sourceId, registry);
      const sourceUrl = originalRightsRecheck ? record.originalSourceUrl || record.sourceUrl : record.sourceUrl;
      return evaluateRights(record.rights, { sourceId: source.id, sourceName: source.name, sourceUrl });
    },
    async fetchMedia(record) {
      return { ...record.media, status: record.media?.url ? "available" : "metadata-only" };
    },
    async resolveEntities(record) {
      return record.entities || [];
    },
    async refresh({ cursor = null } = {}) {
      return { checkpoint: `${id}:${cursor || "initial"}:${slug(new Date("2026-08-10T00:00:00.000Z").toISOString())}`, sourceIds };
    },
    async rateLimit({ registry = SOURCE_REGISTRY } = {}) {
      return highestRateLimit(sourceIds, registry);
    },
    async healthcheck({ registry = SOURCE_REGISTRY } = {}) {
      return healthFor(sourceIds, registry);
    }
  });
}

export const wikimediaKnowledgeConnector = createFixtureConnector({ id: "wikimedia-knowledge", sourceIds: ["wikipedia", "wikidata", "wikisource", "wikivoyage", "wiktionary"] });
export const wikimediaCommonsConnector = createFixtureConnector({ id: "wikimedia-commons", sourceIds: ["wikimedia-commons"] });
export const openverseConnector = createFixtureConnector({ id: "openverse", sourceIds: ["openverse"], originalRightsRecheck: true });
export const culturalAggregatorsConnector = createFixtureConnector({ id: "cultural-aggregators", sourceIds: ["smithsonian-open-access", "europeana", "dpla"] });

export const EPIC_C_CONNECTORS = deepFreeze([wikimediaKnowledgeConnector, wikimediaCommonsConnector, openverseConnector, culturalAggregatorsConnector]);
