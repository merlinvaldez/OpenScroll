import { validateUniversalContentObject } from "./content-object.js";
import { isEligibleRights } from "./rights.js";
import { SOURCE_REGISTRY } from "./source-registry.js";
import { cleanString, deepFreeze } from "./utils.js";

export const CONNECTOR_CONTRACT_VERSION = "connector.v1";
export const CONNECTOR_METHODS = Object.freeze(["search", "fetch", "normalize", "extractRights", "fetchMedia", "resolveEntities", "refresh", "rateLimit", "healthcheck"]);

export function createConnector(definition) {
  const missing = CONNECTOR_METHODS.filter((method) => typeof definition?.[method] !== "function");
  if (!definition?.id) missing.push("id");
  if (missing.length) throw new Error(`Connector is missing required contract fields: ${missing.join(", ")}`);
  return deepFreeze({ version: CONNECTOR_CONTRACT_VERSION, ...definition });
}

export async function runConnectorConformance(connector, options = {}) {
  if (connector.version !== CONNECTOR_CONTRACT_VERSION) throw new Error(`Unsupported connector version: ${connector.version}`);
  const registry = options.registry || SOURCE_REGISTRY;
  const query = cleanString(options.query || "Morocco", 120);
  const checks = [];
  const rejected = [];
  const objects = [];
  const health = await connector.healthcheck({ registry });
  checks.push({ name: "healthcheck", passed: Boolean(health?.status) });
  const rateLimit = await connector.rateLimit({ registry });
  checks.push({ name: "rate-limit", passed: Boolean(rateLimit?.policy && Number.isFinite(rateLimit.requestsPerMinute)) });
  const candidates = await connector.search({ query, registry });
  checks.push({ name: "search", passed: Array.isArray(candidates) });
  for (const candidate of candidates) {
    const fetched = await connector.fetch(candidate.id, { registry });
    const rights = await connector.extractRights(fetched, { registry });
    if (!isEligibleRights(rights)) {
      rejected.push({ id: fetched.id, sourceId: fetched.sourceId, reason: rights.rejectedReason });
      continue;
    }
    const media = await connector.fetchMedia(fetched, { registry });
    const entities = await connector.resolveEntities(fetched, { registry });
    const normalized = await connector.normalize({ ...fetched, media: { ...fetched.media, ...media }, entities: entities.length ? entities : fetched.entities }, { registry });
    const validation = validateUniversalContentObject(normalized, registry);
    checks.push({ name: `normalize:${fetched.id}`, passed: validation.valid, errors: validation.errors });
    objects.push(normalized);
  }
  const refresh = await connector.refresh({ registry, cursor: options.cursor || null });
  checks.push({ name: "refresh", passed: Boolean(refresh?.checkpoint) });
  return deepFreeze({
    connectorId: connector.id,
    passed: checks.every((check) => check.passed),
    checks,
    objectCount: objects.length,
    rejected,
    objects,
    refresh
  });
}
