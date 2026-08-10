import { createUniversalContentObject } from "./content-object.js";
import { createConnector } from "./connector-sdk.js";
import { evaluateRights } from "./rights.js";
import { SOURCE_REGISTRY, getSource } from "./source-registry.js";
import { asArray, cleanString, deepFreeze, slug, unique } from "./utils.js";

export const SOURCE_API_CLIENT_VERSION = "source-api-client.v1";
export const EUROPEANA_SEARCH_ENDPOINT = "https://api.europeana.eu/record/v2/search.json";
export const SMITHSONIAN_SEARCH_ENDPOINT = "https://api.si.edu/openaccess/api/v1.0/search";
export const DPLA_ITEMS_ENDPOINT = "https://api.dp.la/v2/items";
export const DPLA_API_KEY_ENDPOINT = "https://api.dp.la/v2/api_key";
export const OPENVERSE_REGISTER_ENDPOINT = "https://api.openverse.org/v1/register";
export const OPENVERSE_TOKEN_ENDPOINT = "https://api.openverse.org/v1/token";
export const OPENVERSE_IMAGE_SEARCH_ENDPOINT = "https://api.openverse.org/v1/images/";
export const OPENVERSE_AUDIO_SEARCH_ENDPOINT = "https://api.openverse.org/v1/audio/";

const SOURCE_CLIENT_KEYS = Object.freeze({
  "smithsonian-open-access": "smithsonian",
  europeana: "europeana",
  dpla: "dpla",
  openverse: "openverse"
});

function envValue(env, names) {
  return names.map((name) => env?.[name]).find((value) => cleanString(value, 500)) || "";
}

function getFetch(fetchImpl) {
  if (typeof fetchImpl === "function") return fetchImpl;
  if (typeof globalThis.fetch === "function") return globalThis.fetch.bind(globalThis);
  throw new Error("A fetch implementation is required for source API clients.");
}

function firstValue(value) {
  if (Array.isArray(value)) return firstValue(value[0]);
  if (value && typeof value === "object" && "value" in value) return firstValue(value.value);
  if (value && typeof value === "object" && "content" in value) return firstValue(value.content);
  return cleanString(value, 500);
}

function textValues(value) {
  if (Array.isArray(value)) return value.flatMap(textValues).filter(Boolean);
  const text = firstValue(value);
  return text ? [text] : [];
}

function headers(userAgent, extra = {}) {
  return {
    Accept: "application/json",
    ...(userAgent ? { "User-Agent": userAgent } : {}),
    ...extra
  };
}

async function readJson(response, sourceId) {
  if (!response?.ok) throw new Error(`${sourceId} API request failed with status ${response?.status || "unknown"}`);
  return response.json();
}

function openLicenseFromText(value, fallback = "unknown") {
  const text = firstValue(value).toLowerCase();
  if (!text) return fallback;
  if (text.includes("creativecommons.org/publicdomain/zero") || text.includes("cc0")) return "cc0";
  if (text.includes("creativecommons.org/publicdomain/mark") || text.includes("public domain mark")) return "public-domain-mark";
  if (text.includes("public domain") || text.includes("rightsstatements.org/vocab/noc")) return "public-domain";
  if (text.includes("creativecommons.org/licenses/by-sa/4.0") || text.includes("cc by-sa 4.0")) return "cc-by-sa-4.0";
  if (text.includes("creativecommons.org/licenses/by/4.0") || text.includes("cc by 4.0")) return "cc-by-4.0";
  if (text.includes("creativecommons.org/licenses/by-sa/3.0") || text.includes("cc by-sa 3.0")) return "cc-by-sa-3.0";
  if (text.includes("creativecommons.org/licenses/by/3.0") || text.includes("cc by 3.0")) return "cc-by-3.0";
  return fallback;
}

function sourceCredential(sourceId, envNames, env, options = {}) {
  const configured = Boolean(envValue(env, envNames));
  return {
    sourceId,
    mode: options.mode || "api-key",
    envNames,
    configured,
    ...options.extra
  };
}

