import { deepFreeze, unique } from "./utils.js";

export const SOURCE_REGISTRY_VERSION = 1;
export const SOURCE_HEALTH = Object.freeze(["healthy", "degraded", "rate-limited", "offline", "auth-error", "schema-change"]);
export const CONTENT_TYPES = Object.freeze(["article", "dictionary", "source-text", "travel-guide", "image", "audio", "video", "museum-object", "dataset", "map", "knowledge-entity"]);

function source(record) {
  return deepFreeze({
    ...record,
    registryVersion: SOURCE_REGISTRY_VERSION,
    contentTypes: unique(record.contentTypes),
    languages: unique(record.languages),
    geography: unique(record.geography),
    rightsModel: {
      mode: "item-level",
      acceptedLicenses: unique(record.rightsModel?.acceptedLicenses || ["cc0", "public-domain", "public-domain-mark", "cc-by-4.0", "cc-by-sa-4.0", "cc-by-3.0", "cc-by-sa-3.0"]),
      verifyAtSource: true,
      failClosed: true,
      reviewQueue: "rights-review",
      ...record.rightsModel
    },
    quality: {
      metadataCompleteness: record.quality?.metadataCompleteness ?? 0.7,
      rightsConfidence: record.quality?.rightsConfidence ?? 0.7,
      accessibilityCoverage: record.quality?.accessibilityCoverage ?? 0.45,
      localPerspective: record.quality?.localPerspective ?? 0.4
    },
    refresh: {
      cadence: record.refresh?.cadence || "weekly",
      checkpointField: record.refresh?.checkpointField || "modifiedAt",
      backoff: record.refresh?.backoff || "exponential"
    },
    health: {
      status: record.health?.status || "healthy",
      checkedAt: record.health?.checkedAt || "2026-08-10T00:00:00.000Z",
      message: record.health?.message || "Fixture-backed connector is available."
    }
  });
}

