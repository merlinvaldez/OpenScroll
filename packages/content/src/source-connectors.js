import { createUniversalContentObject } from "./content-object.js";
import { createConnector } from "./connector-sdk.js";
import { SOURCE_REGISTRY, getSource } from "./source-registry.js";
import { cleanString, deepFreeze, unique } from "./utils.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";
import {
  SourceRequestError,
  createSourceBatch,
  failedSourceBatch,
  fetchJsonWithRetry,
  normalizeSourceRecords,
  parseRetryAfter
} from "./source-batch.js";

import { sourceMetadataCache } from "./shared-cache.js";

const USER_AGENT = "OpenScroll/1.0 (https://github.com/merlinvaldez/OpenScroll; open-knowledge-client)";

export async function asyncPool(concurrency, items, asyncFn) {
  const results = new Array(items.length);
  const poolLimit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await asyncFn(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: poolLimit }, () => worker());
  await Promise.all(workers);
  return results;
}

// Typed source request: per-attempt timeout through body reading, bounded
// retries, caller abort signal, and the overall request deadline.
function sourceJson(url, options = {}, inspect) {
  const cacheKey = `source:${url}`;
  if (!options.skipCache && sourceMetadataCache.has(cacheKey)) {
    options.metrics?.increment("cacheHits");
    return sourceMetadataCache.get(cacheKey);
  }

  const fetcher = () => fetchJsonWithRetry(url, {
    signal: options.signal,
    deadline: options.deadline,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    baseDelayMs: options.retryBaseDelayMs,
    inspect,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    onAttempt: () => options.metrics?.increment("sourceCalls"),
    onRetry: () => options.metrics?.increment("sourceRetries")
  });

  if (options.skipCache) {
    return fetcher();
  }

  return sourceMetadataCache.coalesce(cacheKey, fetcher);
}

// Used only by single-item lookups (article reader) where "not loaded" is the only outcome.
async function optionalJson(url, options = {}) {
  try {
    return await sourceJson(url, options, inspectMediaWikiIfPresent);
  } catch {
    return null;
  }
}

function inspectMediaWikiIfPresent(data, response) {
  if (data?.error) inspectMediaWiki(data, response);
}

// MediaWiki can report errors inside an HTTP 200 body.
function inspectMediaWiki(data, response) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SourceRequestError("malformed", "MediaWiki response was not an object", { status: response?.status });
  }
  if (!data.error) return;
  const code = cleanString(String(data.error.code || ""), 60);
  const retryAfterMs = parseRetryAfter(response?.headers?.get?.("retry-after"));
  const kind = code === "ratelimited" ? "rate-limited"
    : ["maxlag", "readonly", "internal_api_error_DBQueryError", "internal_api_error_DBConnectionError"].includes(code) || code.startsWith("internal_api_error") ? "server"
      : "client";
  throw new SourceRequestError(kind, `MediaWiki error ${code || "unknown"}`, { status: response?.status ?? null, retryAfterMs });
}

const RESERVED_MEDIAWIKI_PARAMS = new Set(["action", "format", "origin", "list", "generator", "prop", "srsearch", "gsrsearch", "titles"]);

// Accepts only the shape MediaWiki returns in `continue`: short scalar values with simple keys.
function sanitizeMediaWikiContinuation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value)
    .filter(([key, entry]) => /^[a-z]{1,24}$/.test(key) && !RESERVED_MEDIAWIKI_PARAMS.has(key) && ["string", "number"].includes(typeof entry) && String(entry).length <= 300)
    .slice(0, 8);
  return entries.length ? Object.fromEntries(entries) : null;
}

// Resumes from source-provided continuation. A legacy integer offset is mapped
// to the equivalent MediaWiki offset parameter for older clients.
function requestedMediaWikiContinuation(options, offsetKey, continueValue) {
  const provided = sanitizeMediaWikiContinuation(options.continuation);
  if (provided) return provided;
  if (Number.isInteger(options.offset) && options.offset > 0) return { [offsetKey]: options.offset, continue: continueValue };
  return null;
}

function applyContinuation(params, continuation) {
  for (const [key, value] of Object.entries(continuation || {})) params.set(key, String(value));
}

function recordSourceFailure(options, error) {
  if (error?.kind !== "aborted") options.metrics?.increment("sourceFailures");
}