export function sourceCredentialStatus(env = {}) {
  const contactConfigured = Boolean(envValue(env, ["OPENSCROLL_CONTACT_EMAIL", "OPENSCR0LL_CONTACT_EMAIL"]));
  const openverseClientId = Boolean(envValue(env, ["OPENVERSE_CLIENT_ID"]));
  const openverseClientSecret = Boolean(envValue(env, ["OPENVERSE_CLIENT_SECRET"]));
  return deepFreeze({
    schemaVersion: "source-credentials.v1",
    valuesExposed: false,
    contact: {
      emailConfigured: contactConfigured,
      userAgentConfigured: Boolean(envValue(env, ["OPENSCROLL_USER_AGENT", "OPENSCR0LL_USER_AGENT"]))
    },
    sources: {
      europeana: sourceCredential("europeana", ["EUROPEANA_API_KEY"], env),
      "smithsonian-open-access": sourceCredential("smithsonian-open-access", ["SMITHSONIAN_API_KEY", "DATA_GOV_API_KEY"], env),
      dpla: sourceCredential("dpla", ["DPLA_API_KEY"], env, {
        extra: {
          requestEmailConfigured: Boolean(envValue(env, ["DPLA_REQUEST_EMAIL", "OPENSCROLL_CONTACT_EMAIL", "OPENSCR0LL_CONTACT_EMAIL"])),
          requestEndpointTemplate: `${DPLA_API_KEY_ENDPOINT}/{email}`
        }
      }),
      openverse: {
        sourceId: "openverse",
        mode: "oauth-client-credentials",
        envNames: ["OPENVERSE_CLIENT_ID", "OPENVERSE_CLIENT_SECRET"],
        configured: openverseClientId && openverseClientSecret,
        needsRegistration: !(openverseClientId && openverseClientSecret),
        registerEndpoint: OPENVERSE_REGISTER_ENDPOINT,
        tokenEndpoint: OPENVERSE_TOKEN_ENDPOINT
      }
    }
  });
}

export function createSourceApiConfig({ env = {}, contactEmail, userAgent } = {}) {
  const resolvedContactEmail = cleanString(contactEmail || envValue(env, ["OPENSCROLL_CONTACT_EMAIL", "OPENSCR0LL_CONTACT_EMAIL", "DPLA_REQUEST_EMAIL"]), 160);
  const resolvedUserAgent = cleanString(
    userAgent ||
      envValue(env, ["OPENSCROLL_USER_AGENT", "OPENSCR0LL_USER_AGENT"]) ||
      (resolvedContactEmail ? `OpenScroll/1.0 (contact: ${resolvedContactEmail})` : "OpenScroll/1.0"),
    240
  );
  return {
    contactEmail: resolvedContactEmail,
    userAgent: resolvedUserAgent,
    europeanaApiKey: envValue(env, ["EUROPEANA_API_KEY"]),
    dplaApiKey: envValue(env, ["DPLA_API_KEY"]),
    dplaRequestEmail: envValue(env, ["DPLA_REQUEST_EMAIL"]) || resolvedContactEmail,
    smithsonianApiKey: envValue(env, ["SMITHSONIAN_API_KEY", "DATA_GOV_API_KEY"]),
    openverseClientId: envValue(env, ["OPENVERSE_CLIENT_ID"]),
    openverseClientSecret: envValue(env, ["OPENVERSE_CLIENT_SECRET"])
  };
}

function missingCredential(name) {
  throw new Error(`${name} is required for this source API request.`);
}

function normalizeProviderUrl(value, fallback) {
  return firstValue(value) || fallback;
}

function mediaKindFromEuropeana(type) {
  const cleanType = firstValue(type).toLowerCase();
  if (cleanType === "image") return "image";
  if (cleanType === "sound") return "audio";
  if (cleanType === "video") return "video";
  if (cleanType === "text") return "source-text";
  return "museum-object";
}

