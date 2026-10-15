import crypto from "node:crypto";
import { cleanString } from "./utils.js";

async function getFs() {
  const importer = new Function("mod", "return import(mod)");
  return importer("node:fs/promises");
}

async function getPath() {
  const importer = new Function("mod", "return import(mod)");
  return importer("node:path");
}

export const FEED_CONTINUATION_VERSION = "feed-continuation.v1";
export const DEFAULT_CONTINUATION_TTL_MS = 60 * 60 * 1000; // 1 hour
export const MAX_CONTINUATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CONTINUATION_TOKEN_LENGTH = 512;
export const MAX_QUERY_LENGTH = 200;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;
export const CONTINUATION_TOKEN_PREFIX = "fcont_";

function getSecret() {
  return process.env.FEED_CONTINUATION_SECRET || "openscroll-default-continuation-secret-2026";
}

function computeHmac(payload, secret = getSecret()) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 16);
}

export class ContinuationExpiredError extends Error {
  constructor(message = "The feed session has expired. You can restart the search.") {
    super(message);
    this.name = "ContinuationExpiredError";
    this.status = 410;
    this.code = "CONTINUATION_EXPIRED";
    this.canRestart = true;
  }
}

export class InvalidContinuationError extends Error {
  constructor(message = "Invalid continuation token format") {
    super(message);
    this.name = "InvalidContinuationError";
    this.status = 400;
    this.code = "INVALID_CONTINUATION";
    this.canRestart = true;
  }
}

export class FeedRequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FeedRequestValidationError";
    this.status = 400;
    this.code = "INVALID_REQUEST";
  }
}

export function createContinuationToken(sessionId, seq = 0, secret = getSecret()) {
  if (!sessionId || typeof sessionId !== "string") {
    throw new TypeError("sessionId must be a non-empty string");
  }
  const cleanId = sessionId.replace(/[^a-zA-Z0-9-]/g, "");
  const cleanSeq = Number.isInteger(seq) && seq >= 0 ? seq : 0;
  const payload = `${cleanId}.${cleanSeq}`;
  const hmac = computeHmac(payload, secret);
  return `${CONTINUATION_TOKEN_PREFIX}${cleanId}.${cleanSeq}.${hmac}`;
}

export function parseContinuationToken(token, secret = getSecret()) {
  if (!token || typeof token !== "string") {
    throw new InvalidContinuationError("Continuation token must be a string");
  }
  if (token.length > MAX_CONTINUATION_TOKEN_LENGTH) {
    throw new InvalidContinuationError(`Continuation token exceeds maximum length of ${MAX_CONTINUATION_TOKEN_LENGTH}`);
  }
  if (!token.startsWith(CONTINUATION_TOKEN_PREFIX)) {
    throw new InvalidContinuationError("Continuation token missing required prefix");
  }

  const remainder = token.slice(CONTINUATION_TOKEN_PREFIX.length);
  // Support dot delimiter, with underscore fallback for older tokens
  const parts = remainder.includes(".") ? remainder.split(".") : remainder.split("_");
  if (parts.length < 2) {
    throw new InvalidContinuationError("Continuation token structure is malformed");
  }

  const sessionId = parts[0];
  const rawSeq = parts[1];
  const hmac = parts.length > 2 ? parts.slice(2).join("_") : null;
  const seq = Number.parseInt(rawSeq, 10);
  if (!sessionId || !Number.isInteger(seq) || seq < 0) {
    throw new InvalidContinuationError("Continuation token contains invalid session or sequence");
  }

  // If signature part is present, verify HMAC
  if (hmac) {
    const expected = computeHmac(`${sessionId}.${seq}`, secret);
    if (hmac !== expected) {
      throw new InvalidContinuationError("Continuation token signature verification failed");
    }
  }

  return { sessionId, seq };
}

export function validateFeedRequest(body = {}) {
  const { interest, pageSize, continuation, cursor, mediaTypes } = body;
  const token = typeof continuation === "string" ? continuation : typeof cursor === "string" ? cursor : null;

  if (token) {
    parseContinuationToken(token);
  }

  if (interest !== undefined && interest !== null) {
    if (typeof interest !== "string") {
      throw new FeedRequestValidationError("Search interest must be a string");
    }
    const trimmed = interest.trim();
    if (!token && trimmed.length === 0) {
      throw new FeedRequestValidationError("A search term is required");
    }
    if (trimmed.length > MAX_QUERY_LENGTH) {
      throw new FeedRequestValidationError(`Search term exceeds maximum length of ${MAX_QUERY_LENGTH} characters`);
    }
  } else if (!token) {
    throw new FeedRequestValidationError("A search term is required");
  }

  if (pageSize !== undefined && pageSize !== null) {
    const parsedPageSize = Number(pageSize);
    if (!Number.isInteger(parsedPageSize) || parsedPageSize < MIN_PAGE_SIZE || parsedPageSize > MAX_PAGE_SIZE) {
      throw new FeedRequestValidationError(`pageSize must be an integer between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`);
    }
  }

  if (mediaTypes !== undefined && mediaTypes !== null) {
    if (!Array.isArray(mediaTypes) || mediaTypes.length === 0) {
      throw new FeedRequestValidationError("At least one media type is required");
    }
  }

  return true;
}