// ---------------------------------------------------------------------------
// 1. LIVE WIKIPEDIA / WIKIMEDIA KNOWLEDGE CONNECTOR
// ---------------------------------------------------------------------------
function createWikipediaRecord(pageData, { fullText = "", html = "" } = {}) {
  const overview = pageData.extract || "";
  const articleText = fullText || overview;
  const sourceUrl = pageData.content_urls?.desktop?.page || pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`;

  const imageSource = pageData.originalimage || pageData.original || pageData.thumbnail;
  const thumbSource = pageData.thumbnail || pageData.originalimage || pageData.original;

  return {
    id: `wikipedia:${pageData.pageid || pageData.title}`,
    sourceId: "wikipedia",
    sourceItemId: String(pageData.pageid || pageData.title),
    canonicalUrl: sourceUrl,
    sourceUrl,
    originalSourceUrl: sourceUrl,
    title: pageData.title,
    description: pageData.description || overview,
    language: pageData.lang || "en",
    languages: [pageData.lang || "en"],
    topics: [pageData.title, pageData.description].filter(Boolean),
    creators: [{ name: "Wikipedia Contributors", role: "author" }],
    content: {
      type: "reader",
      text: overview,
      ...(fullText ? { fullText: articleText } : {}),
      ...(html ? { html } : {}),
      readingTimeSeconds: Math.ceil((articleText.split(/\s+/).length || 50) / 3.5),
      isPrimarySource: false,
      sections: fullText ? [] : [{ heading: "Overview", content: overview }],
      images: imageSource ? [{
        url: imageSource.source || imageSource.url,
        thumbnailUrl: thumbSource?.source || thumbSource?.url || imageSource.source || imageSource.url,
        altText: `Image illustrating ${pageData.title}`
      }] : []
    },
    media: imageSource ? {
      kind: "image",
      url: imageSource.source || imageSource.url,
      thumbnailUrl: thumbSource?.source || thumbSource?.url || imageSource.source || imageSource.url,
      width: imageSource.width || null,
      height: imageSource.height || null,
      mime: "image/jpeg",
      accessibility: {
        altText: `Image illustrating ${pageData.title}`
      }
    } : null,
    provenance: {
      capturedAt: new Date().toISOString(),
      origin: "original"
    },
    ranking: {
      quality: 0.88,
      curationTier: "standard"
    }
  };
}

export async function searchWikipediaLive(query, limit = 8, options = {}) {
  const cleanQ = cleanString(query, 100);
  const requestContinuation = requestedMediaWikiContinuation(options, "sroffset", "-||");
  const params = new URLSearchParams({ action: "query", list: "search", srsearch: cleanQ, format: "json", srlimit: String(limit), origin: "*" });
  applyContinuation(params, requestContinuation);

  try {
    const searchData = await sourceJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`, options, inspectMediaWiki);
    if (!Array.isArray(searchData?.query?.search)) {
      throw new SourceRequestError("malformed", "Wikipedia search response is missing query.search");
    }
    const hits = searchData.query.search;
    options.metrics?.increment("rawResults", hits.length);

    const fetched = await asyncPool(4, hits, async (item) => {
      const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title)}`;
      try {
        const pageData = await sourceJson(pageUrl, options);
        if (pageData?.type === "standard") return createWikipediaRecord(pageData);
        return null;
      } catch (error) {
        // A page deleted since indexing is filtered; any other failure fails the batch so its position stays retryable.
        if (error?.status === 404) return null;
        throw error;
      }
    });

    const records = fetched.filter(Boolean);

    const { items, invalid } = normalizeSourceRecords(records, options);
    const continuation = sanitizeMediaWikiContinuation(searchData.continue);
    return createSourceBatch({ sourceId: "wikipedia", query: cleanQ, items, invalid, rawCount: hits.length, continuation, exhausted: !continuation });
  } catch (error) {
    recordSourceFailure(options, error);
    return failedSourceBatch({ sourceId: "wikipedia", query: cleanQ, error, requestContinuation });
  }
}

export async function fetchWikipediaArticleLive(title) {
  const cleanTitle = cleanString(title, 180);
  if (!cleanTitle) return null;

  const params = new URLSearchParams({
    action: "query",
    prop: "extracts|info|pageimages",
    explaintext: "1",
    exsectionformat: "plain",
    inprop: "url",
    piprop: "original|thumbnail",
    pithumbsize: "1600",
    redirects: "1",
    format: "json",
    titles: cleanTitle,
    origin: "*"
  });
  const parseParams = new URLSearchParams({
    action: "parse",
    page: cleanTitle,
    prop: "text|sections",
    disabletoc: "1",
    format: "json",
    origin: "*"
  });
  const [data, parsedData] = await Promise.all([
    optionalJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`),
    optionalJson(`https://en.wikipedia.org/w/api.php?${parseParams.toString()}`)
  ]);
  const page = Object.values(data?.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.extract) return null;

  return createWikipediaRecord({
    ...page,
    description: page.extract.split(/\n+/)[0],
    content_urls: { desktop: { page: page.fullurl } }
  }, {
    fullText: page.extract,
    html: parsedData?.parse?.text?.["*"] || ""
  });
}