function normalizeEuropeanaItem(item, { query = "open culture" } = {}) {
  const title = firstValue(item.title || item.dcTitle) || "Europeana item";
  const provider = firstValue(item.dataProvider || item.provider) || "Europeana provider";
  const sourceUrl = normalizeProviderUrl(item.guid || item.edmIsShownAt || item.link, `https://www.europeana.eu/item/${slug(item.id || title)}`);
  const licenseId = openLicenseFromText(item.rights, "unknown");
  return {
    id: `api:europeana:${slug(item.id || sourceUrl || title)}`,
    sourceId: "europeana",
    sourceItemId: firstValue(item.id || item.guid || sourceUrl),
    sourceUrl,
    canonicalUrl: sourceUrl,
    type: mediaKindFromEuropeana(item.type),
    title,
    description: firstValue(item.dcDescription || item.description) || `Europeana result for ${query}.`,
    creators: textValues(item.dcCreator || item.creator).map((name) => ({ name, role: "creator" })).concat(provider ? [{ name: provider, role: "provider" }] : []),
    publishedAt: firstValue(item.year) ? `${firstValue(item.year)}-01-01T00:00:00.000Z` : "",
    temporalCoverage: firstValue(item.year),
    places: textValues(item.edmPlaceLabel || item.country).map((label) => ({ label, countryCode: label.toLowerCase().includes("morocco") ? "MA" : "" })),
    languages: unique(textValues(item.language).map((language) => language.toLowerCase())),
    topics: unique([query, ...textValues(item.dcSubject || item.subject)].map((topic) => cleanString(topic, 80))),
    collection: firstValue(item.collectionName) || provider || "Europeana",
    media: {
      kind: mediaKindFromEuropeana(item.type),
      url: firstValue(item.edmIsShownBy || item.edmPreview || item.edmIsShownAt || sourceUrl),
      thumbnailUrl: firstValue(item.edmPreview)
    },
    rights: {
      licenseId,
      sourceVerified: licenseId !== "unknown",
      attribution: provider
    }
  };
}

function normalizeSmithsonianItem(item, { query = "open culture" } = {}) {
  const descriptive = item.content?.descriptiveNonRepeating || {};
  const freetext = item.content?.freetext || {};
  const structured = item.content?.indexedStructured || item.indexedStructured || {};
  const media = asArray(descriptive.online_media?.media)[0] || {};
  const title = firstValue(item.title || descriptive.title) || "Smithsonian Open Access item";
  const sourceUrl = normalizeProviderUrl(descriptive.record_link || item.url, `https://www.si.edu/object/${slug(descriptive.record_ID || item.id || title)}`);
  const collection = firstValue(descriptive.data_source || freetext.setName) || "Smithsonian Open Access";
  const creatorNames = textValues(freetext.name).length ? textValues(freetext.name) : ["Smithsonian Open Access"];
  const date = firstValue(freetext.date);
  return {
    id: `api:smithsonian:${slug(item.id || descriptive.record_ID || title)}`,
    sourceId: "smithsonian-open-access",
    sourceItemId: firstValue(item.id || descriptive.record_ID || sourceUrl),
    sourceUrl,
    canonicalUrl: sourceUrl,
    type: "museum-object",
    title,
    description: firstValue(freetext.notes || freetext.physicalDescription || freetext.summary) || `Smithsonian Open Access result for ${query}.`,
    creators: creatorNames.map((name) => ({ name, role: "creator" })),
    publishedAt: date && /^\d{4}$/.test(date) ? `${date}-01-01T00:00:00.000Z` : "",
    temporalCoverage: date,
    places: textValues(structured.place || freetext.place).map((label) => ({ label, countryCode: label.toLowerCase().includes("morocco") ? "MA" : "" })),
    languages: ["en"],
    topics: unique([query, ...textValues(structured.topic || freetext.topic || structured.object_type)].map((topic) => cleanString(topic, 80))),
    collection,
    media: {
      kind: media.content ? "image" : "museum-object",
      url: firstValue(media.content || media.thumbnail || sourceUrl),
      thumbnailUrl: firstValue(media.thumbnail)
    },
    rights: {
      licenseId: "cc0",
      sourceVerified: true,
      attribution: collection
    }
  };
}