export function createFeedContinuationState({
  id = crypto.randomUUID(),
  query,
  topicMeaning = null,
  mediaTypes = [],
  sources = {},
  seed = null,
  planVersion = "search-plan.v1",
  searchPlan = null,
  evalConfig = null,
  ttlMs = DEFAULT_CONTINUATION_TTL_MS
} = {}) {
  const cleanQuery = cleanString(query, MAX_QUERY_LENGTH);
  if (!cleanQuery) {
    throw new TypeError("query is required to create continuation state");
  }

  const now = Date.now();
  const safeTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.min(ttlMs, MAX_CONTINUATION_TTL_MS) : DEFAULT_CONTINUATION_TTL_MS;

  return {
    schemaVersion: FEED_CONTINUATION_VERSION,
    id: cleanString(id, 80) || crypto.randomUUID(),
    query: cleanQuery,
    topicMeaning: topicMeaning ? {
      label: cleanString(topicMeaning.label, 120),
      description: cleanString(topicMeaning.description, 400),
      aliases: Array.isArray(topicMeaning.aliases) ? topicMeaning.aliases.map((a) => cleanString(a, 120)).filter(Boolean) : []
    } : null,
    mediaTypes: Object.freeze(Array.from(new Set(Array.isArray(mediaTypes) ? mediaTypes : []))),
    sources: Object.freeze(typeof sources === "object" && sources !== null ? { ...sources } : {}),
    seed: Number.isFinite(seed) ? seed : null,
    planVersion: cleanString(planVersion, 40) || "search-plan.v1",
    searchPlan: searchPlan ? JSON.parse(JSON.stringify(searchPlan)) : null,
    evalConfig: evalConfig ? { ...evalConfig } : {
      evaluator: "topic-engine.v1",
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      threshold: 0.6
    },
    upstreamContinuations: {},
    exhaustedPairs: [],
    seenIds: [],
    deliveredIds: [],
    pendingAccepted: [],
    candidateCache: {},
    deliveredBatches: {},
    currentSeq: 0,
    exhausted: false,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + safeTtl
  };
}

export function validateFeedContinuation(state) {
  const errors = [];
  if (state?.schemaVersion !== FEED_CONTINUATION_VERSION) errors.push(`schemaVersion must be ${FEED_CONTINUATION_VERSION}`);
  if (!state?.id) errors.push("id is required");
  if (!state?.query) errors.push("query is required");
  if (!Array.isArray(state?.mediaTypes) || !state.mediaTypes.length) errors.push("mediaTypes must be non-empty array");
  if (typeof state?.sources !== "object" || state.sources === null) errors.push("sources must be an object");
  if (!state?.planVersion) errors.push("planVersion is required");
  if (typeof state?.evalConfig !== "object" || state.evalConfig === null) errors.push("evalConfig must be an object");
  if (!Number.isFinite(state?.createdAt)) errors.push("createdAt must be a timestamp");
  if (!Number.isFinite(state?.updatedAt)) errors.push("updatedAt must be a timestamp");
  if (!Number.isFinite(state?.expiresAt)) errors.push("expiresAt must be a timestamp");
  return { valid: errors.length === 0, errors };
}

export class FileFeedContinuationStore {
  constructor({ storeDir, defaultTtlMs = DEFAULT_CONTINUATION_TTL_MS } = {}) {
    this._customStoreDir = storeDir;
    this.storeDir = storeDir || process.env.FEED_CONTINUATION_STORE_DIR || null;
    this.defaultTtlMs = defaultTtlMs;
    this._initialized = false;
  }

  async _resolveStoreDir() {
    if (this.storeDir) return this.storeDir;
    const pathMod = await getPath();
    const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ".";
    this.storeDir = pathMod.join(cwd, ".openscroll", "feed-sessions");
    return this.storeDir;
  }

  async _ensureDir() {
    await this._resolveStoreDir();
    if (this._initialized) return;
    const fsMod = await getFs();
    await fsMod.mkdir(this.storeDir, { recursive: true });
    this._initialized = true;
  }

