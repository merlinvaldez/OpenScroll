import { EPIC_E_KNOWLEDGE_SEED } from "./graph-fixtures.js";
import { asArray, cleanString, deepFreeze, isoDate, numberBetween, slug, unique } from "./utils.js";

export const KNOWLEDGE_GRAPH_VERSION = "knowledge-graph.v1";
export const KNOWLEDGE_GRAPH_INGESTION_VERSION = "knowledge-graph-ingestion.v1";
export const KNOWLEDGE_NODE_TYPES = Object.freeze(["entity", "topic", "place", "language", "source"]);
export const KNOWLEDGE_EDGE_TYPES = Object.freeze(["same-as", "has-topic", "contains-place", "has-language", "has-cultural-tradition", "contains-monument", "related-to", "instance-of", "subclass-of", "part-of", "located-in", "country", "location"]);

function nodeIdForEntity(entity = {}) {
  const wikidataId = cleanString(entity.wikidataId || entity.id, 40).replace(/^wd:/i, "").toUpperCase();
  return wikidataId.startsWith("Q") ? `wd:${wikidataId}` : cleanString(entity.id, 120) || `entity:${slug(entity.label)}`;
}

function topicId(topic) {
  return `topic:${slug(topic)}`;
}

export function createKnowledgeNode(input = {}, context = {}) {
  const type = KNOWLEDGE_NODE_TYPES.includes(input.type) ? input.type : input.wikidataId || cleanString(input.id).startsWith("wd:") ? "entity" : "topic";
  const labels = input.labels && typeof input.labels === "object" ? input.labels : {};
  const label = cleanString(input.label || labels.en || Object.values(labels)[0], 180);
  const id = type === "topic" ? topicId(label || input.id) : nodeIdForEntity({ ...input, label });
  return deepFreeze({
    id,
    type,
    label,
    labels,
    aliases: unique(asArray(input.aliases).map((alias) => cleanString(alias, 180)).filter(Boolean)),
    description: cleanString(input.description, 280),
    externalIds: {
      wikidata: cleanString(input.wikidataId || id.replace(/^wd:/, ""), 40),
      ...input.externalIds
    },
    coordinates: Array.isArray(input.coordinates) && input.coordinates.length === 2 ? input.coordinates : null,
    topics: unique(asArray(input.topics).map((topic) => cleanString(topic, 80)).filter(Boolean)),
    source: {
      id: cleanString(input.source?.id || context.sourceId || "wikidata", 120),
      url: cleanString(input.source?.url || (id.startsWith("wd:") ? `https://www.wikidata.org/wiki/${id.replace("wd:", "")}` : ""), 300),
      licenseId: cleanString(input.source?.licenseId || "cc0", 80)
    },
    provenance: {
      retrievedAt: isoDate(context.retrievedAt || input.retrievedAt),
      confidence: numberBetween(input.confidence, 0, 1, 0.86),
      evidence: cleanString(input.evidence || context.evidence || "knowledge graph seed or source API", 260)
    }
  });
}

export function createKnowledgeEdge(input = {}, context = {}) {
  const from = cleanString(input.from, 140);
  const to = cleanString(input.to, 140);
  const type = KNOWLEDGE_EDGE_TYPES.includes(input.type) ? input.type : "related-to";
  return deepFreeze({
    id: `kg-edge:${slug(from)}:${slug(type)}:${slug(to)}`,
    from,
    to,
    type,
    weight: numberBetween(input.weight, 0, 1, 0.7),
    confidence: numberBetween(input.confidence, 0, 1, 0.75),
    provenance: {
      sourceId: cleanString(input.sourceId || context.sourceId || "wikidata", 120),
      retrievedAt: isoDate(context.retrievedAt || input.retrievedAt),
      evidence: cleanString(input.evidence || "source relationship", 260)
    }
  });
}

function topicNodesFromEntities(entities) {
  return unique(entities.flatMap((entity) => entity.topics || [])).map((topic) => createKnowledgeNode({ id: topicId(topic), label: topic, type: "topic", source: { id: "openscroll-topic-map", licenseId: "cc0" }, evidence: "Derived from source topics and knowledge graph labels." }));
}

