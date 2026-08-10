import { createContentGraph, contentNeighborhood } from "./content-graph.js";
import { resolveEntityOrRoot } from "./entity-resolution.js";
import { createInterestGraph } from "./interest-graph.js";
import { createSeedKnowledgeGraph } from "./knowledge-graph.js";
import { canonicalMoroccoSample } from "./sample.js";
import { cleanString, deepFreeze, numberBetween, slug, unique } from "./utils.js";

export const GRAPH_RELATIONSHIP_API_VERSION = "graph-relationship-api.v1";

function topicId(topic) {
  return `topic:${slug(topic)}`;
}

function labelForNode(graphs, id) {
  for (const graph of graphs) {
    const node = graph?.nodes?.find((item) => item.id === id);
    if (node?.label) return node.label;
  }
  return id.replace(/^(topic|content|source|place|media|language|collection):/, "");
}

function outgoing(graphs, id) {
  return graphs.flatMap((graph) => (graph?.edges || []).filter((edge) => edge.from === id));
}

export function traverseGraph({ from, graphs = [], depth = 2, relationTypes = [] } = {}) {
  const start = cleanString(from, 140);
  const allowed = new Set(relationTypes);
  const seen = new Set([start]);
  const queue = [{ id: start, depth: 0, path: [start] }];
  const paths = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= depth) continue;
    for (const edge of outgoing(graphs, current.id)) {
      if (allowed.size && !allowed.has(edge.type)) continue;
      if (seen.has(edge.to)) continue;
      const path = [...current.path, edge.to];
      seen.add(edge.to);
      paths.push({ nodes: path, edges: [...(current.edges || []), edge.id], weight: numberBetween((current.weight ?? 1) * edge.weight, 0, 1, edge.weight), relationTypes: [...(current.relationTypes || []), edge.type] });
      queue.push({ id: edge.to, depth: current.depth + 1, path, edges: [...(current.edges || []), edge.id], weight: numberBetween((current.weight ?? 1) * edge.weight, 0, 1, edge.weight), relationTypes: [...(current.relationTypes || []), edge.type] });
    }
  }
  return deepFreeze({
    schemaVersion: GRAPH_RELATIONSHIP_API_VERSION,
    from: start,
    depth,
    paths
  });
}

export function topicBranchesForInterest({ knowledgeGraph, contentGraph, entityResolution, limit = 12 } = {}) {
  const rootId = entityResolution?.selected?.entityId || knowledgeGraph.rootEntityId;
  const directlyRelatedTopics = (knowledgeGraph.edges || [])
    .filter((edge) => edge.from === rootId && edge.to.startsWith("topic:"))
    .map((edge) => ({ id: edge.to, weight: edge.weight, source: "knowledge-graph" }));
  const neighborTopics = (knowledgeGraph.edges || [])
    .filter((edge) => edge.from === rootId)
    .flatMap((edge) => (knowledgeGraph.edges || []).filter((candidate) => candidate.from === edge.to && candidate.to.startsWith("topic:")).map((candidate) => ({ id: candidate.to, weight: edge.weight * candidate.weight, source: "entity-neighborhood" })));
  const contentTopics = Object.values(contentGraph.contentIndex || {})
    .flatMap((record) => record.topics.map((topic) => ({ id: topicId(topic), weight: 0.68, source: "content-graph" })));
  const topicMap = new Map();
  for (const topic of [...directlyRelatedTopics, ...neighborTopics, ...contentTopics]) {
    const current = topicMap.get(topic.id);
    topicMap.set(topic.id, current ? { ...current, weight: Math.max(current.weight, topic.weight), sources: unique([...(current.sources || []), topic.source]) } : { id: topic.id, weight: topic.weight, sources: [topic.source] });
  }
  return deepFreeze([...topicMap.values()]
    .map((topic) => ({ ...topic, label: labelForNode([knowledgeGraph, contentGraph], topic.id), path: [rootId, topic.id] }))
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, limit));
}

function sourceAllowed(sourceFamily, preferences = {}) {
  return preferences.sources?.[sourceFamily] !== false;
}

function mediaAllowed(mediaKind, preferences = {}) {
  const key = mediaKind === "image" ? "images" : mediaKind === "knowledge-entity" || mediaKind === "article" || mediaKind === "dictionary" || mediaKind === "source-text" || mediaKind === "travel-guide" ? "text" : mediaKind;
  return preferences.media?.[key] !== false;
}

