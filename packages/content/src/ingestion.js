import { validateUniversalContentObject } from "./content-object.js";
import { isEligibleRights } from "./rights.js";
import { SOURCE_REGISTRY } from "./source-registry.js";
import { cleanString, deepFreeze, slug } from "./utils.js";

export function createIngestionJob({ connectorId, sourceIds, query }) {
  const cleanQuery = cleanString(query || "Morocco", 120);
  return deepFreeze({
    id: `ingest:${connectorId}:${slug(cleanQuery)}`,
    connectorId,
    sourceIds: [...sourceIds],
    query: cleanQuery,
    status: "queued",
    attempts: 0
  });
}

async function withRetries(operation, maxRetries) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }
  return { error: lastError, attempts: maxRetries + 1 };
}

export async function runIngestion({ connectors, query = "Morocco", registry = SOURCE_REGISTRY, maxRetries = 2 } = {}) {
  const objectsById = new Map();
  const jobs = [];
  const checkpoints = [];
  const rejected = [];
  const deadLetters = [];
  for (const connector of connectors) {
    const job = createIngestionJob({ connectorId: connector.id, sourceIds: connector.sourceIds, query });
    const result = await withRetries(async () => {
      const health = await connector.healthcheck({ registry });
      const rateLimit = await connector.rateLimit({ registry });
      if (health.status === "offline" || health.status === "auth-error") throw new Error(`Connector unavailable: ${health.status}`);
      const candidates = await connector.search({ query, registry });
      const accepted = [];
      for (const candidate of candidates) {
        const fetched = await connector.fetch(candidate.id, { registry });
        const rights = await connector.extractRights(fetched, { registry });
        if (!isEligibleRights(rights)) {
          rejected.push({ id: fetched.id, sourceId: fetched.sourceId, connectorId: connector.id, reason: rights.rejectedReason });
          continue;
        }
        const media = await connector.fetchMedia(fetched, { registry });
        const entities = await connector.resolveEntities(fetched, { registry });
        const object = await connector.normalize({ ...fetched, media: { ...fetched.media, ...media }, entities }, { registry });
        const validation = validateUniversalContentObject(object, registry);
        if (!validation.valid) {
          rejected.push({ id: fetched.id, sourceId: fetched.sourceId, connectorId: connector.id, reason: validation.errors.join("; ") });
          continue;
        }
        accepted.push(object);
      }
      const refresh = await connector.refresh({ registry, cursor: job.id });
      return { accepted, checkpoint: refresh.checkpoint, health, rateLimit };
    }, maxRetries);
    if (result.error) {
      deadLetters.push({ jobId: job.id, connectorId: connector.id, error: result.error.message, attempts: result.attempts });
      jobs.push({ ...job, status: "dead-lettered", attempts: result.attempts });
      continue;
    }
    for (const object of result.value.accepted) objectsById.set(object.id, object);
    checkpoints.push({ connectorId: connector.id, checkpoint: result.value.checkpoint, rateLimit: result.value.rateLimit });
    jobs.push({ ...job, status: "complete", attempts: result.attempts, objectCount: result.value.accepted.length });
  }
  return deepFreeze({
    schemaVersion: "ingestion-run.v1",
    id: `run:${slug(query)}:${connectors.map((connector) => connector.id).join("+")}`,
    query: cleanString(query, 120),
    status: deadLetters.length ? "partial" : "complete",
    jobs,
    checkpoints,
    objects: [...objectsById.values()],
    rejected,
    deadLetters
  });
}