function normalizeDplaType(item) {
  const values = [firstValue(item.sourceResource?.type), firstValue(item.sourceResource?.title), firstValue(item.title)].join(" ").toLowerCase();
  if (values.includes("map")) return "map";
  if (values.includes("image") || item.object) return "image";
  return "source-text";
}

function normalizeDplaItem(item, { query = "open culture" } = {}) {
  const resource = item.sourceResource || {};
  const title = firstValue(resource.title || item.title) || "DPLA item";
  const provider = firstValue(item.provider?.name || item.dataProvider || item.isPartOf) || "DPLA holding institution";
  const sourceUrl = normalizeProviderUrl(item.isShownAt || item["@id"], `https://dp.la/item/${slug(item.id || title)}`);
  const language = firstValue(resource.language?.name || resource.language).toLowerCase();
  const spatial = resource.spatial;
  return {
    id: `api:dpla:${slug(item.id || sourceUrl || title)}`,
    sourceId: "dpla",
    sourceItemId: firstValue(item.id || sourceUrl),
    sourceUrl,
    canonicalUrl: sourceUrl,
    type: normalizeDplaType(item),
    title,
    description: firstValue(resource.description || item.description) || `DPLA result for ${query}.`,
    creators: textValues(resource.creator).map((name) => ({ name, role: "creator" })).concat(provider ? [{ name: provider, role: "provider" }] : []),
    publishedAt: firstValue(resource.date?.begin) ? `${firstValue(resource.date.begin)}-01-01T00:00:00.000Z` : "",
    temporalCoverage: firstValue(resource.date?.displayDate || resource.date),
    places: textValues(spatial?.name || spatial).map((label) => ({ label, countryCode: label.toLowerCase().includes("morocco") ? "MA" : "" })),
    languages: language ? [language] : ["en"],
    topics: unique([query, ...textValues(resource.subject).map((subject) => firstValue(subject.name || subject))].map((topic) => cleanString(topic, 80))),
    collection: provider,
    media: {
      kind: normalizeDplaType(item),
      url: firstValue(item.object || sourceUrl),
      thumbnailUrl: firstValue(item.object)
    },
    rights: {
      licenseId: openLicenseFromText(resource.rights || item.rights, "unknown"),
      sourceVerified: openLicenseFromText(resource.rights || item.rights, "unknown") !== "unknown",
      attribution: provider
    }
  };
}

function normalizeOpenverseItem(item, { query = "open culture", mediaKind = "image", trustOpenverseRights = false } = {}) {
  const title = firstValue(item.title) || "Openverse item";
  const creator = firstValue(item.creator) || firstValue(item.source) || "Original source creator";
  const landingUrl = firstValue(item.foreign_landing_url || item.url || item.detail_url);
  const licenseId = openLicenseFromText(item.license_url || `${item.license || ""} ${item.license_version || ""}`, "unknown");
  return {
    id: `api:openverse:${slug(item.id || landingUrl || title)}`,
    sourceId: "openverse",
    sourceItemId: firstValue(item.id || landingUrl),
    sourceUrl: firstValue(item.detail_url || `https://openverse.org/${mediaKind}/${item.id || slug(title)}`),
    canonicalUrl: firstValue(item.detail_url || `https://openverse.org/${mediaKind}/${item.id || slug(title)}`),
    originalSourceUrl: landingUrl,
    type: mediaKind,
    title,
    description: firstValue(item.description) || `Openverse ${mediaKind} candidate for ${query}.`,
    creators: [{ name: creator, role: mediaKind === "audio" ? "artist" : "creator" }],
    places: [],
    languages: ["multilingual"],
    topics: unique([query, ...textValues(item.tags).map((tag) => firstValue(tag.name || tag))].map((topic) => cleanString(topic, 80))),
    collection: firstValue(item.source) || "Openverse",
    media: {
      kind: mediaKind,
      url: firstValue(item.url || item.thumbnail || landingUrl),
      thumbnailUrl: firstValue(item.thumbnail),
      width: Number.isInteger(item.width) ? item.width : null,
      height: Number.isInteger(item.height) ? item.height : null
    },
    rights: {
      licenseId,
      sourceVerified: trustOpenverseRights && Boolean(landingUrl && licenseId !== "unknown"),
      attribution: creator
    }
  };
}