export const SOURCE_REGISTRY = deepFreeze([
  source({ id: "wikipedia", name: "Wikipedia", connector: "wikimedia-knowledge", auth: { type: "none" }, rateLimit: { requestsPerMinute: 200, burst: 50, policy: "respect maxlag and retry-after" }, contentTypes: ["article"], languages: ["en", "es", "ar", "fr"], geography: ["global"], terms: { url: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use", attribution: "Wikimedia attribution required" } }),
  source({ id: "wikidata", name: "Wikidata", connector: "wikimedia-knowledge", auth: { type: "none" }, rateLimit: { requestsPerMinute: 200, burst: 50, policy: "respect maxlag and retry-after" }, contentTypes: ["knowledge-entity"], languages: ["multilingual"], geography: ["global"], rightsModel: { acceptedLicenses: ["cc0"] }, terms: { url: "https://www.wikidata.org/wiki/Wikidata:Licensing", attribution: "CC0 data" } }),
  source({ id: "wikisource", name: "Wikisource", connector: "wikimedia-knowledge", auth: { type: "none" }, rateLimit: { requestsPerMinute: 180, burst: 40, policy: "respect maxlag and retry-after" }, contentTypes: ["source-text"], languages: ["en", "fr", "ar"], geography: ["global"], terms: { url: "https://wikisource.org/wiki/Wikisource:Copyright_policy", attribution: "Wikisource attribution required" } }),
  source({ id: "wikivoyage", name: "Wikivoyage", connector: "wikimedia-knowledge", auth: { type: "none" }, rateLimit: { requestsPerMinute: 180, burst: 40, policy: "respect maxlag and retry-after" }, contentTypes: ["travel-guide"], languages: ["en", "fr", "ar"], geography: ["global"], terms: { url: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use", attribution: "Wikivoyage attribution required" } }),
  source({ id: "wiktionary", name: "Wiktionary", connector: "wikimedia-knowledge", auth: { type: "none" }, rateLimit: { requestsPerMinute: 180, burst: 40, policy: "respect maxlag and retry-after" }, contentTypes: ["dictionary"], languages: ["multilingual"], geography: ["global"], terms: { url: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use", attribution: "Wiktionary attribution required" } }),
  source({ id: "wikimedia-commons", name: "Wikimedia Commons", connector: "wikimedia-commons", auth: { type: "none" }, rateLimit: { requestsPerMinute: 200, burst: 50, policy: "respect maxlag and retry-after" }, contentTypes: ["image", "audio", "video"], languages: ["multilingual"], geography: ["global"], quality: { metadataCompleteness: 0.82, rightsConfidence: 0.9, accessibilityCoverage: 0.55, localPerspective: 0.48 }, terms: { url: "https://commons.wikimedia.org/wiki/Commons:Licensing", attribution: "File and creator attribution required" } }),
  source({ id: "openverse", name: "Openverse", connector: "openverse", auth: { type: "oauth-client-credentials", secretNames: ["OPENVERSE_CLIENT_ID", "OPENVERSE_CLIENT_SECRET"] }, rateLimit: { requestsPerMinute: 60, burst: 20, policy: "authenticate with client credentials, cache candidates, and recheck original source" }, contentTypes: ["image", "audio"], languages: ["multilingual"], geography: ["global"], quality: { metadataCompleteness: 0.68, rightsConfidence: 0.62, accessibilityCoverage: 0.38, localPerspective: 0.4 }, terms: { url: "https://openverse.org/terms-of-use", attribution: "Original source attribution required" } }),
  source({ id: "smithsonian-open-access", name: "Smithsonian Open Access", connector: "cultural-aggregators", auth: { type: "api-key", secretNames: ["SMITHSONIAN_API_KEY", "DATA_GOV_API_KEY"] }, rateLimit: { requestsPerMinute: 100, burst: 25, policy: "respect API key limits" }, contentTypes: ["museum-object", "image"], languages: ["en"], geography: ["global", "US"], rightsModel: { acceptedLicenses: ["cc0"] }, quality: { metadataCompleteness: 0.86, rightsConfidence: 0.92, accessibilityCoverage: 0.5, localPerspective: 0.32 }, terms: { url: "https://www.si.edu/openaccess", attribution: "Smithsonian metadata and object attribution" } }),
  source({ id: "europeana", name: "Europeana", connector: "cultural-aggregators", auth: { type: "optional-api-key", secretName: "EUROPEANA_API_KEY" }, rateLimit: { requestsPerMinute: 120, burst: 30, policy: "respect API key quota" }, contentTypes: ["image", "museum-object", "source-text"], languages: ["multilingual"], geography: ["Europe", "global"], quality: { metadataCompleteness: 0.76, rightsConfidence: 0.72, accessibilityCoverage: 0.42, localPerspective: 0.36 }, terms: { url: "https://www.europeana.eu/en/rights", attribution: "Provider and rights statement required" } }),
  source({ id: "dpla", name: "Digital Public Library of America", connector: "cultural-aggregators", auth: { type: "optional-api-key", secretName: "DPLA_API_KEY" }, rateLimit: { requestsPerMinute: 120, burst: 30, policy: "respect API key quota" }, contentTypes: ["image", "source-text", "map"], languages: ["en"], geography: ["US", "global"], quality: { metadataCompleteness: 0.74, rightsConfidence: 0.7, accessibilityCoverage: 0.36, localPerspective: 0.28 }, terms: { url: "https://pro.dp.la/developers/policies", attribution: "Holding institution attribution required" } })
]);

export function createSourceRegistry(records = SOURCE_REGISTRY) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return deepFreeze({
    version: SOURCE_REGISTRY_VERSION,
    records: [...byId.values()],
    byId: Object.fromEntries(byId),
    connectorIds: unique([...byId.values()].map((record) => record.connector))
  });
}

export function getSource(sourceId, registry = SOURCE_REGISTRY) {
  const records = Array.isArray(registry) ? registry : registry.records;
  return records.find((record) => record.id === sourceId) || null;
}

export function validateSourceRecord(record) {
  const errors = [];
  if (!record?.id) errors.push("source.id is required");
  if (!record?.connector) errors.push("source.connector is required");
  if (!record?.auth?.type) errors.push("source.auth.type is required");
  if (!record?.rateLimit?.requestsPerMinute) errors.push("source.rateLimit.requestsPerMinute is required");
  if (!record?.contentTypes?.length || record.contentTypes.some((type) => !CONTENT_TYPES.includes(type))) errors.push("source.contentTypes must use supported content types");
  if (!record?.rightsModel?.verifyAtSource || !record?.rightsModel?.failClosed) errors.push("source rights must verify at source and fail closed");
  if (!record?.rightsModel?.reviewQueue) errors.push("source rights must define a review queue");
  if (!SOURCE_HEALTH.includes(record?.health?.status)) errors.push("source.health.status is invalid");
  return { valid: errors.length === 0, errors };
}
