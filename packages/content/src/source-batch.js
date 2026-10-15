import { createUniversalContentObject, validateUniversalContentObject } from "./content-object.js";
import { cleanString } from "./utils.js";

export const SOURCE_BATCH_VERSION = "source-batch.v1";

export const SOURCE_FAILURE_KINDS = Object.freeze(["rate-limited", "timeout", "aborted", "network", "server", "client", "malformed"]);
const RETRYABLE_KINDS = new Set(["rate-limited", "timeout", "network", "server"]);

function envInteger(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

// Server-side configuration. Values are read per call so tests and deployments can override them.
export function getRequestBudgetConfig() {
  return {
    sourceTimeoutMs: envInteger("FEED_SOURCE_TIMEOUT_MS", 6000, { min: 100, max: 60000 }),
    aiTimeoutMs: envInteger("FEED_AI_TIMEOUT_MS", 20000, { min: 100, max: 120000 }),
    requestDeadlineMs: envInteger("FEED_REQUEST_DEADLINE_MS", 45000, { min: 500, max: 300000 }),
    sourceMaxRetries: envInteger("FEED_SOURCE_MAX_RETRIES", 2, { min: 0, max: 5 }),
    aiMaxRetries: envInteger("FEED_AI_MAX_RETRIES", 1, { min: 0, max: 3 }),
    retryBaseDelayMs: envInteger("FEED_RETRY_BASE_DELAY_MS", 250, { min: 0, max: 10000 })
  };
}

export class SourceRequestError extends Error {
  constructor(kind, message, { status = null, retryAfterMs = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "SourceRequestError";
    this.kind = SOURCE_FAILURE_KINDS.includes(kind) ? kind : "network";
    this.retryable = RETRYABLE_KINDS.has(this.kind);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isAbortError(error) {
  return error?.name === "AbortError" || error?.kind === "aborted";
}

export function abortError(message = "The request was cancelled.") {
  const error = new Error(message);
  error.name = "AbortError";
  error.status = 499;
  return error;
}

export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function headerValue(response, name) {
  return typeof response?.headers?.get === "function" ? response.headers.get(name) : null;
}

function classifyStatus(status) {
  if (status === 429) return "rate-limited";
  if (status === 408) return "timeout";
  if (status >= 500) return "server";
  return "client";
}

// Runs one attempt with a timeout that remains active through body reading.
// The timer and the listener on the caller's signal are always cleaned up.
async function attemptJson(url, { signal, timeoutMs, headers, method = "GET", body, fetchImpl, inspect }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener?.("abort", onAbort, { once: true });

  try {
    let response;
    try {
      response = await fetchImpl(url, { method, body, headers, signal: controller.signal });
    } catch (error) {
      throw failureFromThrown(error, { timedOut, signal });
    }

    if (!response?.ok) {
      const status = response?.status ?? null;
      const kind = classifyStatus(status ?? 0);
      let detail = "";
      try { detail = (await response.json())?.error?.message || ""; } catch { /* body is diagnostic only */ }
      throw new SourceRequestError(kind, cleanString(detail, 200) || `Request failed (${status})`, {
        status,
        retryAfterMs: parseRetryAfter(headerValue(response, "retry-after"))
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (timedOut || signal?.aborted || error?.name === "AbortError") throw failureFromThrown(error, { timedOut, signal });
      throw new SourceRequestError("malformed", "Response body was not valid JSON", { status: response.status, cause: error });
    }
    inspect?.(data, response);
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

function failureFromThrown(error, { timedOut, signal }) {
  if (error instanceof SourceRequestError) return error;
  if (signal?.aborted) return new SourceRequestError("aborted", "Request was cancelled", { cause: error });
  if (timedOut) return new SourceRequestError("timeout", "Request timed out", { cause: error });
  return new SourceRequestError("network", cleanString(error?.message, 200) || "Network request failed", { cause: error });
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => { signal?.removeEventListener?.("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

// Fetches JSON with per-attempt timeouts, bounded retries for transient failures,
// Retry-After support, and a hard overall deadline. Throws SourceRequestError.
export async function fetchJsonWithRetry(url, options = {}) {
  const config = getRequestBudgetConfig();
  const {
    signal,
    timeoutMs = config.sourceTimeoutMs,
    maxRetries = config.sourceMaxRetries,
    baseDelayMs = config.retryBaseDelayMs,
    deadline = null,
    headers = {},
    method,
    body,
    onAttempt,
    onRetry,
    inspect,
    fetchImpl = globalThis.fetch,
    now = Date.now
  } = options;

  if (typeof fetchImpl !== "function") throw new SourceRequestError("network", "fetch is unavailable");

  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw new SourceRequestError("aborted", "Request was cancelled");
    const remaining = Number.isFinite(deadline) ? deadline - now() : Infinity;
    if (remaining <= 0) throw new SourceRequestError("timeout", "Request deadline reached");

    onAttempt?.(attempt);
    try {
      return await attemptJson(url, { signal, timeoutMs: Math.max(1, Math.min(timeoutMs, remaining)), headers, method, body, fetchImpl, inspect });
    } catch (error) {
      const failure = failureFromThrown(error, { timedOut: false, signal });
      if (!failure.retryable || attempt >= maxRetries) throw failure;

      const backoff = baseDelayMs * 2 ** attempt;
      const delay = Math.max(backoff, failure.retryAfterMs ?? 0);
      const afterDelay = Number.isFinite(deadline) ? deadline - now() - delay : Infinity;
      // Honor rate-limit guidance: never retry sooner than requested, and give up if that would pass the deadline.
      if (afterDelay <= 0) throw failure;
      onRetry?.(failure, attempt);
      try {
        await wait(delay, signal);
      } catch {
        throw new SourceRequestError("aborted", "Request was cancelled");
      }
    }
  }
}

export function describeFailure(error) {
  const failure = error instanceof SourceRequestError ? error : failureFromThrown(error, { timedOut: false, signal: null });
  return Object.freeze({
    kind: failure.kind,
    retryable: failure.retryable,
    status: Number.isInteger(failure.status) ? failure.status : null,
    retryAfterMs: Number.isFinite(failure.retryAfterMs) ? failure.retryAfterMs : null,
    message: cleanString(failure.message, 200)
  });
}

export function validateFeedCandidate(object) {
  const { errors } = validateUniversalContentObject(object);
  const relevant = errors.filter((error) => {
    if (object?.media?.status === "metadata-only" && error === "media kind and url are required") return false;
    if (error === "id must be a canonical uco id" && (object?.id?.startsWith("uco:") || object?.id?.startsWith("wikipedia:") || object?.id?.startsWith("wikimedia-commons:") || object?.id?.startsWith("smithsonian-open-access:"))) return false;
    return true;
  });
  return { valid: relevant.length === 0, errors: relevant };
}

export function normalizeSourceRecords(records, { metrics } = {}) {
  const items = [];
  const invalid = [];
  for (const raw of Array.isArray(records) ? records : []) {
    try {
      const uco = createUniversalContentObject(raw);
      const candidate = {
        ...raw,
        ...uco,
        id: raw.id || uco.id,
        creators: raw.creators || uco.creator?.names || [],
        sourceUrl: raw.sourceUrl || uco.canonicalUrl
      };
      const { valid, errors } = validateFeedCandidate(candidate);
      if (!valid) throw new Error(errors.join("; "));
      items.push(candidate);
      metrics?.increment("normalizedCandidates");
    } catch (error) {
      metrics?.increment("normalizationFailures");
      invalid.push({ sourceItemId: cleanString(raw?.sourceItemId || raw?.id, 160) || null, reason: cleanString(error?.message, 200) || "Invalid record" });
    }
  }
  return { items, invalid };
}

function plainContinuation(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("continuation must be an object or null");
  const entries = Object.entries(value).filter(([, entry]) => ["string", "number"].includes(typeof entry));
  return entries.length ? Object.freeze(Object.fromEntries(entries)) : null;
}

export class SourceBatch extends Array {
  static get [Symbol.species]() {
    return Array;
  }

  constructor({
    sourceId,
    query,
    items = [],
    invalid = [],
    rawCount = 0,
    continuation = null,
    requestContinuation = null,
    exhausted = false,
    failure = null
  }) {
    super(...items);
    const cleanSourceId = cleanString(sourceId, 80);
    if (!cleanSourceId) throw new TypeError("sourceId is required");
    if (failure && exhausted) throw new TypeError("a failed batch cannot be exhausted");
    if (exhausted && continuation) throw new TypeError("an exhausted batch cannot have a continuation");

    this.version = SOURCE_BATCH_VERSION;
    this.sourceId = cleanSourceId;
    this.query = cleanString(query, 200);
    this.status = failure ? "failed" : exhausted ? "exhausted" : "ok";
    this.items = Object.freeze([...items]);
    this.invalid = Object.freeze([...invalid]);
    this.rawCount = Number.isInteger(rawCount) && rawCount >= 0 ? rawCount : 0;
    this.continuation = plainContinuation(failure ? requestContinuation : continuation);
    this.exhausted = Boolean(exhausted);
    this.failure = failure ? describeFailure(failure) : null;
    Object.freeze(this);
  }
}

export function createSourceBatch(args) {
  return new SourceBatch(args);
}

export function failedSourceBatch({ sourceId, query, error, requestContinuation = null }) {
  return createSourceBatch({ sourceId, query, items: [], failure: error, requestContinuation });
}

export function validateSourceBatch(batch) {
  const errors = [];
  if (batch?.version !== SOURCE_BATCH_VERSION) errors.push(`version must be ${SOURCE_BATCH_VERSION}`);
  if (!batch?.sourceId) errors.push("sourceId is required");
  if (!Array.isArray(batch?.items)) errors.push("items must be an array");
  if (!["ok", "exhausted", "failed"].includes(batch?.status)) errors.push("status is invalid");
  if (batch?.status === "failed" && !batch.failure?.kind) errors.push("failed batches require failure details");
  if (batch?.exhausted && batch?.continuation) errors.push("exhausted batches cannot continue");
  return { valid: errors.length === 0, errors };
}