export function createEuropeanaClient(options = {}) {
  const fetchImpl = getFetch(options.fetchImpl);
  const apiKey = cleanString(options.apiKey, 500);
  const userAgent = cleanString(options.userAgent, 240);
  return {
    schemaVersion: SOURCE_API_CLIENT_VERSION,
    sourceId: "europeana",
    configured: Boolean(apiKey),
    async search({ query = "open culture", rows = 10 } = {}) {
      if (!apiKey) missingCredential("EUROPEANA_API_KEY");
      const url = new URL(options.endpoint || EUROPEANA_SEARCH_ENDPOINT);
      url.searchParams.set("wskey", apiKey);
      url.searchParams.set("query", cleanString(query, 120));
      url.searchParams.set("reusability", "open");
      url.searchParams.set("rows", String(rows));
      const data = await readJson(await fetchImpl(url, { headers: headers(userAgent) }), "europeana");
      return deepFreeze(asArray(data.items).map((item) => normalizeEuropeanaItem(item, { query })));
    }
  };
}

export function createSmithsonianClient(options = {}) {
  const fetchImpl = getFetch(options.fetchImpl);
  const apiKey = cleanString(options.apiKey, 500);
  const userAgent = cleanString(options.userAgent, 240);
  return {
    schemaVersion: SOURCE_API_CLIENT_VERSION,
    sourceId: "smithsonian-open-access",
    configured: Boolean(apiKey),
    async search({ query = "open culture", rows = 10 } = {}) {
      if (!apiKey) missingCredential("SMITHSONIAN_API_KEY or DATA_GOV_API_KEY");
      const url = new URL(options.endpoint || SMITHSONIAN_SEARCH_ENDPOINT);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("q", cleanString(query, 120));
      url.searchParams.set("rows", String(rows));
      const data = await readJson(await fetchImpl(url, { headers: headers(userAgent) }), "smithsonian-open-access");
      return deepFreeze(asArray(data.response?.rows || data.rows).map((item) => normalizeSmithsonianItem(item, { query })));
    }
  };
}

export function createDplaClient(options = {}) {
  const fetchImpl = getFetch(options.fetchImpl);
  const apiKey = cleanString(options.apiKey, 500);
  const userAgent = cleanString(options.userAgent, 240);
  return {
    schemaVersion: SOURCE_API_CLIENT_VERSION,
    sourceId: "dpla",
    configured: Boolean(apiKey),
    async search({ query = "open culture", rows = 10 } = {}) {
      if (!apiKey) missingCredential("DPLA_API_KEY");
      const url = new URL(options.endpoint || DPLA_ITEMS_ENDPOINT);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("q", cleanString(query, 120));
      url.searchParams.set("page_size", String(rows));
      const data = await readJson(await fetchImpl(url, { headers: headers(userAgent) }), "dpla");
      return deepFreeze(asArray(data.docs).map((item) => normalizeDplaItem(item, { query })));
    }
  };
}

export async function requestDplaApiKey({ email, fetchImpl, endpoint = DPLA_API_KEY_ENDPOINT } = {}) {
  const requestEmail = cleanString(email, 160);
  if (!requestEmail || !requestEmail.includes("@")) throw new Error("A valid email is required to request a DPLA API key.");
  const fetcher = getFetch(fetchImpl);
  const url = new URL(`${endpoint}/${encodeURIComponent(requestEmail)}`);
  const data = await readJson(await fetcher(url, { method: "POST", headers: headers("") }), "dpla");
  return deepFreeze({ requested: true, message: cleanString(data.message || "DPLA API key request submitted.", 240) });
}

