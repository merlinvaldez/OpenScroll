import { cleanString, deepFreeze, unique } from "./utils.js";

export const WIKIDATA_CLIENT_VERSION = "wikidata-client.v1";
const DEFAULT_ACTION_ENDPOINT = "https://www.wikidata.org/w/api.php";
const DEFAULT_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const DEFAULT_LANGUAGES = Object.freeze(["en", "ar", "fr", "es"]);

function configuredUserAgent(input = {}) {
  const env = input.env || {};
  return cleanString(
    input.userAgent ||
      env.OPENSCROLL_USER_AGENT ||
      env.OPENSCR0LL_USER_AGENT ||
      (input.contactEmail || env.OPENSCROLL_CONTACT_EMAIL || env.OPENSCR0LL_CONTACT_EMAIL
        ? `OpenScroll/1.0 (${input.contactEmail || env.OPENSCROLL_CONTACT_EMAIL || env.OPENSCR0LL_CONTACT_EMAIL})`
        : "OpenScroll/1.0 (contact required before production traffic)"),
    240
  );
}

function headersFor(config) {
  return {
    Accept: "application/json",
    "User-Agent": config.userAgent
  };
}

function entityId(id) {
  const cleaned = cleanString(id, 32).toUpperCase();
  return cleaned.startsWith("Q") ? cleaned : "";
}

function valueLabel(value = {}, fallback = "") {
  return cleanString(value.value || value["*"] || fallback, 180);
}

function normalizeEntity(raw = {}, languages = DEFAULT_LANGUAGES) {
  const id = entityId(raw.id);
  const labels = Object.fromEntries(languages.map((language) => [language, valueLabel(raw.labels?.[language])]).filter(([, label]) => label));
  const aliases = unique(languages.flatMap((language) => (raw.aliases?.[language] || []).map((alias) => valueLabel(alias))).filter(Boolean));
  return deepFreeze({
    id: id ? `wd:${id}` : "",
    wikidataId: id,
    label: labels.en || Object.values(labels)[0] || valueLabel(raw.label, id),
    labels,
    aliases,
    type: "wikidata-entity",
    description: valueLabel(raw.descriptions?.en || raw.description),
    topics: [],
    source: { id: "wikidata", url: id ? `https://www.wikidata.org/wiki/${id}` : "", licenseId: "cc0" }
  });
}

function normalizeSearchResult(raw = {}) {
  const id = entityId(raw.id);
  return deepFreeze({
    id: id ? `wd:${id}` : "",
    wikidataId: id,
    label: cleanString(raw.label, 180),
    description: cleanString(raw.description, 240),
    aliases: unique([...(Array.isArray(raw.aliases) ? raw.aliases : []), raw.match?.text].map((item) => cleanString(item, 180)).filter(Boolean)),
    type: "wikidata-entity",
    source: { id: "wikidata", url: id ? `https://www.wikidata.org/wiki/${id}` : cleanString(raw.concepturi, 240), licenseId: "cc0" }
  });
}

function statementTarget(statement = {}) {
  const value = statement?.mainsnak?.datavalue?.value;
  if (value?.["entity-type"] === "item" && Number.isInteger(value["numeric-id"])) return `wd:Q${value["numeric-id"]}`;
  return "";
}

function relationshipType(propertyId) {
  return {
    P17: "country",
    P31: "instance-of",
    P131: "located-in",
    P279: "subclass-of",
    P361: "part-of",
    P625: "coordinates",
    P276: "location"
  }[propertyId] || "related-to";
}

function relationshipsFromEntity(raw = {}) {
  const from = raw.id ? `wd:${raw.id}` : "";
  const properties = ["P17", "P31", "P131", "P279", "P361", "P276"];
  return properties.flatMap((propertyId) => (raw.claims?.[propertyId] || []).map((statement) => ({
    from,
    to: statementTarget(statement),
    type: relationshipType(propertyId),
    weight: 0.72,
    confidence: 0.78,
    evidence: `Wikidata claim ${propertyId}`
  })).filter((edge) => edge.from && edge.to));
}

async function readJson(response) {
  if (!response?.ok) throw new Error(`Wikidata request failed: ${response?.status || "unknown"}`);
  return response.json();
}

export function createWikidataClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("createWikidataClient requires a fetch implementation");
  const config = deepFreeze({
    schemaVersion: WIKIDATA_CLIENT_VERSION,
    actionEndpoint: cleanString(options.actionEndpoint || DEFAULT_ACTION_ENDPOINT, 240),
    sparqlEndpoint: cleanString(options.sparqlEndpoint || DEFAULT_SPARQL_ENDPOINT, 240),
    userAgent: configuredUserAgent(options),
    languages: unique(options.languages || DEFAULT_LANGUAGES)
  });

  async function action(params) {
    const url = new URL(config.actionEndpoint);
    for (const [key, value] of Object.entries({ format: "json", origin: "*", ...params })) url.searchParams.set(key, String(value));
    return readJson(await fetchImpl(url, { headers: headersFor(config) }));
  }

  return deepFreeze({
    config,
    async searchEntities(query, { language = "en", limit = 8 } = {}) {
      const data = await action({ action: "wbsearchentities", search: cleanString(query, 160), language, uselang: language, type: "item", limit });
      return deepFreeze((data.search || []).map(normalizeSearchResult).filter((item) => item.id));
    },
    async getEntities(ids, { languages = config.languages } = {}) {
      const cleanIds = unique((Array.isArray(ids) ? ids : [ids]).map(entityId).filter(Boolean));
      if (!cleanIds.length) return [];
      const data = await action({ action: "wbgetentities", ids: cleanIds.join("|"), props: "labels|descriptions|aliases|claims|sitelinks", languages: languages.join("|") });
      return deepFreeze(Object.values(data.entities || {}).map((entity) => ({
        ...normalizeEntity(entity, languages),
        relationships: relationshipsFromEntity(entity)
      })));
    },
    async getRelatedEntities(id, { limit = 12 } = {}) {
      const cleanId = entityId(id);
      if (!cleanId) return [];
      const query = `SELECT ?item ?itemLabel WHERE { wd:${cleanId} ?p ?item . FILTER(STRSTARTS(STR(?item), STR(wd:Q))) SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar,fr,es". } } LIMIT ${Math.min(Math.max(limit, 1), 50)}`;
      const url = new URL(config.sparqlEndpoint);
      url.searchParams.set("query", query);
      url.searchParams.set("format", "json");
      const data = await readJson(await fetchImpl(url, { headers: headersFor(config) }));
      return deepFreeze((data.results?.bindings || []).map((binding) => {
        const match = cleanString(binding.item?.value, 160).match(/Q\d+$/);
        return match ? { id: `wd:${match[0]}`, wikidataId: match[0], label: valueLabel(binding.itemLabel), type: "wikidata-entity", source: { id: "wikidata", url: binding.item.value, licenseId: "cc0" } } : null;
      }).filter(Boolean));
    }
  });
}

export function createWikidataClientFromEnv(env = {}) {
  return createWikidataClient({ env });
}