  async _filePath(id) {
    await this._resolveStoreDir();
    const pathMod = await getPath();
    const safeId = id.replace(/[^a-zA-Z0-9-]/g, "");
    return pathMod.join(this.storeDir, `${safeId}.json`);
  }

  async get(id) {
    await this._ensureDir();
    const fsMod = await getFs();
    const filePath = await this._filePath(id);
    try {
      const content = await fsMod.readFile(filePath, "utf-8");
      const state = JSON.parse(content);
      if (Date.now() > state.expiresAt) {
        await this.delete(id);
        return null;
      }
      return state;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async put(id, state, { ttlMs = this.defaultTtlMs } = {}) {
    await this._ensureDir();
    const fsMod = await getFs();
    const now = Date.now();
    const safeTtl = Number.isFinite(ttlMs) ? Math.min(ttlMs, MAX_CONTINUATION_TTL_MS) : this.defaultTtlMs;
    const updated = {
      ...state,
      id,
      updatedAt: now,
      expiresAt: state.expiresAt && ttlMs === undefined ? state.expiresAt : now + safeTtl
    };

    const filePath = await this._filePath(id);
    const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    const serialized = JSON.stringify(updated);

    await fsMod.writeFile(tempPath, serialized, "utf-8");
    await fsMod.rename(tempPath, filePath);
    return updated;
  }

  async touch(id, { ttlMs = this.defaultTtlMs } = {}) {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.put(id, existing, { ttlMs });
  }

  async delete(id) {
    await this._ensureDir();
    const fsMod = await getFs();
    const filePath = await this._filePath(id);
    try {
      await fsMod.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async prune() {
    await this._ensureDir();
    const fsMod = await getFs();
    const pathMod = await getPath();
    let prunedCount = 0;
    let activeCount = 0;
    const now = Date.now();
    try {
      const entries = await fsMod.readdir(this.storeDir);
      for (const entry of entries) {
        if (!entry.endsWith(".json")) continue;
        const filePath = pathMod.join(this.storeDir, entry);
        try {
          const content = await fsMod.readFile(filePath, "utf-8");
          const state = JSON.parse(content);
          if (now > state.expiresAt || state.schemaVersion !== FEED_CONTINUATION_VERSION) {
            await fsMod.unlink(filePath);
            prunedCount += 1;
          } else {
            activeCount += 1;
          }
        } catch {
          try { await fsMod.unlink(filePath); prunedCount += 1; } catch { /* ignore */ }
        }
      }
    } catch { /* directory error handled */ }
    return { prunedCount, activeCount };
  }
}

export class MemoryFeedContinuationStore {
  constructor({ defaultTtlMs = DEFAULT_CONTINUATION_TTL_MS } = {}) {
    this.map = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  async get(id) {
    const entry = this.map.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(id);
      return null;
    }
    return JSON.parse(JSON.stringify(entry));
  }

  async put(id, state, { ttlMs = this.defaultTtlMs } = {}) {
    const now = Date.now();
    const safeTtl = Number.isFinite(ttlMs) ? Math.min(ttlMs, MAX_CONTINUATION_TTL_MS) : this.defaultTtlMs;
    const cloned = JSON.parse(JSON.stringify({
      ...state,
      id,
      updatedAt: now,
      expiresAt: state.expiresAt && ttlMs === undefined ? state.expiresAt : now + safeTtl
    }));
    this.map.set(id, cloned);
    return JSON.parse(JSON.stringify(cloned));
  }

  async touch(id, { ttlMs = this.defaultTtlMs } = {}) {
    const existing = await this.get(id);
    if (!existing) return null;
    return this.put(id, existing, { ttlMs });
  }

  async delete(id) {
    return this.map.delete(id);
  }

  async prune() {
    const now = Date.now();
    let prunedCount = 0;
    let activeCount = 0;
    for (const [id, state] of this.map.entries()) {
      if (now > state.expiresAt) {
        this.map.delete(id);
        prunedCount += 1;
      } else {
        activeCount += 1;
      }
    }
    return { prunedCount, activeCount };
  }
}

let defaultStoreInstance = null;

export function getContinuationStore(options = {}) {
  if (options.store) return options.store;
  if (process.env.FEED_STORE_TYPE === "memory") {
    if (!defaultStoreInstance || !(defaultStoreInstance instanceof MemoryFeedContinuationStore)) {
      defaultStoreInstance = new MemoryFeedContinuationStore();
    }
    return defaultStoreInstance;
  }

  if (!defaultStoreInstance || !(defaultStoreInstance instanceof FileFeedContinuationStore)) {
    defaultStoreInstance = new FileFeedContinuationStore(options);
  }
  return defaultStoreInstance;
}