export async function registerOpenverseApplication({ name = "OpenScroll", description = "OpenScroll open cultural feed source integration", email, fetchImpl, endpoint = OPENVERSE_REGISTER_ENDPOINT } = {}) {
  const contactEmail = cleanString(email, 160);
  if (!contactEmail || !contactEmail.includes("@")) throw new Error("A valid email is required to register an Openverse application.");
  const fetcher = getFetch(fetchImpl);
  const data = await readJson(
    await fetcher(new URL(endpoint), {
      method: "POST",
      headers: headers("", { "Content-Type": "application/json" }),
      body: JSON.stringify({ name: cleanString(name, 120), description: cleanString(description, 300), email: contactEmail })
    }),
    "openverse"
  );
  return deepFreeze({
    clientId: cleanString(data.client_id || data.clientId, 500),
    clientSecret: cleanString(data.client_secret || data.clientSecret, 500),
    rawReceived: Boolean(data.client_id || data.clientId || data.client_secret || data.clientSecret)
  });
}

async function fetchOpenverseToken({ clientId, clientSecret, fetchImpl, endpoint, userAgent }) {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "client_credentials");
  const data = await readJson(
    await fetchImpl(new URL(endpoint || OPENVERSE_TOKEN_ENDPOINT), {
      method: "POST",
      headers: headers(userAgent, { "Content-Type": "application/x-www-form-urlencoded" }),
      body
    }),
    "openverse"
  );
  return {
    accessToken: cleanString(data.access_token || data.accessToken, 2000),
    expiresAt: Date.now() + Math.max(Number(data.expires_in || 3600) - 60, 60) * 1000
  };
}

export function createOpenverseClient(options = {}) {
  const fetchImpl = getFetch(options.fetchImpl);
  const clientId = cleanString(options.clientId, 500);
  const clientSecret = cleanString(options.clientSecret, 500);
  const userAgent = cleanString(options.userAgent, 240);
  const trustOpenverseRights = options.trustOpenverseRights === true;
  let token = null;
  async function authorizationHeaders() {
    if (!clientId || !clientSecret) return headers(userAgent);
    if (!token || token.expiresAt <= Date.now()) token = await fetchOpenverseToken({ clientId, clientSecret, fetchImpl, endpoint: options.tokenEndpoint, userAgent });
    return headers(userAgent, token.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {});
  }
  async function searchMedia({ query = "open culture", rows = 10, mediaKind = "image", endpoint } = {}) {
    const url = new URL(endpoint);
    url.searchParams.set("q", cleanString(query, 120));
    url.searchParams.set("page_size", String(rows));
    url.searchParams.set("license_type", "commercial");
    url.searchParams.set("extension", "jpg,png,webp,ogg,mp3,wav");
    const data = await readJson(await fetchImpl(url, { headers: await authorizationHeaders() }), "openverse");
    return deepFreeze(asArray(data.results).map((item) => normalizeOpenverseItem(item, { query, mediaKind, trustOpenverseRights })));
  }
  return {
    schemaVersion: SOURCE_API_CLIENT_VERSION,
    sourceId: "openverse",
    configured: Boolean(clientId && clientSecret),
    async searchImages(options = {}) {
      return searchMedia({ ...options, mediaKind: "image", endpoint: options.endpoint || OPENVERSE_IMAGE_SEARCH_ENDPOINT });
    },
    async searchAudio(options = {}) {
      return searchMedia({ ...options, mediaKind: "audio", endpoint: options.endpoint || OPENVERSE_AUDIO_SEARCH_ENDPOINT });
    },
    async search(options = {}) {
      const images = await this.searchImages(options);
      if (options.mediaKind === "audio") return this.searchAudio(options);
      return images;
    }
  };
}

