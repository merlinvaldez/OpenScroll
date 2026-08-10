export { CONNECTOR_CONTRACT_VERSION, CONNECTOR_METHODS, createConnector, runConnectorConformance } from "./connector-sdk.js";
export { createContentId, createUniversalContentObject, REQUIRED_UCO_SECTIONS, UNIVERSAL_CONTENT_OBJECT_VERSION, validateUniversalContentObject } from "./content-object.js";
export { EPIC_C_RAW_ITEMS } from "./fixtures.js";
export { createIngestionJob, runIngestion } from "./ingestion.js";
export { QUALIFYING_LICENSES, evaluateRights, isEligibleRights, normalizeLicenseId } from "./rights.js";
export { SOURCE_HEALTH, SOURCE_REGISTRY, SOURCE_REGISTRY_VERSION, createSourceRegistry, getSource, validateSourceRecord } from "./source-registry.js";
export { EPIC_C_CONNECTORS, culturalAggregatorsConnector, openverseConnector, wikimediaCommonsConnector, wikimediaKnowledgeConnector } from "./source-connectors.js";

import { createUniversalContentObject } from "./content-object.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";

export const canonicalMoroccoSample = EPIC_C_RAW_ITEMS
  .filter((record) => record.id !== "openverse-rejected-nc")
  .map((record) => createUniversalContentObject(record));
