import { experimental_evaluate as evaluate } from "ai";
import { cleanString, deepFreeze, slug, unique } from "./utils.js";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_JEV_MODEL = "typesafe-ai/jev";
const DEFAULT_JEV_RELEVANCE_THRESHOLD = 0.75;

export class OpenAIConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OpenAIConfigurationError";
    this.status = 503;
  }
}

export class OpenAIRequestError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
  }
}

export class JevConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "JevConfigurationError";
    this.status = 503;
  }
}

export class JevRequestError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "JevRequestError";
    this.status = status;
  }
}

function getOpenAIConfig(options = {}) {
  const apiKey = options.apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "");
  const model = options.model || (typeof process !== "undefined" ? process.env?.OPENAI_MODEL : "") || DEFAULT_OPENAI_MODEL;

  if (!apiKey || !apiKey.trim()) {
    throw new OpenAIConfigurationError("OPENAI_API_KEY is required for OpenScroll AI generation.");
  }

  return { apiKey: apiKey.trim(), model: model.trim() || DEFAULT_OPENAI_MODEL };
}

function getJevConfig(options = {}) {
  const model = options.model || (typeof process !== "undefined" ? process.env?.JEV_MODEL : "") || DEFAULT_JEV_MODEL;
  const configuredThreshold = options.relevanceThreshold ?? (typeof process !== "undefined" ? process.env?.JEV_RELEVANCE_THRESHOLD : "");
  const relevanceThreshold = configuredThreshold === "" || configuredThreshold === undefined
    ? DEFAULT_JEV_RELEVANCE_THRESHOLD
    : Number(configuredThreshold);

  if (!model || !model.trim()) {
    throw new JevConfigurationError("JEV_MODEL is required for OpenScroll feed evaluation.");
  }

  if (!Number.isFinite(relevanceThreshold) || relevanceThreshold < 0 || relevanceThreshold > 1) {
    throw new JevConfigurationError("JEV_RELEVANCE_THRESHOLD must be a number between 0 and 1.");
  }

  return { model: model.trim(), relevanceThreshold };
}