// ---------------------------------------------------------------------------
// 2. LIVE WIKIMEDIA COMMONS CONNECTOR (Images, Audio, Historical media)
// ---------------------------------------------------------------------------
const COMMONS_MEDIA_TYPE_FILTERS = Object.freeze({
  image: "filetype:bitmap",
  audio: "filetype:audio",
  video: "filetype:video",
  text: "filetype:text",
  data: "(filetype:office OR filetype:archive OR filetype:3d)"
});

function classifyCommonsMediaKind(mime = "", mediaUrl = "", mediatype = "") {
  const normalizedMime = mime.toLowerCase();
  const normalizedUrl = mediaUrl.toLowerCase().split("?")[0];
  const normalizedMediatype = mediatype.toUpperCase();

  // Commons' media type and MIME are authoritative when provided. This
  // matters for .ogg, which can contain either audio or Ogg/Theora video.
  if (normalizedMediatype === "AUDIO") return "audio";
  if (normalizedMediatype === "VIDEO") return "video";
  if (normalizedMediatype === "TEXT") return "text";
  if (["OFFICE", "ARCHIVE", "3D"].includes(normalizedMediatype)) return "data";
  if (normalizedMime.startsWith("audio/")) return "audio";
  if (normalizedMime.startsWith("video/")) return "video";

  if ([".mp3", ".ogg", ".oga", ".opus", ".flac", ".wav", ".wave", ".mid", ".midi"].some((extension) => normalizedUrl.endsWith(extension))) {
    return "audio";
  }
  if ([".webm", ".ogv", ".mpeg", ".mpg", ".mpe", ".mp4"].some((extension) => normalizedUrl.endsWith(extension))) {
    return "video";
  }

  return "image";
}

function metadataText(value, maxLength = 500) {
  return cleanString(typeof value === "string" ? value.replace(/<[^>]*>/g, "") : "", maxLength);
}

function metadataList(value, maxItems = 20) {
  return metadataText(value, 2000)
    .split("|")
    .map((item) => cleanString(item, 120))
    .filter(Boolean)
    .slice(0, maxItems);
}

