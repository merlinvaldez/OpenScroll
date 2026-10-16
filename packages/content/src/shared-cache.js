import crypto from "node:crypto";
import { cleanString } from "./utils.js";

export const DEFAULT_CACHE_MAX_ENTRIES = 1000;
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class BoundedTtlCache {
  constructor({ maxEntries = DEFAULT_CACHE_MAX_ENTRIES, defaultTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
    this.maxEntries = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : DEFAULT_CACHE_MAX_ENTRIES;
    this.defaultTtlMs = Number.isFinite(defaultTtlMs) && defaultTtlMs > 0 ? defaultTtlMs : DEFAULT_CACHE_TTL_MS;
    this.entries = new Map();
    this.inFlight = new Map();
  }

  get(key) {
    if (!key) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh LRU order: delete and re-insert at end of Map
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (!key || value === undefined) return;
    const now = Date.now();
    const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : this.defaultTtlMs;

    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      this._evictOldest();
    }

    this.entries.set(key, {
      value,
      expiresAt: now + effectiveTtl
    });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.inFlight.delete(key);
    return this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
  }

  get size() {
    return this.entries.size;
  }

  async coalesce(key, fetcherFn, ttlMs) {
    if (!key) return fetcherFn();

    const cached = this.get(key);
    if (cached !== undefined) return cached;

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const result = await fetcherFn();
        if (result !== undefined && result !== null) {
          this.set(key, result, ttlMs);
        }
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  _evictOldest() {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        return;
      }
    }

    const oldestKey = this.entries.keys().next().value;
    if (oldestKey !== undefined) {
      this.entries.delete(oldestKey);
    }
  }
}

// Canonical hash helper for stable cache keys
export function hashString(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

export function computeEntityCacheKey(query, locale = "en") {
  const cleanQ = cleanString(query, 120).toLowerCase().trim();
  const cleanLocale = cleanString(locale, 20).toLowerCase().trim() || "en";
  return `entity:${cleanLocale}:${cleanQ}`;
}

export function computeSourceCacheKey({ sourceId, query, mediaType = "", offset = 0, continuation = null }) {
  const cleanSource = cleanString(sourceId, 60).toLowerCase();
  const cleanQ = cleanString(query, 160).toLowerCase().trim();
  const cleanMedia = cleanString(mediaType, 40).toLowerCase();
  const contHash = continuation ? hashString(JSON.stringify(continuation)) : "none";
  return `src:${cleanSource}:${cleanMedia}:${cleanQ}:${offset}:${contHash}`;
}

export function computeDecisionCacheKey({ term, topicMeaning, model, promptVersion, threshold, candidate }) {
  const cleanTerm = cleanString(term, 160).toLowerCase().trim();
  const topicLabel = cleanString(topicMeaning?.label, 120).toLowerCase().trim() || cleanTerm;
  const candidateId = candidate?.id || "unknown";
  const title = cleanString(candidate.content?.title || candidate.title, 120).toLowerCase().trim();
  const contentHash = hashString(`${title}|${cleanString(candidate.content?.description || candidate.description, 200)}`);
  const safeModel = cleanString(model, 60);
  const safePrompt = cleanString(promptVersion, 60);
  const safeThreshold = Number(threshold).toFixed(2);

  return `dec:${topicLabel}:${safeModel}:${safePrompt}:${safeThreshold}:${candidateId}:${contentHash}`;
}

// Global shared caches (for public, non-personalized content only)
export const entityInterpretationCache = new BoundedTtlCache({ maxEntries: 500, defaultTtlMs: 30 * 60 * 1000 });
export const sourceMetadataCache = new BoundedTtlCache({ maxEntries: 1000, defaultTtlMs: 10 * 60 * 1000 });
export const relevanceDecisionsCache = new BoundedTtlCache({ maxEntries: 2000, defaultTtlMs: 60 * 60 * 1000 });