function topicEdgesFromEntities(entities) {
  return entities.flatMap((entity) => asArray(entity.topics).map((topic) => createKnowledgeEdge({
    from: nodeIdForEntity(entity),
    to: topicId(topic),
    type: "has-topic",
    weight: 0.82,
    confidence: 0.84,
    sourceId: entity.source?.id || "wikidata",
    evidence: `Topic "${topic}" is attached to ${entity.label}.`
  })));
}

export function createKnowledgeGraph(input = {}) {
  const retrievedAt = isoDate(input.retrievedAt);
  const entityNodes = asArray(input.entities).map((entity) => createKnowledgeNode(entity, { retrievedAt }));
  const allNodes = [...entityNodes, ...topicNodesFromEntities(entityNodes), ...asArray(input.nodes).map((node) => createKnowledgeNode(node, { retrievedAt }))];
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
  const rawEdges = [...asArray(input.relationships), ...asArray(input.edges), ...topicEdgesFromEntities(entityNodes)];
  const edgeMap = new Map(rawEdges.map((edge) => createKnowledgeEdge(edge, { retrievedAt })).filter((edge) => nodeMap.has(edge.from) && nodeMap.has(edge.to)).map((edge) => [edge.id, edge]));
  return deepFreeze({
    schemaVersion: KNOWLEDGE_GRAPH_VERSION,
    id: cleanString(input.id || `kg:${slug(input.rootEntityId || input.query || "openscroll")}`, 120),
    rootEntityId: cleanString(input.rootEntityId || EPIC_E_KNOWLEDGE_SEED.rootEntityId, 120),
    query: cleanString(input.query || "Morocco", 160),
    retrievedAt,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    nodeCount: nodeMap.size,
    edgeCount: edgeMap.size,
    provenance: {
      sourceIds: unique([...nodeMap.values()].map((node) => node.source.id)),
      apiReady: Boolean(input.apiReady),
      mode: cleanString(input.mode || "fixture-seed", 80)
    }
  });
}

export function createSeedKnowledgeGraph(seed = EPIC_E_KNOWLEDGE_SEED, options = {}) {
  return createKnowledgeGraph({
    id: options.id || `kg:${slug(options.query || "morocco")}`,
    rootEntityId: options.rootEntityId || seed.rootEntityId,
    query: options.query || "Morocco",
    retrievedAt: options.retrievedAt || seed.retrievedAt,
    entities: seed.entities,
    relationships: seed.relationships,
    mode: "fixture-seed"
  });
}

export async function ingestKnowledgeGraph({ query = "Morocco", client = null, seed = EPIC_E_KNOWLEDGE_SEED, languages = ["en", "ar", "fr", "es"], limit = 8 } = {}) {
  const retrievedAt = isoDate();
  if (!client) {
    const graph = createSeedKnowledgeGraph(seed, { query, retrievedAt });
    return deepFreeze({ schemaVersion: KNOWLEDGE_GRAPH_INGESTION_VERSION, query, status: "fixture", graph, checkpoints: [{ sourceId: "wikidata", mode: "fixture-seed", retrievedAt }] });
  }
  const searchResults = await client.searchEntities(query, { language: "en", limit });
  const ids = unique(searchResults.map((item) => item.wikidataId).filter(Boolean));
  const entities = await client.getEntities(ids, { languages });
  const related = ids.length ? await client.getRelatedEntities(ids[0], { limit }) : [];
  const relationshipEdges = entities.flatMap((entity) => entity.relationships || []);
  const graph = createKnowledgeGraph({
    id: `kg:${slug(query)}`,
    rootEntityId: entities[0]?.id || searchResults[0]?.id || seed.rootEntityId,
    query,
    retrievedAt,
    entities: [...searchResults, ...entities, ...related],
    relationships: relationshipEdges,
    apiReady: true,
    mode: "wikidata-api"
  });
  return deepFreeze({
    schemaVersion: KNOWLEDGE_GRAPH_INGESTION_VERSION,
    query,
    status: "live",
    graph,
    checkpoints: [{ sourceId: "wikidata", mode: "wikidata-api", retrievedAt, entityCount: entities.length, relatedCount: related.length }]
  });
}

export function findKnowledgeNode(graph, idOrLabel) {
  const needle = cleanString(idOrLabel, 180).toLowerCase();
  return graph.nodes.find((node) => node.id.toLowerCase() === needle || node.label.toLowerCase() === needle || node.aliases.some((alias) => alias.toLowerCase() === needle)) || null;
}
