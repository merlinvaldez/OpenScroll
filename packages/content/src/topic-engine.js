import { cleanString, deepFreeze, slug, unique } from "./utils.js";
import {
  OPENAI_RESPONSES_URL,
  DEFAULT_GENERATION_MODEL,
  OpenAIConfigurationError,
  OpenAIRequestError,
  getGenerationConfig,
  requestOpenAIStructuredOutput
} from "./generation-adapter.js";
import {
  OPENAI_DECISIONS_URL,
  DEFAULT_DECISIONS_MODEL,
  SUPPORTED_DECISIONS_MODELS,
  DEFAULT_DECISION_THRESHOLD,
  DECISIONS_PROMPT_VERSION,
  DECISION_VERSION,
  UnsupportedDecisionsModelError,
  getDecisionsConfig,
  evaluateFeedCandidates,
  generateRelevanceExplanation
} from "./decisions-adapter.js";

export {
  OPENAI_RESPONSES_URL,
  DEFAULT_GENERATION_MODEL,
  OpenAIConfigurationError,
  OpenAIRequestError,
  getGenerationConfig,
  requestOpenAIStructuredOutput,
  OPENAI_DECISIONS_URL,
  DEFAULT_DECISIONS_MODEL,
  SUPPORTED_DECISIONS_MODELS,
  DEFAULT_DECISION_THRESHOLD,
  DECISIONS_PROMPT_VERSION,
  DECISION_VERSION,
  UnsupportedDecisionsModelError,
  getDecisionsConfig,
  evaluateFeedCandidates,
  generateRelevanceExplanation
};

const ENTITY_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    label: { type: "string" },
    description: { type: "string" },
    aliases: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["label", "description", "aliases"],
  additionalProperties: false
});

const MINDMAP_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    entity: {
      type: "object",
      properties: {
        label: { type: "string" },
        description: { type: "string" },
        aliases: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["label", "description", "aliases"],
      additionalProperties: false
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoryId: { type: "string" },
          categoryLabel: { type: "string" },
          categoryDescription: { type: "string" },
          icon: { type: "string" },
          color: { type: "string" },
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                weight: { type: "number" },
                icon: { type: "string" }
              },
              required: ["name", "description", "weight", "icon"],
              additionalProperties: false
            }
          }
        },
        required: ["categoryId", "categoryLabel", "categoryDescription", "icon", "color", "topics"],
        additionalProperties: false
      }
    }
  },
  required: ["entity", "categories"],
  additionalProperties: false
});

export function validateEntity(entity) {
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

export function validateCategories(categories) {
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

export async function generateMindmapWithOpenAI(query, apiKey, model, options = {}) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) throw new OpenAIRequestError("A topic query is required.", 400);

  const prompt = `Analyze the concept "${cleanQuery}" and return a precise, globally aware semantic knowledge graph with 4 to 7 categories.
Generate the category IDs, labels, and descriptions for this query; do not use a fixed taxonomy or force generic categories such as arts, history, places, or science when they are not relevant.
Each category must contain 3 to 5 specific, real, accurate, deeply relevant topics. Do not use generic placeholders. Keep descriptions concise. Ensure every category and topic is generated for the query and every topic has name, description, weight, and icon.`;

  return requestOpenAIStructuredOutput({
    name: "topic_expansion",
    instructions: "You are OpenScroll's semantic knowledge graph engine. Generate query-specific, rich conceptual categories and topics.",
    input: prompt,
    schema: MINDMAP_SCHEMA,
    reasoningEffort: options.reasoningEffort ?? "none"
  }, { ...options, apiKey, model });
}

export async function resolveEntity(query, options = {}) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) return null;

  const entity = await requestOpenAIStructuredOutput({
    name: "entity_resolution",
    instructions: "You are a precise entity-resolution engine. Resolve the provided concept into its canonical knowledge entity with label, engaging description, and alternative names.",
    input: `Resolve the concept "${cleanQuery}" into its canonical knowledge entity.`,
    schema: ENTITY_SCHEMA,
    reasoningEffort: options.reasoningEffort ?? "none"
  }, options);

  return deepFreeze(validateEntity(entity));
}

export async function expandTopics(query, options = {}) {
  const cleanQuery = cleanString(query, 120);
  if (!cleanQuery) throw new OpenAIRequestError("A topic query is required.", 400);

  const { model } = getGenerationConfig(options);
  const aiData = await generateMindmapWithOpenAI(cleanQuery, options.apiKey, model, options);
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
