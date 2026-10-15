export { CONNECTOR_CONTRACT_VERSION, CONNECTOR_METHODS, createConnector, runConnectorConformance } from "./connector-sdk.js";
export { createContentId, createUniversalContentObject, REQUIRED_UCO_SECTIONS, UNIVERSAL_CONTENT_OBJECT_VERSION, validateUniversalContentObject } from "./content-object.js";
export { EPIC_C_RAW_ITEMS } from "./fixtures.js";
export { createIngestionJob, runIngestion } from "./ingestion.js";
export { SOURCE_HEALTH, SOURCE_REGISTRY, SOURCE_REGISTRY_VERSION, createSourceRegistry, getSource, validateSourceRecord } from "./source-registry.js";
export { EPIC_C_CONNECTORS, culturalAggregatorsConnector, openverseConnector, wikimediaCommonsConnector, wikimediaKnowledgeConnector, queryLiveConnectors, searchWikipediaLive, fetchWikipediaArticleLive, searchCommonsLive, searchMetMuseumLive, SOURCE_QUERY_VERSION } from "./source-connectors.js";
export {
  SOURCE_BATCH_VERSION,
  SOURCE_FAILURE_KINDS,
  SourceRequestError,
  abortError,
  createSourceBatch,
  describeFailure,
  failedSourceBatch,
  fetchJsonWithRetry,
  getRequestBudgetConfig,
  isAbortError,
  normalizeSourceRecords,
  parseRetryAfter,
  validateFeedCandidate,
  validateSourceBatch
} from "./source-batch.js";
export { expandTopics, resolveEntity, evaluateFeedCandidates, buildQueryPlan } from "./topic-engine.js";
export { composeDiversityFeed, deduplicateCandidates, scoreCandidate } from "./feed-composer.js";
export { buildCommonsSearchPlan, buildSearchPlans } from "./search-planner.js";
export { composeSearchFeed, FEED_MEDIA_TYPE_KINDS, FEED_MEDIA_TYPE_SOURCES } from "./feed-search.js";
export {
  FEED_CONTINUATION_VERSION,
  DEFAULT_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_TTL_MS,
  MAX_CONTINUATION_TOKEN_LENGTH,
  CONTINUATION_TOKEN_PREFIX,
  ContinuationExpiredError,
  InvalidContinuationError,
  FeedRequestValidationError,
  createContinuationToken,
  parseContinuationToken,
  createFeedContinuationState,
  validateFeedContinuation,
  validateFeedRequest,
  FileFeedContinuationStore,
  MemoryFeedContinuationStore,
  getContinuationStore
} from "./feed-continuation.js";

import { createUniversalContentObject } from "./content-object.js";
import { EPIC_C_RAW_ITEMS } from "./fixtures.js";

export const canonicalMoroccoSample = EPIC_C_RAW_ITEMS.map((record) => createUniversalContentObject(record));
