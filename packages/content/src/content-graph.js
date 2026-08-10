import { asArray, cleanString, deepFreeze, isoDate, numberBetween, slug, unique } from "./utils.js";

export const CONTENT_GRAPH_VERSION = "content-graph.v1";
export const CONTENT_GRAPH_NODE_TYPES = Object.freeze(["content", "entity", "topic", "place", "source", "language", "media-kind", "collection"]);

function graphNode(id, type, label, extra = {}) {
  return deepFreeze({
    id,
    type,
    label: cleanString(label, 180),
    ...extra
  });
}

function graphEdge(from, to, type, extra = {}) {
  return deepFreeze({
    id: `content-edge:${slug(from)}:${slug(type)}:${slug(to)}`,
    from,
    to,
    type,
    weight: numberBetween(extra.weight, 0, 1, 0.7),
    confidence: numberBetween(extra.confidence, 0, 1, 0.78),
    evidence: cleanString(extra.evidence || "content metadata relationship", 260),
    provenance: {
      sourceId: cleanString(extra.sourceId, 120),
      field: cleanString(extra.field, 120)
    }
  });
}

function topicId(topic) {
  return `topic:${slug(topic)}`;
}

function sourceFamily(sourceId) {
  if (["wikipedia", "wikidata", "wikisource", "wikivoyage", "wiktionary", "wikimedia-commons"].includes(sourceId)) return "wikimedia";
  if (sourceId === "smithsonian-open-access") return "smithsonian";
  return sourceId;
}

export function createContentGraph(objects = [], knowledgeGraph = null, options = {}) {
  const retrievedAt = isoDate(options.retrievedAt);
  const nodes = new Map();
  const edges = new Map();
  const addNode = (node) => { if (node?.id) nodes.set(node.id, node); };
  const addEdge = (edge) => { if (edge?.from && edge?.to) edges.set(edge.id, edge); };

  for (const node of knowledgeGraph?.nodes || []) {
    if (node.type === "entity" || node.type === "topic") addNode(graphNode(node.id, node.type, node.label, { source: node.source, aliases: node.aliases || [] }));
  }
  for (const edge of knowledgeGraph?.edges || []) {
    if (nodes.has(edge.from) && nodes.has(edge.to)) addEdge(graphEdge(edge.from, edge.to, edge.type, { weight: edge.weight, confidence: edge.confidence, evidence: edge.provenance?.evidence, sourceId: edge.provenance?.sourceId, field: "knowledgeGraph.edges" }));
  }

  for (const object of objects) {
    const contentId = `content:${object.id}`;
    addNode(graphNode(contentId, "content", object.content.title, {
      objectId: object.id,
      contentType: object.content.type,
      mediaKind: object.media.kind,
      canonicalUrl: object.canonicalUrl,
      rightsEligibility: object.rights.eligibility
    }));

    for (const entity of object.knowledge.entities || []) {
      const entityId = cleanString(entity.id, 80).startsWith("Q") ? `wd:${entity.id}` : cleanString(entity.id, 100);
      addNode(graphNode(entityId, "entity", entity.label, { source: { id: entity.source || "source" } }));
      addEdge(graphEdge(contentId, entityId, "about-entity", { weight: 0.95, confidence: 0.9, sourceId: object.source.id, field: "knowledge.entities" }));
    }

    for (const topic of unique([...(object.knowledge.topics || []), ...(object.content.topics || [])])) {
      const id = topicId(topic);
      addNode(graphNode(id, "topic", topic, { source: { id: "content-metadata" } }));
      addEdge(graphEdge(contentId, id, "has-topic", { weight: 0.86, confidence: 0.84, sourceId: object.source.id, field: "content.topics" }));
    }

    for (const place of object.geography.places || []) {
      const id = `place:${slug(place.label)}`;
      addNode(graphNode(id, "place", place.label, { countryCode: place.countryCode, coordinates: place.coordinates }));
      addEdge(graphEdge(contentId, id, "located-in", { weight: 0.74, confidence: 0.78, sourceId: object.source.id, field: "geography.places" }));
    }

    const sourceId = `source:${object.source.id}`;
    addNode(graphNode(sourceId, "source", object.source.name, { family: sourceFamily(object.source.id), health: object.system.sourceHealth }));
    addEdge(graphEdge(contentId, sourceId, "from-source", { weight: 0.8, confidence: 1, sourceId: object.source.id, field: "source.id" }));

    const mediaKindId = `media:${slug(object.media.kind)}`;
    addNode(graphNode(mediaKindId, "media-kind", object.media.kind));
    addEdge(graphEdge(contentId, mediaKindId, "has-media-kind", { weight: 0.62, confidence: 0.95, sourceId: object.source.id, field: "media.kind" }));

    for (const language of object.language.available || []) {
      const id = `language:${slug(language)}`;
      addNode(graphNode(id, "language", language));
      addEdge(graphEdge(contentId, id, "in-language", { weight: 0.55, confidence: 0.8, sourceId: object.source.id, field: "language.available" }));
    }

    const collectionId = `collection:${slug(object.knowledge.collection)}`;
    addNode(graphNode(collectionId, "collection", object.knowledge.collection, { sourceId: object.source.id }));
    addEdge(graphEdge(contentId, collectionId, "part-of-collection", { weight: 0.58, confidence: 0.82, sourceId: object.source.id, field: "knowledge.collection" }));
  }

  const byObjectId = Object.fromEntries(objects.map((object) => [object.id, {
    nodeId: `content:${object.id}`,
    sourceId: object.source.id,
    sourceFamily: sourceFamily(object.source.id),
    topics: unique([...(object.knowledge.topics || []), ...(object.content.topics || [])]),
    entityIds: asArray(object.knowledge.entities).map((entity) => cleanString(entity.id, 80).startsWith("Q") ? `wd:${entity.id}` : cleanString(entity.id, 100)),
    mediaKind: object.media.kind,
    language: object.language.available,
    title: object.content.title
  }]));

  return deepFreeze({
    schemaVersion: CONTENT_GRAPH_VERSION,
    id: cleanString(options.id || "content-graph:canonical-open-content", 140),
    retrievedAt,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    contentIndex: byObjectId,
    objectCount: objects.length,
    nodeCount: nodes.size,
    edgeCount: edges.size
  });
}

export function contentNeighborhood(contentGraph, objectId) {
  const nodeId = objectId.startsWith("content:") ? objectId : `content:${objectId}`;
  const edges = (contentGraph.edges || []).filter((edge) => edge.from === nodeId || edge.to === nodeId);
  const nodeIds = unique([nodeId, ...edges.flatMap((edge) => [edge.from, edge.to])]);
  return deepFreeze({
    nodeId,
    nodes: nodeIds.map((id) => contentGraph.nodes.find((node) => node.id === id)).filter(Boolean),
    edges
  });
}

export function contentItemsForTopic(contentGraph, topic) {
  const id = topicId(topic);
  const contentNodeIds = (contentGraph.edges || []).filter((edge) => edge.type === "has-topic" && edge.to === id && edge.from.startsWith("content:")).map((edge) => edge.from);
  return unique(contentNodeIds).map((nodeId) => contentGraph.nodes.find((node) => node.id === nodeId && node.type === "content")).filter(Boolean);
}