async function requestOpenAIJson(messages, options = {}) {
  const { apiKey, model } = getOpenAIConfig(options);

  if (typeof fetch !== "function") {
    throw new OpenAIConfigurationError("The server cannot reach OpenAI because fetch is unavailable.");
  }

  let response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" }
      })
    });
  } catch (error) {
    throw new OpenAIRequestError(`OpenAI request failed: ${error.message}`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new OpenAIRequestError(`OpenAI returned an invalid response (${response.status}).`, response.status);
  }

  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed (${response.status}).`;
    throw new OpenAIRequestError(message, response.status);
  }

  const raw = payload?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new OpenAIRequestError("OpenAI returned no JSON content.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new OpenAIRequestError("OpenAI returned invalid JSON content.");
  }
}

function evaluationCandidate(candidate, index) {
  return {
    candidateIndex: index,
    title: cleanString(candidate.content?.title || candidate.title, 160),
    description: cleanString(candidate.content?.description || candidate.description, 300),
    topics: unique([
      ...(candidate.knowledge?.topics || []),
      ...(candidate.content?.topics || []),
      ...(candidate.topics || [])
    ]).map((topic) => cleanString(topic, 120)).filter(Boolean).slice(0, 12),
    source: cleanString(candidate.source?.name || candidate.source?.id || candidate.sourceId, 100),
    mediaKind: cleanString(candidate.media?.kind || candidate.content?.type, 60)
  };
}

export async function evaluateFeedCandidates(term, candidates, options = {}) {
  const cleanTerm = cleanString(term, 160);
  if (!cleanTerm || !Array.isArray(candidates) || !candidates.length) {
    return { accepted: [], evaluations: [] };
  }

  const candidateSummary = candidates.map(evaluationCandidate);
  const { model, relevanceThreshold } = getJevConfig(options);
  const questions = Object.fromEntries(candidateSummary.map((_, index) => [
    `candidate_${index}_relevant`,
    {
      type: "boolean",
      instructions: `Is candidates[${index}] meaningfully relevant to term? Judge only the candidate title, description, topics, source, and media kind. Reject incidental keyword matches, generic media, loosely associated people or places, and relevance that depends only on the source name.`
    }
  ]));

  let payload;
  try {
    const evaluateModel = options.evaluate || evaluate;
    if (typeof evaluateModel !== "function") {
      throw new JevConfigurationError("The Jev evaluator is unavailable.");
    }

    payload = await evaluateModel({
      model,
      state: {
        term: cleanTerm,
        candidates: candidateSummary
      },
      questions,
      maxRetries: 0,
      providerOptions: {
        gateway: {
          only: ["typesafe-ai"],
          tags: ["feature:openscroll-feed-evaluator"]
        }
      }
    });
  } catch (error) {
    if (error instanceof JevConfigurationError) throw error;
    throw new JevRequestError(`Jev request failed: ${error.message}`);
  }

  const evaluations = new Array(candidates.length);
  for (let index = 0; index < candidates.length; index += 1) {
    const candidateAnswer = payload?.answers?.[`candidate_${index}_relevant`];
    const relevanceProbability = candidateAnswer?.probability;
    if (candidateAnswer?.type !== "boolean" || !Number.isFinite(relevanceProbability) || relevanceProbability < 0 || relevanceProbability > 1) {
      throw new JevRequestError("Jev returned an invalid feed evaluation.");
    }

    const pass = relevanceProbability >= relevanceThreshold;
    evaluations[index] = {
      candidateIndex: index,
      termRelated: pass,
      pass,
      relevanceProbability,
      reason: `Jev relevance probability ${relevanceProbability.toFixed(3)}.`
    };
  }

  return {
    evaluations,
    accepted: candidates.filter((_, index) => evaluations[index].termRelated && evaluations[index].pass)
  };
}

function buildMindmapPrompt(query) {
  return `You are OpenScroll's knowledge graph engine. Analyze the concept "${query}" and return a precise, globally aware semantic knowledge graph.

Return valid JSON only with this exact shape:
{
  "entity": {
    "label": "Canonical Name of Concept",
    "description": "Engaging 1-2 sentence overview of the concept and its global significance.",
    "aliases": ["Alternative Name 1", "Alternative Name 2"]
  },
  "categories": [
    {
      "categoryId": "short-kebab-case-id",
      "categoryLabel": "Generated category name",
      "categoryDescription": "Why this category matters for the query.",
      "icon": "sparkles",
      "color": "#ec4899",
      "topics": [
        { "name": "Specific Movement or Style", "description": "One accurate sentence.", "weight": 1.0, "icon": "palette" }
      ]
    }
  ]
}

Choose 4 to 7 categories based on this query. Generate the category IDs, labels, and descriptions for this query; do not use a fixed taxonomy or force generic categories such as arts, history, places, or science when they are not relevant. Each category must contain 3 to 5 specific, real, accurate, deeply relevant topics. Do not use generic placeholders. Keep descriptions concise. Ensure every category and topic is generated for the query and every topic has name, description, weight, and icon.`;
}

function buildEntityPrompt(query) {
  return `Resolve the concept "${query}" into its canonical knowledge entity. Return valid JSON only with this exact shape:
{
  "label": "Canonical Name of Concept",
  "description": "Accurate 1-2 sentence overview.",
  "aliases": ["Alternative Name 1", "Alternative Name 2"]
}`;
}

function validateEntity(entity) {
  if (!entity || typeof entity !== "object" || !cleanString(entity.label, 160) || !cleanString(entity.description, 500) || !Array.isArray(entity.aliases)) {
    throw new OpenAIRequestError("OpenAI returned an invalid knowledge entity.");
  }

  return {
    id: `AI-${slug(entity.label)}`,
    label: cleanString(entity.label, 160),
    description: cleanString(entity.description, 500),
    aliases: unique([entity.label, ...entity.aliases]).map((alias) => cleanString(alias, 160)).filter(Boolean)
  };
}

function validateCategories(categories) {
  if (!Array.isArray(categories) || categories.length < 4 || categories.length > 7) {
    throw new OpenAIRequestError("OpenAI returned an incomplete knowledge graph.");
  }

  const categoryIds = categories.map((category) => cleanString(category?.categoryId, 80));
  if (categoryIds.some((id) => !id) || unique(categoryIds).length !== categoryIds.length) {
    throw new OpenAIRequestError("OpenAI returned duplicate or invalid knowledge graph categories.");
  }

  return categories.map((category) => {
    if (!category || !cleanString(category.categoryId, 80) || !cleanString(category.categoryLabel, 160) || !cleanString(category.categoryDescription, 500) || !cleanString(category.icon, 80) || !cleanString(category.color, 20) || !Array.isArray(category.topics) || category.topics.length < 3) {
      throw new OpenAIRequestError("OpenAI returned an invalid knowledge graph category.");
    }

    const topics = category.topics.map((topic) => {
      if (!topic || !cleanString(topic.name, 160) || !cleanString(topic.description, 500) || !Number.isFinite(topic.weight) || !cleanString(topic.icon, 80)) {
        throw new OpenAIRequestError("OpenAI returned an invalid knowledge graph topic.");
      }

      return {
        name: cleanString(topic.name, 160),
        description: cleanString(topic.description, 500),
        weight: Math.min(Math.max(topic.weight, 0), 1),
        icon: cleanString(topic.icon, 80)
      };
    });

    return {
      categoryId: cleanString(category.categoryId, 80),
      categoryLabel: cleanString(category.categoryLabel, 160),
      categoryDescription: cleanString(category.categoryDescription, 500),
      icon: cleanString(category.icon, 80),
      color: cleanString(category.color, 20),
      topics
    };
  });
}

export async function generateMindmapWithOpenAI(query, apiKey, model) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) throw new OpenAIRequestError("A topic query is required.", 400);

  return requestOpenAIJson([
    { role: "system", content: "You are a specialized semantic knowledge graph engine. Output JSON only." },
    { role: "user", content: buildMindmapPrompt(cleanQuery) }
  ], { apiKey, model });
}

export async function resolveEntity(query, options = {}) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) return null;

  const entity = await requestOpenAIJson([
    { role: "system", content: "You are a precise entity-resolution engine. Output JSON only." },
    { role: "user", content: buildEntityPrompt(cleanQuery) }
  ], options);

  return deepFreeze(validateEntity(entity));
}

export async function expandTopics(query, options = {}) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) throw new OpenAIRequestError("A topic query is required.", 400);

  const { model } = getOpenAIConfig(options);
  const aiData = await generateMindmapWithOpenAI(cleanQuery, options.apiKey, model);
  const entity = validateEntity(aiData.entity);
  const categories = validateCategories(aiData.categories);
  const flatTopics = categories.flatMap((category) =>
    category.topics.map((topic) => ({
      ...topic,
      categoryId: category.categoryId,
      categoryLabel: category.categoryLabel,
      color: category.color
    }))
  );

  return deepFreeze({
    query: cleanQuery,
    entity,
    categories,
    mindmap: buildMindmapTopology(cleanQuery, entity, categories),
    flatTopics,
    count: flatTopics.length,
    source: `OpenAI (${model})`
  });
}

export function buildMindmapTopology(rootQuery, entity, categories) {
  const rootNode = {
    id: "root",
    label: entity?.label || rootQuery,
    type: "root",
    icon: "sparkles",
    color: "#6366f1",
    description: entity?.description || `Interactive knowledge mindmap for ${rootQuery}`
  };

  const clusters = categories.map((category) => ({
    id: category.categoryId,
    label: category.categoryLabel,
    description: category.categoryDescription,
    icon: category.icon,
    color: category.color,
    nodeIds: category.topics.map((topic) => slug(topic.name))
  }));

  const nodes = [{
    id: "root",
    name: rootNode.label,
    label: rootNode.label,
    type: "root",
    categoryId: "root",
    categoryLabel: "Central Topic",
    description: rootNode.description,
    icon: "sparkles",
    weight: 1.5,
    selected: true,
    connections: categories.map((category) => category.categoryId)
  }];
  const edges = [];

  categories.forEach((category) => {
    edges.push({
      id: `edge:root->${category.categoryId}`,
      source: "root",
      target: category.categoryId,
      label: category.categoryLabel,
      weight: 1
    });

    category.topics.forEach((topic, index) => {
      const nodeId = slug(topic.name);
      edges.push({
        id: `edge:${category.categoryId}->${nodeId}`,
        source: category.categoryId,
        target: nodeId,
        label: "branch",
        weight: topic.weight
      });

      if (index > 0) {
        const previousNodeId = slug(category.topics[index - 1].name);
        edges.push({
          id: `edge:${previousNodeId}<->${nodeId}`,
          source: previousNodeId,
          target: nodeId,
          label: "related",
          weight: 0.5
        });
      }

      nodes.push({
        id: nodeId,
        name: topic.name,
        label: topic.name,
        type: "concept",
        categoryId: category.categoryId,
        categoryLabel: category.categoryLabel,
        description: topic.description,
        icon: topic.icon,
        color: category.color,
        weight: topic.weight,
        selected: index < 2,
        connections: ["root", category.categoryId]
      });
    });
  });

  return {
    root: rootNode,
    clusters,
    nodes,
    edges,
    totalNodes: nodes.length,
    totalEdges: edges.length
  };
}

export function buildQueryPlan(entity, selectedTopics = [], locale = "en") {
  const entityLabel = entity?.label || "Open Knowledge";
  const topics = selectedTopics.length > 0 ? selectedTopics : ["Overview", "Culture", "History"];

  return deepFreeze({
    entityId: entity?.id || "Q-general",
    entityLabel,
    topics,
    locale,
    searchTerms: {
      wikimedia: unique([entityLabel, ...topics]),
      commons: unique([entityLabel, ...topics.slice(0, 3)]),
      openverse: unique([entityLabel, ...topics.slice(0, 3)]),
      culturalAggregators: unique([entityLabel, ...topics.slice(0, 4)])
    }
  });
}
