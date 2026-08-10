import { evaluateRights, isEligibleRights } from "./rights.js";
import { getSource, SOURCE_REGISTRY } from "./source-registry.js";
import { asArray, cleanString, deepFreeze, isoDate, numberBetween, slug, unique } from "./utils.js";

export const UNIVERSAL_CONTENT_OBJECT_VERSION = "uco.v1";
export const REQUIRED_UCO_SECTIONS = Object.freeze(["identity", "content", "creator", "time", "geography", "language", "knowledge", "media", "source", "rights", "ranking", "system"]);

function provenance(source, sourceField, confidence = 0.9, transform = "normalized") {
  return { sourceId: source.id, sourceName: source.name, sourceField, confidence: numberBetween(confidence, 0, 1, 0.9), transform };
}

function provenanceMap(record, source) {
  return deepFreeze({
    "identity.sourceItemId": provenance(source, "sourceItemId", 1, "copied"),
    "content.title": provenance(source, "title", 0.95, "cleaned"),
    "content.description": provenance(source, "description", 0.85, "cleaned"),
    "creator.names": provenance(source, "creators", 0.8, "normalized-list"),
    "time.publishedAt": provenance(source, "publishedAt", 0.72, "normalized-date"),
    "geography.places": provenance(source, "places", 0.82, "normalized-places"),
    "language.original": provenance(source, "languages", 0.86, "normalized-language"),
    "knowledge.entities": provenance(source, "entities", 0.82, "linked"),
    "media": provenance(source, "media", 0.88, "normalized-media"),
    "rights": provenance(source, "rights", 0.92, "source-verified"),
    "source": provenance(source, "sourceId", 1, "registry-join")
  });
}

export function createContentId(record) {
  return `uco:${slug(record.sourceId, "source")}:${slug(record.sourceItemId || record.id || record.title, "record")}`;
}