function retrievalScore(query, title, description, categories) {
  const queryTerms = cleanString(query, 120)
    .replace(/(?:intitle:|filetype:|incategory:)/gi, " ")
    .replace(/["()]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);
  if (!queryTerms.length) return 0.5;

  const titleText = title.toLowerCase();
  const searchableText = `${title} ${description} ${categories.join(" ")}`.toLowerCase();
  const matchedTerms = queryTerms.filter((term) => searchableText.includes(term));
  const titleMatches = queryTerms.filter((term) => titleText.includes(term));
  return Math.min(1, 0.45 + (matchedTerms.length / queryTerms.length) * 0.35 + (titleMatches.length / queryTerms.length) * 0.2);
}

function selectPlayableVideoSources(derivatives = [], originalUrl = "", originalMime = "") {
  if (!Array.isArray(derivatives) || !derivatives.length) {
    return {
      primaryUrl: originalUrl,
      sources: originalUrl ? [{ src: originalUrl, type: originalMime || "video/webm" }] : []
    };
  }

  // Filter out theora/ogg unless no other format exists
  const nonTheora = derivatives.filter((d) => d && typeof d.src === "string" && !d.type?.toLowerCase().includes("theora"));
  const pool = nonTheora.length ? nonTheora : derivatives;

  // Prefer 480p, then 720p, then 360p, then 240p, then 1080p
  const preferenceOrder = ["480p", "720p", "360p", "240p", "1080p"];
  let best = pool.find((d) => d.transcodekey && preferenceOrder.some((res) => d.transcodekey.includes(res)));
  if (!best) best = pool[0];

  const sources = pool.map((d) => ({
    src: d.src,
    type: d.type || (d.src.endsWith(".webm") ? "video/webm" : d.src.endsWith(".mov") || d.src.endsWith(".mp4") ? "video/mp4" : undefined),
    width: d.width || null,
    height: d.height || null,
    transcodekey: d.transcodekey || null
  }));

  return {
    primaryUrl: best?.src || originalUrl,
    sources
  };
}

export async function searchCommonsLive(query, limit = 12, options = {}) {
  const mediaTypeFilter = COMMONS_MEDIA_TYPE_FILTERS[options.mediaType] || "";
  const searchQuery = [cleanString(query, 100), mediaTypeFilter].filter(Boolean).join(" ");
  const requestContinuation = requestedMediaWikiContinuation(options, "gsroffset", "gsroffset||");
  const cleanQ = encodeURIComponent(searchQuery);
  const contParams = new URLSearchParams();
  applyContinuation(contParams, requestContinuation);
  const contQuery = contParams.toString() ? `&${contParams.toString()}` : "";
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${cleanQ}&gsrnamespace=6&gsrlimit=${limit}${contQuery}&prop=imageinfo|videoinfo&iiprop=url|size|extmetadata|mime|mediatype&viprop=derivatives&iiextmetadatafilter=Artist|ImageDescription|Categories|ObjectName|DateTimeOriginal|Assessments&iiurlwidth=640&format=json&origin=*`;

  let data;
  try {
    data = await sourceJson(url, options, inspectMediaWiki);
    // A search with no matches omits `query`; a present but non-object `pages` is malformed.
    const queryBlock = data.query;
    const pagesValue = queryBlock?.pages;
    if (queryBlock !== undefined && (queryBlock === null || typeof queryBlock !== "object" || (pagesValue !== undefined && (pagesValue === null || typeof pagesValue !== "object" || Array.isArray(pagesValue))))) {
      throw new SourceRequestError("malformed", "Commons response has invalid query.pages");
    }
  } catch (error) {
    recordSourceFailure(options, error);
    return failedSourceBatch({ sourceId: "wikimedia-commons", query: searchQuery, error, requestContinuation });
  }

  // Generator results are keyed by page id; `index` preserves search rank.
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));
  options.metrics?.increment("rawResults", pages.length);

  const results = [];
  const malformed = [];
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    // Without imageinfo the page is either not a file or its property data continues in the next response.
    if (!info?.url) continue;
    if (typeof page.title !== "string" || page.pageid === undefined) {
      malformed.push({ sourceItemId: page?.pageid ? String(page.pageid) : null, reason: "Commons page is missing title or pageid" });
      options.metrics?.increment("normalizationFailures");
      continue;
    }

    const meta = info.extmetadata && typeof info.extmetadata === "object" ? info.extmetadata : {};
    const artist = metadataText(meta.Artist?.value, 80);
    const desc = metadataText(meta.ImageDescription?.value, 240) || cleanString(page.title.replace(/^File:/, ""), 240);
    const mime = typeof info.mime === "string" ? info.mime : "";

    const kind = classifyCommonsMediaKind(mime, info.url, info.mediatype);
    if (options.mediaType && kind !== options.mediaType) continue;

    const title = page.title.replace(/^File:/, "").replace(/\.[^/.]+$/, "").replace(/_/g, " ");
    const categories = metadataList(meta.Categories?.value);
    const retrievalMatch = retrievalScore(query, title, desc, categories);

    const videoDerivatives = page?.videoinfo?.[0]?.derivatives || [];
    const { primaryUrl, sources: videoSources } = kind === "video"
      ? selectPlayableVideoSources(videoDerivatives, info.url, mime)
      : { primaryUrl: info.url, sources: [] };

    const ucoItem = {
      id: `wikimedia-commons:${page.pageid}`,
      sourceId: "wikimedia-commons",
      sourceItemId: String(page.pageid),
      canonicalUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      originalSourceUrl: info.url,
      title: cleanString(title, 90),
      description: desc,
      language: "en",
      topics: [],
      retrieval: {
        originalQuery: cleanString(options.originalQuery || query, 120),
        query: cleanString(query, 120),
        strategy: cleanString(options.searchContext?.strategy, 80),
        variantKey: cleanString(options.searchContext?.variantKey, 80),
        entity: cleanString(options.searchContext?.entity?.label, 160),
        categories,
        objectName: metadataText(meta.ObjectName?.value, 180),
        dateTimeOriginal: metadataText(meta.DateTimeOriginal?.value, 80),
        assessments: metadataList(meta.Assessments?.value, 12)
      },
      creators: [{ name: artist, role: "creator" }],
      content: {
        type: kind,
        text: desc
      },
      media: {
        kind,
        url: primaryUrl,
        thumbnailUrl: info.thumburl || null,
        width: info.width || 1200,
        height: info.height || 800,
        mime: kind === "video" && primaryUrl !== info.url
          ? (primaryUrl.endsWith(".webm") ? "video/webm" : "video/mp4")
          : mime,
        durationSeconds: kind === "audio" ? 180 : null,
        accessibility: {
          altText: desc || title
        },
        ...(videoSources.length ? { sources: videoSources } : {})
      },
      provenance: {
        capturedAt: new Date().toISOString(),
        origin: "original"
      },
      ranking: {
        quality: 0.75 + retrievalMatch * 0.2,
        retrievalScore: retrievalMatch,
        curationTier: "featured"
      }
    };

    results.push(ucoItem);
  }

  const { items, invalid } = normalizeSourceRecords(results, options);
  const continuation = sanitizeMediaWikiContinuation(data.continue);
  return createSourceBatch({
    sourceId: "wikimedia-commons",
    query: searchQuery,
    items,
    invalid: [...malformed, ...invalid],
    rawCount: pages.length,
    continuation,
    exhausted: !continuation
  });
}

// ---------------------------------------------------------------------------
// 3. LIVE METROPOLITAN MUSEUM OF ART CONNECTOR (Available artwork images)
// ---------------------------------------------------------------------------
// The Met search API returns every matching object ID in one response, so the
// continuation is an index into that list.
export async function searchMetMuseumLive(query, limit = 6, options = {}) {
  const cleanQ = cleanString(query, 100);
  const startIndex = Number.isInteger(options.continuation?.index) && options.continuation.index > 0 ? options.continuation.index : 0;
  const requestContinuation = startIndex ? { index: startIndex } : null;
  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(cleanQ)}`;

  try {
    const searchData = await sourceJson(searchUrl, options);
    if (!searchData || typeof searchData !== "object" || (searchData.objectIDs !== null && searchData.objectIDs !== undefined && !Array.isArray(searchData.objectIDs))) {
      throw new SourceRequestError("malformed", "Met search response has invalid objectIDs");
    }
    const allIds = searchData.objectIDs || [];
    const objectIds = allIds.slice(startIndex, startIndex + limit);
    options.metrics?.increment("rawResults", objectIds.length);
    const results = [];

    for (const objId of objectIds) {
      const objUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${encodeURIComponent(objId)}`;
      let obj;
      try {
        obj = await sourceJson(objUrl, options);
      } catch (error) {
        // The Met search index contains IDs that no longer resolve; those are filtered, other failures fail the batch.
        if (error?.status === 404) continue;
        throw error;
      }

      if (obj && obj.primaryImageSmall) {
        const artist = obj.artistDisplayName || obj.culture || "Unknown Artisan";
        const title = obj.title || "Museum Cultural Object";

      const ucoItem = {
        id: `smithsonian-open-access:met-${obj.objectID}`,
        sourceId: "smithsonian-open-access",
        sourceItemId: String(obj.objectID),
        canonicalUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
        sourceUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
        originalSourceUrl: obj.primaryImage || obj.primaryImageSmall,
        title: cleanString(title, 90),
        description: cleanString(`${obj.medium || "Artwork"}. ${obj.period ? `Period: ${obj.period}.` : ""} ${obj.dimensions ? `Dimensions: ${obj.dimensions}.` : ""} ${obj.repository || "The Metropolitan Museum of Art"}.`, 260),
        language: "en",
        topics: [query, obj.department, obj.culture, obj.classification].filter(Boolean),
        creators: [{ name: artist, role: "artist" }],
        places: obj.country ? [{ label: obj.country, countryCode: "XX" }] : [],
        content: {
          type: "museum",
          text: `${title} (${obj.objectDate || "Date unknown"}). Created by ${artist}. Repository: ${obj.repository}. Credit Line: ${obj.creditLine || "Not provided"}.`
        },
        media: {
          kind: "image",
          url: obj.primaryImage || obj.primaryImageSmall,
          thumbnailUrl: obj.primaryImageSmall,
          width: 1200,
          height: 900,
          mime: "image/jpeg",
          accessibility: {
            altText: `${title}, ${artist}`
          }
        },
        provenance: {
          capturedAt: new Date().toISOString(),
          origin: "original"
        },
        ranking: {
          quality: 0.95,
          curationTier: "featured"
        }
      };

      results.push(ucoItem);
    }
  }

    const { items, invalid } = normalizeSourceRecords(results, options);
    const nextIndex = startIndex + objectIds.length;
    const exhausted = nextIndex >= allIds.length;
    return createSourceBatch({
      sourceId: "smithsonian-open-access",
      query: cleanQ,
      items,
      invalid,
      rawCount: objectIds.length,
      continuation: exhausted ? null : { index: nextIndex },
      exhausted
    });
  } catch (error) {
    recordSourceFailure(options, error);
    return failedSourceBatch({ sourceId: "smithsonian-open-access", query: cleanQ, error, requestContinuation });
  }
}

// ---------------------------------------------------------------------------
// 4. COMBINED LIVE CONNECTOR QUERY RUNNER
// ---------------------------------------------------------------------------
export const SOURCE_QUERY_VERSION = "source-query.v1";
const LIVE_SOURCE_KEYS = Object.freeze({ wikipedia: "wikipedia", "wikimedia-commons": "wikimedia-commons", met: "smithsonian-open-access" });

// Runs the requested live sources and returns one validated batch per source.
// Failures are reported in the batches; fixture content is never substituted.
export async function queryLiveConnectors(query, options = {}) {
  const { sources = ["wikipedia", "wikimedia-commons", "met"], continuations = {} } = options;
  const explicitLimit = Number.isInteger(options.limit) ? Math.max(1, options.limit) : null;
  const shared = {
    offset: options.offset,
    metrics: options.metrics,
    signal: options.signal,
    deadline: options.deadline,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
    retryBaseDelayMs: options.retryBaseDelayMs
  };
  const requests = [];

  if (sources.includes("wikipedia")) {
    requests.push(searchWikipediaLive(query, explicitLimit ?? 6, { ...shared, continuation: continuations.wikipedia }));
  }
  if (sources.includes("wikimedia-commons")) {
    requests.push(searchCommonsLive(query, explicitLimit ?? 12, {
      ...shared,
      continuation: continuations["wikimedia-commons"],
      mediaType: options.mediaType,
      originalQuery: options.originalQuery,
      searchContext: options.searchContext
    }));
  }
  if (sources.includes("met")) {
    requests.push(searchMetMuseumLive(query, explicitLimit ?? 6, { ...shared, continuation: continuations[LIVE_SOURCE_KEYS.met] }));
  }

  const batches = await Promise.all(requests);
  const items = batches.flatMap((batch) => batch.items);
  const result = Object.assign([...items], {
    version: SOURCE_QUERY_VERSION,
    batches: Object.freeze(batches),
    items: Object.freeze(items),
    failures: Object.freeze(batches.filter((batch) => batch.failure).map((batch) => ({ sourceId: batch.sourceId, ...batch.failure }))),
    exhausted: batches.length > 0 && batches.every((batch) => batch.exhausted)
  });
  return Object.freeze(result);
}

// ---------------------------------------------------------------------------
// EXISTING SYNC CONNECTOR DEFINITIONS FOR SDK TESTS
// ---------------------------------------------------------------------------
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

function createFixtureConnector({ id, sourceIds }) {
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
    async fetchMedia(record) {
      return { ...record.media, status: record.media?.url ? "available" : "metadata-only" };
    },
    async resolveEntities(record) {
      return record.entities || [];
    },
    async refresh({ cursor = null } = {}) {
      return { checkpoint: `${id}:${cursor || "initial"}:2026-08-10T00:00:00.000Z`, sourceIds };
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
export const openverseConnector = createFixtureConnector({ id: "openverse", sourceIds: ["openverse"] });
export const culturalAggregatorsConnector = createFixtureConnector({ id: "cultural-aggregators", sourceIds: ["smithsonian-open-access", "europeana", "dpla"] });

export const EPIC_C_CONNECTORS = deepFreeze([wikimediaKnowledgeConnector, wikimediaCommonsConnector, openverseConnector, culturalAggregatorsConnector]);