export function createSourceApiClientsFromEnv(env = {}, options = {}) {
  const config = createSourceApiConfig({ env, contactEmail: options.contactEmail, userAgent: options.userAgent });
  const fetchImpl = options.fetchImpl;
  return deepFreeze({
    schemaVersion: SOURCE_API_CLIENT_VERSION,
    status: sourceCredentialStatus(env),
    config: {
      contactEmailConfigured: Boolean(config.contactEmail),
      userAgent: config.userAgent
    },
    europeana: createEuropeanaClient({ apiKey: config.europeanaApiKey, userAgent: config.userAgent, fetchImpl }),
    dpla: createDplaClient({ apiKey: config.dplaApiKey, userAgent: config.userAgent, fetchImpl }),
    smithsonian: createSmithsonianClient({ apiKey: config.smithsonianApiKey, userAgent: config.userAgent, fetchImpl }),
    "smithsonian-open-access": createSmithsonianClient({ apiKey: config.smithsonianApiKey, userAgent: config.userAgent, fetchImpl }),
    openverse: createOpenverseClient({ clientId: config.openverseClientId, clientSecret: config.openverseClientSecret, userAgent: config.userAgent, fetchImpl })
  });
}

function rateLimitFor(sourceIds, registry = SOURCE_REGISTRY) {
  const sources = sourceIds.map((sourceId) => getSource(sourceId, registry)).filter(Boolean);
  return {
    requestsPerMinute: Math.min(...sources.map((source) => source.rateLimit.requestsPerMinute)),
    burst: Math.min(...sources.map((source) => source.rateLimit.burst)),
    policy: unique(sources.map((source) => source.rateLimit.policy)).join("; ")
  };
}

function clientForSource(clients, sourceId) {
  return clients?.[sourceId] || clients?.[SOURCE_CLIENT_KEYS[sourceId]];
}

export function createApiSourceConnector({ id, sourceIds, clients, originalRightsRecheck = false } = {}) {
  const cache = new Map();
  return createConnector({
    id,
    sourceIds,
    async search({ query }) {
      const records = [];
      for (const sourceId of sourceIds) {
        const client = clientForSource(clients, sourceId);
        if (!client?.configured || typeof client.search !== "function") continue;
        const found = await client.search({ query });
        records.push(...found);
        for (const record of found) cache.set(record.id, record);
      }
      return records.map((record, index) => ({ id: record.id, sourceId: record.sourceId, score: Math.max(0.4, 1 - index * 0.05) }));
    },
    async fetch(idToFetch) {
      const record = cache.get(idToFetch);
      if (!record) throw new Error(`API record not found in connector cache: ${idToFetch}`);
      return record;
    },
    async normalize(record, { registry = SOURCE_REGISTRY } = {}) {
      return createUniversalContentObject(record, { registry, ingestRunId: `api:${id}` });
    },
    async extractRights(record, { registry = SOURCE_REGISTRY } = {}) {
      const source = getSource(record.sourceId, registry);
      const originalSourceUrl = originalRightsRecheck ? record.originalSourceUrl || record.sourceUrl : record.sourceUrl;
      return evaluateRights(record.rights, {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: record.sourceUrl,
        originalSourceUrl,
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
      return { checkpoint: `${id}:${cursor || "initial"}:api`, sourceIds };
    },
    async rateLimit({ registry = SOURCE_REGISTRY } = {}) {
      return rateLimitFor(sourceIds, registry);
    },
    async healthcheck() {
      const missing = sourceIds.filter((sourceId) => !clientForSource(clients, sourceId)?.configured);
      return {
        status: missing.length === sourceIds.length ? "auth-error" : missing.length ? "degraded" : "healthy",
        checkedAt: new Date("2026-08-10T00:00:00.000Z").toISOString(),
        sourceIds,
        missingSourceIds: missing
      };
    }
  });
}

export function createLiveSourceConnectorsFromEnv(env = {}, options = {}) {
  const clients = createSourceApiClientsFromEnv(env, options);
  return deepFreeze([
    createApiSourceConnector({ id: "openverse-api", sourceIds: ["openverse"], clients, originalRightsRecheck: true }),
    createApiSourceConnector({ id: "cultural-aggregators-api", sourceIds: ["smithsonian-open-access", "europeana", "dpla"], clients })
  ]);
}