export function createUniversalContentObject(record, options = {}) {
  const registry = options.registry || SOURCE_REGISTRY;
  const source = getSource(record.sourceId, registry);
  if (!source) throw new Error(`Unknown source: ${record.sourceId}`);
  const retrievedAt = isoDate(options.now || record.retrievedAt);
  const creatorNames = asArray(record.creators).map((creator) => cleanString(creator.name, 160)).filter(Boolean);
  const rights = evaluateRights(record.rights, {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: record.sourceUrl,
    originalSourceUrl: record.originalSourceUrl || record.sourceUrl,
    mediaUrl: record.media?.url,
    metadataUrl: record.sourceUrl,
    title: record.title,
    creatorNames,
    now: retrievedAt
  });
  const places = asArray(record.places).map((place) => ({
    label: cleanString(place.label, 120),
    countryCode: cleanString(place.countryCode, 8).toUpperCase(),
    coordinates: Array.isArray(place.coordinates) && place.coordinates.length === 2 ? place.coordinates : null
  })).filter((place) => place.label);
  const topics = unique(asArray(record.topics).map((topic) => cleanString(topic, 80)).filter(Boolean));
  const languages = unique(asArray(record.languages).map((language) => cleanString(language, 24)).filter(Boolean));
  const object = {
    schemaVersion: UNIVERSAL_CONTENT_OBJECT_VERSION,
    id: createContentId(record),
    canonicalUrl: cleanString(record.canonicalUrl || `https://openscroll.app/item/${source.id}/${slug(record.sourceItemId || record.title)}`, 300),
    identity: {
      sourceItemId: cleanString(record.sourceItemId || record.id, 180),
      sourceRecordUrl: cleanString(record.sourceUrl, 300),
      originalSourceUrl: cleanString(record.originalSourceUrl || record.sourceUrl, 300),
      stableKey: `${source.id}:${cleanString(record.sourceItemId || record.id, 180)}`
    },
    content: {
      type: cleanString(record.type, 40),
      title: cleanString(record.title, 180),
      originalTitle: cleanString(record.originalTitle || record.title, 180),
      description: cleanString(record.description, 500),
      topics
    },
    creator: {
      names: asArray(record.creators).map((creator) => ({ name: cleanString(creator.name, 160), role: cleanString(creator.role || "creator", 80) })).filter((creator) => creator.name),
      institution: cleanString(record.institution || record.collection || source.name, 160)
    },
    time: {
      createdAt: cleanString(record.createdAt, 80),
      publishedAt: cleanString(record.publishedAt, 80),
      temporalCoverage: cleanString(record.temporalCoverage || "", 160),
      retrievedAt,
      freshness: record.publishedAt ? "dated" : "source-current"
    },
    geography: {
      places,
      countryCodes: unique(places.map((place) => place.countryCode).filter(Boolean))
    },
    language: {
      original: languages[0] || "und",
      available: languages.length ? languages : ["und"],
      translatedFields: record.originalTitle && record.originalTitle !== record.title ? ["content.title"] : []
    },
    knowledge: {
      entities: asArray(record.entities).map((entity) => ({ id: cleanString(entity.id, 80), label: cleanString(entity.label, 160), source: cleanString(entity.source || "source", 80) })).filter((entity) => entity.label),
      topics,
      collection: cleanString(record.collection || source.name, 180)
    },
    media: {
      kind: cleanString(record.media?.kind || record.type, 40),
      url: cleanString(record.media?.url || record.sourceUrl, 300),
      thumbnailUrl: cleanString(record.media?.thumbnailUrl, 300),
      mimeType: cleanString(record.media?.mimeType, 80),
      width: Number.isInteger(record.media?.width) ? record.media.width : null,
      height: Number.isInteger(record.media?.height) ? record.media.height : null,
      durationSeconds: Number.isFinite(record.media?.durationSeconds) ? record.media.durationSeconds : null,
      accessibility: {
        altText: cleanString(record.media?.accessibility?.altText, 300),
        captions: cleanString(record.media?.accessibility?.captions, 300),
        transcript: cleanString(record.media?.accessibility?.transcript, 500)
      }
    },
    source: {
      id: source.id,
      name: source.name,
      connector: source.connector,
      retrievedAt,
      links: unique([record.sourceUrl, record.originalSourceUrl].filter(Boolean))
    },
    rights,
    ranking: {
      quality: numberBetween(record.ranking?.quality, 0, 1, source.quality.metadataCompleteness),
      relevanceSignals: {
        explicitTopicMatch: topics.length ? 1 : 0,
        sourceConfidence: source.quality.rightsConfidence,
        metadataCompleteness: source.quality.metadataCompleteness
      },
      diversitySignals: {
        medium: cleanString(record.media?.kind || record.type, 40),
        source: source.id,
        language: languages[0] || "und",
        geography: places[0]?.countryCode || "global"
      }
    },
    system: {
      createdAt: retrievedAt,
      updatedAt: retrievedAt,
      ingestRunId: cleanString(options.ingestRunId || "fixture:epic-c", 120),
      sourceHealth: source.health.status,
      warnings: isEligibleRights(rights) ? [] : [rights.rejectedReason],
      provenance: provenanceMap(record, source)
    }
  };
  return deepFreeze(object);
}

export function validateUniversalContentObject(object, registry = SOURCE_REGISTRY) {
  const errors = [];
  if (object?.schemaVersion !== UNIVERSAL_CONTENT_OBJECT_VERSION) errors.push("schemaVersion must be uco.v1");
  for (const section of REQUIRED_UCO_SECTIONS) if (!object?.[section]) errors.push(`${section} section is required`);
  if (!object?.id?.startsWith("uco:")) errors.push("id must be a canonical uco id");
  if (!object?.content?.title) errors.push("content.title is required");
  if (!object?.identity?.sourceItemId || !object?.identity?.sourceRecordUrl) errors.push("identity source fields are required");
  if (!getSource(object?.source?.id, registry)) errors.push("source must exist in the Source Registry");
  if (!isEligibleRights(object?.rights)) errors.push("rights must be verified open and eligible");
  if (!object?.system?.provenance || Object.keys(object.system.provenance).length < 8) errors.push("field-level provenance is required");
  if (!object?.media?.kind || !object.media.url) errors.push("media kind and url are required");
  return { valid: errors.length === 0, errors };
}
