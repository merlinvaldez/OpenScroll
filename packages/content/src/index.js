export { CONNECTOR_CONTRACT_VERSION, CONNECTOR_METHODS, createConnector, runConnectorConformance } from "./connector-sdk.js";
export { createContentId, createUniversalContentObject, REQUIRED_UCO_SECTIONS, UNIVERSAL_CONTENT_OBJECT_VERSION, validateUniversalContentObject } from "./content-object.js";
export { EPIC_C_RAW_ITEMS } from "./fixtures.js";
export { createIngestionJob, runIngestion } from "./ingestion.js";
export { ATTRIBUTION_VERSION, DOWNLOAD_POLICY_VERSION, LICENSE_ONTOLOGY, LICENSE_ONTOLOGY_VERSION, OPEN_LICENSE_GATE_VERSION, QUALIFYING_LICENSES, RIGHTS_REVIEW_VERSION, createAttributionNotice, createOpenLicenseGateDecision, createRightsReviewCase, createRightsSafeDownloadPolicy, createWhyOpenExplanation, evaluateRights, getLicenseRecord, isEligibleRights, normalizeLicenseId, openLicenseGate, verifySourceRights } from "./rights.js";
export { SOURCE_HEALTH, SOURCE_REGISTRY, SOURCE_REGISTRY_VERSION, createSourceRegistry, getSource, validateSourceRecord } from "./source-registry.js";
export { EPIC_C_CONNECTORS, culturalAggregatorsConnector, openverseConnector, wikimediaCommonsConnector, wikimediaKnowledgeConnector, queryLiveConnectors, searchWikipediaLive, searchCommonsLive, searchMetMuseumLive } from "./source-connectors.js";
export { expandTopics, resolveEntity, buildQueryPlan } from "./topic-engine.js";
export { composeDiversityFeed, deduplicateCandidates, scoreCandidate } from "./feed-composer.js";

import { createUniversalContentObject } from "./content-object.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";
import { openLicenseGate } from "./rights.js";
import { getSource } from "./source-registry.js";

export const canonicalMoroccoSample = EPIC_C_RAW_ITEMS
  .filter((record) => {
    const source = getSource(record.sourceId);
    return openLicenseGate(record.rights, { sourceId: source?.id, sourceName: source?.name, sourceUrl: record.sourceUrl, originalSourceUrl: record.originalSourceUrl || record.sourceUrl }).decision === "accept";
  })
  .map((record) => createUniversalContentObject(record));
