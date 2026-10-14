export { CONNECTOR_CONTRACT_VERSION, CONNECTOR_METHODS, createConnector, runConnectorConformance } from "./connector-sdk.js";
export { createContentId, createUniversalContentObject, REQUIRED_UCO_SECTIONS, UNIVERSAL_CONTENT_OBJECT_VERSION, validateUniversalContentObject } from "./content-object.js";
export { EPIC_C_RAW_ITEMS } from "./fixtures.js";
export { createIngestionJob, runIngestion } from "./ingestion.js";
export { SOURCE_HEALTH, SOURCE_REGISTRY, SOURCE_REGISTRY_VERSION, createSourceRegistry, getSource, validateSourceRecord } from "./source-registry.js";
export { EPIC_C_CONNECTORS, culturalAggregatorsConnector, openverseConnector, wikimediaCommonsConnector, wikimediaKnowledgeConnector, queryLiveConnectors, searchWikipediaLive, fetchWikipediaArticleLive, searchCommonsLive, searchMetMuseumLive } from "./source-connectors.js";
export { expandTopics, resolveEntity, evaluateFeedCandidates, buildQueryPlan } from "./topic-engine.js";
export { composeDiversityFeed, deduplicateCandidates, scoreCandidate } from "./feed-composer.js";
export { buildCommonsSearchPlan, buildSearchPlans } from "./search-planner.js";
export { composeSearchFeed, FEED_MEDIA_TYPE_KINDS, FEED_MEDIA_TYPE_SOURCES } from "./feed-search.js";

import { createUniversalContentObject } from "./content-object.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";

export const canonicalMoroccoSample = EPIC_C_RAW_ITEMS.map((record) => createUniversalContentObject(record));