function scoreContent(record, interestGraph) {
  const topicScore = Math.max(0, ...record.topics.map((topic) => interestGraph.weights[topic] || 0));
  const sourceScore = sourceAllowed(record.sourceFamily, interestGraph.preferences) ? 0.16 : -1;
  const mediaScore = mediaAllowed(record.mediaKind, interestGraph.preferences) ? 0.12 : -1;
  const languageScore = record.language.some((language) => interestGraph.preferences.languages.includes(language)) ? 0.08 : 0.02;
  const total = sourceScore < 0 || mediaScore < 0 ? -1 : numberBetween(topicScore + sourceScore + mediaScore + languageScore, 0, 1, 0);
  return total;
}

export function explainContentMatch({ object, contentGraph, interestGraph, knowledgeGraph } = {}) {
  const record = contentGraph.contentIndex?.[object.id];
  const matchedTopics = record?.topics?.filter((topic) => interestGraph.selectedTopics.includes(topic)) || [];
  const primaryTopic = matchedTopics[0] || record?.topics?.[0] || "Open data";
  const entityPath = interestGraph.root.entityId && record?.entityIds?.[0] ? [interestGraph.root.entityId, record.entityIds[0], `content:${object.id}`] : [`interest:${slug(interestGraph.root.label)}`, topicId(primaryTopic), `content:${object.id}`];
  const neighborhood = contentNeighborhood(contentGraph, object.id);
  return deepFreeze({
    objectId: object.id,
    score: scoreContent(record, interestGraph),
    matchedTopics,
    primaryTopic,
    path: entityPath,
    pathLabels: entityPath.map((id) => labelForNode([knowledgeGraph, contentGraph, interestGraph], id)),
    reason: `${object.content.title} appears because ${interestGraph.root.label} connects to ${primaryTopic} through the OpenScroll graph.`,
    evidence: neighborhood.edges.slice(0, 5).map((edge) => ({ type: edge.type, evidence: edge.evidence, field: edge.provenance.field }))
  });
}

export function rankContentForInterest({ objects = [], contentGraph, interestGraph, knowledgeGraph } = {}) {
  return deepFreeze(objects.map((object) => ({ object, explanation: explainContentMatch({ object, contentGraph, interestGraph, knowledgeGraph }) }))
    .filter((item) => item.explanation.score >= 0 && (item.explanation.matchedTopics.length || !interestGraph.selectedTopics.length))
    .sort((a, b) => b.explanation.score - a.explanation.score || a.object.content.title.localeCompare(b.object.content.title)));
}

export function createGraphRelationshipApi({ knowledgeGraph, contentGraph, interestGraph, entityResolution, objects = canonicalMoroccoSample } = {}) {
  const topicBranches = topicBranchesForInterest({ knowledgeGraph, contentGraph, entityResolution });
  const contentMatches = rankContentForInterest({ objects, contentGraph, interestGraph, knowledgeGraph });
  const traversal = traverseGraph({ from: interestGraph.root.entityId || knowledgeGraph.rootEntityId, graphs: [knowledgeGraph, contentGraph, interestGraph], depth: interestGraph.preferences.depth });
  return deepFreeze({
    schemaVersion: GRAPH_RELATIONSHIP_API_VERSION,
    rootEntityId: interestGraph.root.entityId || knowledgeGraph.rootEntityId,
    interestGraphId: interestGraph.id,
    topicBranches,
    contentMatches,
    traversal,
    explain(itemId) {
      return contentMatches.find((match) => match.object.id === itemId)?.explanation || null;
    }
  });
}

export function createOpenScrollGraphBundle({ interest = "Morocco", selectedTopics = ["Music", "Darija", "History"], settings = {}, objects = canonicalMoroccoSample, knowledgeGraph = null } = {}) {
  const kg = knowledgeGraph || createSeedKnowledgeGraph(undefined, { query: interest || "Morocco" });
  const entityResolution = resolveEntityOrRoot(interest || "Morocco", kg);
  const contentGraph = createContentGraph(objects, kg);
  const topicBranches = topicBranchesForInterest({ knowledgeGraph: kg, contentGraph, entityResolution });
  const topicLabels = topicBranches.map((branch) => branch.label);
  const explicitTopics = selectedTopics?.length ? selectedTopics : topicLabels.slice(0, 4);
  const interestGraph = createInterestGraph({ interest, entityResolution, selectedTopics: explicitTopics, settings });
  const relationshipApi = createGraphRelationshipApi({ knowledgeGraph: kg, contentGraph, interestGraph, entityResolution, objects });
  return deepFreeze({
    schemaVersion: "openscroll-graph-bundle.v1",
    knowledgeGraph: kg,
    entityResolution,
    contentGraph,
    interestGraph,
    topicBranches,
    relationshipApi,
    contentMatches: relationshipApi.contentMatches
  });
}
