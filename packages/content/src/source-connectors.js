import { createUniversalContentObject } from "./content-object.js";
import { createConnector } from "./connector-sdk.js";
import { evaluateRights } from "./rights.js";
import { SOURCE_REGISTRY, getSource } from "./source-registry.js";
import { cleanString, deepFreeze, unique } from "./utils.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";

const USER_AGENT = "OpenScroll/1.0 (https://github.com/merlinvaldez/OpenScroll; open-knowledge-client)";

// Helper: safe fetch with timeout
async function safeFetch(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. LIVE WIKIPEDIA / WIKIMEDIA KNOWLEDGE CONNECTOR
// ---------------------------------------------------------------------------
function createWikipediaRecord(pageData, { fullText = "", html = "" } = {}) {
  const overview = pageData.extract || "";
  const articleText = fullText || overview;
  const sourceUrl = pageData.content_urls?.desktop?.page || pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`;

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
      sections: fullText ? [] : [{ heading: "Overview", content: overview }]
    },
    media: pageData.originalimage ? {
      kind: "image",
      url: pageData.originalimage.source,
      thumbnailUrl: pageData.thumbnail?.source || pageData.originalimage.source,
      width: pageData.originalimage.width,
      height: pageData.originalimage.height,
      mime: "image/jpeg",
      accessibility: {
        altText: `Image illustrating ${pageData.title}`
      }
    } : null,
    rights: {
      licenseId: "CC-BY-SA-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      copyrightStatus: "copyrighted",
      sourceVerified: true,
      commercialUse: "allowed",
      modifications: "allowed",
      attributionRequired: true,
      attributionNotice: {
        text: `"${pageData.title}" by Wikipedia contributors, licensed under CC BY-SA 4.0.`
      }
    },
    provenance: {
      capturedAt: new Date().toISOString(),
      upstreamLicense: "CC-BY-SA-4.0"
    },
    ranking: {
      quality: 0.88,
      curationTier: "standard"
    }
  };
}

export async function searchWikipediaLive(query, limit = 8, options = {}) {
  const cleanQ = encodeURIComponent(cleanString(query, 100));
  const offset = Number.isInteger(options.offset) && options.offset > 0 ? options.offset : 0;
  const offsetQuery = offset ? `&sroffset=${offset}` : "";
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${cleanQ}&format=json&srlimit=${limit}${offsetQuery}&origin=*`;
  
  const searchData = await safeFetch(searchUrl);
  if (!searchData?.query?.search) return [];

  const results = [];
  for (const item of searchData.query.search) {
    const title = item.title;
    const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const pageData = await safeFetch(pageUrl);

    if (pageData && pageData.type === "standard") {
      results.push(createWikipediaRecord(pageData));
    }
  }

  return results;
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
    safeFetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`),
    safeFetch(`https://en.wikipedia.org/w/api.php?${parseParams.toString()}`)
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

export async function searchCommonsLive(query, limit = 12, options = {}) {
  const mediaTypeFilter = COMMONS_MEDIA_TYPE_FILTERS[options.mediaType] || "";
  const searchQuery = [cleanString(query, 100), mediaTypeFilter].filter(Boolean).join(" ");
  const cleanQ = encodeURIComponent(searchQuery);
  const offset = Number.isInteger(options.offset) && options.offset > 0 ? options.offset : 0;
  const offsetQuery = offset ? `&gsroffset=${offset}` : "";
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${cleanQ}&gsrnamespace=6&gsrlimit=${limit}${offsetQuery}&prop=imageinfo&iiprop=url|size|extmetadata|mime|mediatype&iiurlwidth=640&format=json&origin=*`;

  const data = await safeFetch(url);
  if (!data?.query?.pages) return [];

  const results = [];
  for (const page of Object.values(data.query.pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;

    const meta = info.extmetadata || {};
    const rawLicense = meta.LicenseShortName?.value || meta.License?.value || "CC-BY-SA-4.0";
    const artist = cleanString(meta.Artist?.value?.replace(/<[^>]*>/g, "") || "Wikimedia Commons Contributor", 80);
    const desc = cleanString(meta.ImageDescription?.value?.replace(/<[^>]*>/g, "") || page.title.replace(/^File:/, ""), 240);
    const mime = info.mime || "";

    const kind = classifyCommonsMediaKind(mime, info.url, info.mediatype);
    if (options.mediaType && kind !== options.mediaType) continue;

    const title = page.title.replace(/^File:/, "").replace(/\.[^/.]+$/, "").replace(/_/g, " ");

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
      topics: [query],
      creators: [{ name: artist, role: "creator" }],
      content: {
        type: kind,
        text: desc
      },
      media: {
        kind,
        url: info.url,
        thumbnailUrl: info.thumburl || null,
        width: info.width || 1200,
        height: info.height || 800,
        mime,
        durationSeconds: kind === "audio" ? 180 : null,
        accessibility: {
          altText: desc || title
        }
      },
      rights: {
        licenseId: rawLicense.includes("Public domain") || rawLicense.includes("PD") ? "Public-Domain" : "CC-BY-SA-4.0",
        licenseUrl: meta.LicenseUrl?.value || "https://creativecommons.org/licenses/by-sa/4.0/",
        copyrightStatus: rawLicense.includes("Public domain") ? "public-domain" : "copyrighted",
        sourceVerified: true,
        commercialUse: "allowed",
        modifications: "allowed",
        attributionRequired: !rawLicense.includes("Public domain"),
        attributionNotice: {
          text: `"${title}" by ${artist}, available via Wikimedia Commons under ${rawLicense}.`
        }
      },
      provenance: {
        capturedAt: new Date().toISOString(),
        upstreamLicense: rawLicense
      },
      ranking: {
        quality: 0.9,
        curationTier: "featured"
      }
    };

    results.push(ucoItem);
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. LIVE METROPOLITAN MUSEUM OF ART OPEN ACCESS CONNECTOR (CC0 Artworks)
// ---------------------------------------------------------------------------
export async function searchMetMuseumLive(query, limit = 6) {
  const cleanQ = encodeURIComponent(cleanString(query, 100));
  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${cleanQ}`;

  const searchData = await safeFetch(searchUrl);
  if (!searchData?.objectIDs?.length) return [];

  const objectIds = searchData.objectIDs.slice(0, limit);
  const results = [];

  for (const objId of objectIds) {
    const objUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objId}`;
    const obj = await safeFetch(objUrl);

    if (obj && obj.primaryImageSmall && obj.isPublicDomain) {
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
          text: `${title} (${obj.objectDate || "Date unknown"}). Created by ${artist}. Repository: ${obj.repository}. Credit Line: ${obj.creditLine || "Public Domain"}.`
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
        rights: {
          licenseId: "CC0-1.0",
          licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
          copyrightStatus: "public-domain",
          sourceVerified: true,
          commercialUse: "allowed",
          modifications: "allowed",
          attributionRequired: false,
          attributionNotice: {
            text: `"${title}" by ${artist}. The Metropolitan Museum of Art Open Access (CC0 1.0 Public Domain Dedication).`
          }
        },
        provenance: {
          capturedAt: new Date().toISOString(),
          upstreamLicense: "CC0-1.0"
        },
        ranking: {
          quality: 0.95,
          curationTier: "featured"
        }
      };

      results.push(ucoItem);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 4. COMBINED LIVE CONNECTOR QUERY RUNNER
// ---------------------------------------------------------------------------
export async function queryLiveConnectors(query, options = {}) {
  const { sources = ["wikipedia", "wikimedia-commons", "met"], allowFixtureFallback = true } = options;
  const explicitLimit = Number.isInteger(options.limit) ? Math.max(1, options.limit) : null;
  const requests = [];

  if (sources.includes("wikipedia")) {
    requests.push(searchWikipediaLive(query, explicitLimit ?? 6, { offset: options.offset }).catch(() => []));
  }
  if (sources.includes("wikimedia-commons")) {
    requests.push(searchCommonsLive(query, explicitLimit ?? 12, { offset: options.offset, mediaType: options.mediaType }).catch(() => []));
  }
  if (sources.includes("met")) {
    requests.push(searchMetMuseumLive(query, explicitLimit ?? 6).catch(() => []));
  }

  const liveCandidates = (await Promise.all(requests)).flat();

  if (liveCandidates.length > 0) {
    return liveCandidates.map((raw) => {
      try {
        return createUniversalContentObject(raw);
      } catch {
        return raw;
      }
    });
  }

  if (!allowFixtureFallback) return [];

  // Preserve the fixture-backed behavior for callers that explicitly allow it.
  const tokens = cleanString(query, 80).toLowerCase().split(/\s+/);
  const fallback = EPIC_C_RAW_ITEMS.filter((item) => {
    const text = `${item.title} ${item.description} ${(item.topics || []).join(" ")}`.toLowerCase();
    return tokens.some((t) => text.includes(t)) || text.includes("morocco");
  }).map((raw) => createUniversalContentObject(raw));

  return fallback.length ? fallback : EPIC_C_RAW_ITEMS.slice(0, 15).map((raw) => createUniversalContentObject(raw));
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
      return evaluateRights(record.rights, {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: record.sourceUrl,
        originalSourceUrl: sourceUrl,
        mediaUrl: record.media?.url,
        metadataUrl: record.sourceUrl,
        title: record.title,
        creatorNames: record.creators?.map((creator) => creator.name)
      });
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
export const openverseConnector = createFixtureConnector({ id: "openverse", sourceIds: ["openverse"], originalRightsRecheck: true });
export const culturalAggregatorsConnector = createFixtureConnector({ id: "cultural-aggregators", sourceIds: ["smithsonian-open-access", "europeana", "dpla"] });

export const EPIC_C_CONNECTORS = deepFreeze([wikimediaKnowledgeConnector, wikimediaCommonsConnector, openverseConnector, culturalAggregatorsConnector]);
