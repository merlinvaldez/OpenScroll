import { cleanString, deepFreeze, numberBetween, slug, unique } from "./utils.js";

export const INTEREST_GRAPH_VERSION = "interest-graph.v1";

function topicId(topic) {
  return `topic:${slug(topic)}`;
}

function preferenceWeights(selectedTopics = [], explicitWeights = {}) {
  const cleanTopics = unique(selectedTopics.map((topic) => cleanString(topic, 80)).filter(Boolean));
  return Object.fromEntries(cleanTopics.map((topic, index) => [
    topic,
    numberBetween(explicitWeights[topic], 0, 1, Math.max(0.5, 1 - index * 0.08))
  ]));
}

function mediaPreferences(settings = {}) {
  const media = settings.media || {};
  return {
    images: media.images !== false,
    audio: media.audio !== false,
    video: media.video !== false,
    text: media.text !== false,
    data: media.data !== false
  };
}

function sourcePreferences(settings = {}) {
  const sources = settings.sources || {};
  return {
    wikimedia: sources.wikimedia !== false,
    openverse: sources.openverse !== false,
    smithsonian: sources.smithsonian !== false,
    europeana: sources.europeana !== false,
    dpla: sources.dpla !== false
  };
}

export function createInterestGraph({ interest, entityResolution, selectedTopics = [], excludedTopics = [], settings = {}, weights = {}, depth = 2, surprise = 0.22 } = {}) {
  const rootLabel = cleanString(interest, 120) || entityResolution?.selected?.label || "OpenScroll";
  const cleanSelectedTopics = unique(selectedTopics.map((topic) => cleanString(topic, 80)).filter(Boolean));
  const cleanExcludedTopics = unique(excludedTopics.map((topic) => cleanString(topic, 80)).filter(Boolean));
  const selectedEntity = entityResolution?.selected || null;
  const rootNodeId = `interest:${slug(rootLabel)}`;
  const topicWeights = preferenceWeights(cleanSelectedTopics, weights);
  const nodes = [
    { id: rootNodeId, type: "interest", label: rootLabel },
    ...(selectedEntity ? [{ id: selectedEntity.entityId, type: "entity", label: selectedEntity.label, confidence: selectedEntity.confidence }] : []),
    ...cleanSelectedTopics.map((topic) => ({ id: topicId(topic), type: "topic", label: topic, weight: topicWeights[topic], selected: true })),
    ...cleanExcludedTopics.map((topic) => ({ id: topicId(topic), type: "topic", label: topic, excluded: true }))
  ];
  const edges = [
    ...(selectedEntity ? [{
      id: `interest-edge:${slug(rootNodeId)}:resolved-to:${slug(selectedEntity.entityId)}`,
      from: rootNodeId,
      to: selectedEntity.entityId,
      type: "resolved-to",
      weight: selectedEntity.confidence,
      confidence: selectedEntity.confidence,
      evidence: entityResolution.explanation
    }] : []),
    ...cleanSelectedTopics.map((topic) => ({
      id: `interest-edge:${slug(rootNodeId)}:selected:${slug(topic)}`,
      from: rootNodeId,
      to: topicId(topic),
      type: "selected-topic",
      weight: topicWeights[topic],
      confidence: 1,
      evidence: "Explicit local browser preference"
    })),
    ...cleanExcludedTopics.map((topic) => ({
      id: `interest-edge:${slug(rootNodeId)}:excluded:${slug(topic)}`,
      from: rootNodeId,
      to: topicId(topic),
      type: "excluded-topic",
      weight: 0,
      confidence: 1,
      evidence: "Explicit local browser exclusion"
    }))
  ];
  return deepFreeze({
    schemaVersion: INTEREST_GRAPH_VERSION,
    id: `interest-graph:${slug(rootLabel)}:${cleanSelectedTopics.map(slug).join(":") || "all"}`,
    root: {
      label: rootLabel,
      nodeId: rootNodeId,
      entityId: selectedEntity?.entityId || null,
      resolutionStatus: entityResolution?.status || "not-resolved"
    },
    selectedTopics: cleanSelectedTopics,
    excludedTopics: cleanExcludedTopics,
    weights: topicWeights,
    preferences: {
      media: mediaPreferences(settings),
      sources: sourcePreferences(settings),
      languages: unique([settings.locale || "en", ...(settings.languages || [])]).slice(0, 8),
      depth: Math.min(Math.max(Number.isInteger(depth) ? depth : 2, 1), 5),
      surprise: numberBetween(surprise, 0, 1, 0.22)
    },
    nodes,
    edges,
    storage: {
      mode: "browser-local",
      serverProfileRequired: false,
      explicitSignalsOnly: true
    }
  });
}

export function summarizeInterestGraph(graph) {
  return deepFreeze({
    id: graph.id,
    root: graph.root,
    selectedTopics: graph.selectedTopics,
    excludedTopics: graph.excludedTopics,
    weights: graph.weights,
    preferences: graph.preferences
  });
}
