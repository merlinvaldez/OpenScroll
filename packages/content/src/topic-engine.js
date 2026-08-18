import { cleanString, deepFreeze, slug, unique } from "./utils.js";

export const TOPIC_DIMENSIONS = Object.freeze([
  { id: "arts-music", label: "Arts, Music & Acoustic Culture", icon: "music" },
  { id: "history-roots", label: "History, Archives & Heritage", icon: "history" },
  { id: "architecture-places", label: "Architecture, Places & Geography", icon: "compass" },
  { id: "language-thought", label: "Language, Literature & Thought", icon: "languages" },
  { id: "science-data", label: "Science, Data & Natural World", icon: "database" },
  { id: "living-culture", label: "Living Culture, Society & Craft", icon: "globe" }
]);

const TOPIC_KNOWLEDGE_BASE = {
  morocco: {
    entity: { id: "Q1028", label: "Morocco", description: "Sovereign country in Northwestern Africa", aliases: ["المغرب", "Maroc", "Marruecos", "Kingdom of Morocco"] },
    dimensions: [
      {
        dimensionId: "arts-music",
        dimensionLabel: "Arts, Music & Acoustic Culture",
        topics: [
          { name: "Gnawa", weight: 1, icon: "music", description: "Spiritual acoustic traditions and trance rituals" },
          { name: "Andalusian classical music", weight: 1, icon: "music", description: "Historic Arab-Andalusian orchestral heritage" },
          { name: "Berber carpet weaving", weight: 1, icon: "palette", description: "Indigenous Amazigh textile patterns and geometric symbolism" },
          { name: "Ahwash", weight: 0.8, icon: "music", description: "Collective High Atlas performance and poetic dance" }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "History, Archives & Heritage",
        topics: [
          { name: "Marinid dynasty", weight: 1, icon: "book-open", description: "13th–15th century madrasas and scholarly institutions" },
          { name: "Treaty of Peace and Friendship", weight: 0.9, icon: "file-text", description: "1786 historic diplomatic accord" },
          { name: "Volubilis", weight: 0.9, icon: "landmark", description: "Ancient Berber-Roman archaeological city" },
          { name: "Almoravid Empire", weight: 0.8, icon: "book-open", description: "Sahara-to-Iberia imperial history" }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Architecture, Places & Geography",
        topics: [
          { name: "Medina of Fez", weight: 1, icon: "compass", description: "World's largest car-free contiguous historic urban area" },
          { name: "Ait Benhaddou", weight: 1, icon: "landmark", description: "Earthen ksar architecture in Ouarzazate" },
          { name: "Zellij tilework", weight: 1, icon: "palette", description: "Geometric terracotta tile mosaics" },
          { name: "Atlas Mountains", weight: 0.9, icon: "mountain", description: "Mountain range separating the Mediterranean and Atlantic coasts" }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Language, Literature & Thought",
        topics: [
          { name: "Darija", weight: 1, icon: "languages", description: "Moroccan Arabic dialect and oral idioms" },
          { name: "Tamazight", weight: 1, icon: "languages", description: "Indigenous Berber languages and Tifinagh script" },
          { name: "Ibn Battuta", weight: 0.9, icon: "book-open", description: "14th-century Moroccan explorer and travelogues" }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Science, Data & Natural World",
        topics: [
          { name: "University of al-Qarawiyyin", weight: 1, icon: "graduation-cap", description: "Oldest continually operating university in the world" },
          { name: "Argan ecosystem", weight: 0.9, icon: "tree-pine", description: "UNESCO biosphere reserve and endemic trees" },
          { name: "Morocco geospatial maps", weight: 0.8, icon: "map", description: "Open historical and cartographic surveys" }
        ]
      }
    ]
  },
  default: (query) => {
    const q = cleanString(query, 120);
    const capitalized = q.charAt(0).toUpperCase() + q.slice(1);
    return {
      entity: {
        id: `Q-${slug(q)}`,
        label: capitalized,
        description: `Knowledge domain and open cultural assets relating to ${capitalized}`,
        aliases: [capitalized, q.toLowerCase()]
      },
      dimensions: [
        {
          dimensionId: "arts-music",
          dimensionLabel: "Arts, Music & Acoustic Culture",
          topics: [
            { name: `${capitalized} soundscapes`, weight: 1, icon: "music", description: `Recordings and sonic traditions of ${capitalized}` },
            { name: `${capitalized} visual arts`, weight: 1, icon: "palette", description: `Historic and contemporary imagery of ${capitalized}` },
            { name: `${capitalized} oral traditions`, weight: 0.9, icon: "mic", description: "Spoken narratives and performance" }
          ]
        },
        {
          dimensionId: "history-roots",
          dimensionLabel: "History, Archives & Heritage",
          topics: [
            { name: `Origins of ${capitalized}`, weight: 1, icon: "book-open", description: "Foundational events and primary documents" },
            { name: `${capitalized} archival records`, weight: 1, icon: "archive", description: "Public domain texts and historical manuscripts" },
            { name: `Chronology of ${capitalized}`, weight: 0.8, icon: "calendar", description: "Timeline of critical shifts" }
          ]
        },
        {
          dimensionId: "architecture-places",
          dimensionLabel: "Places, Sites & Material World",
          topics: [
            { name: `${capitalized} landmarks`, weight: 1, icon: "compass", description: "Geographic centers and built spaces" },
            { name: `${capitalized} cartography`, weight: 0.9, icon: "map", description: "Open maps and spatial surveys" }
          ]
        },
        {
          dimensionId: "language-thought",
          dimensionLabel: "Language, Philosophy & Scholarship",
          topics: [
            { name: `${capitalized} terminology`, weight: 1, icon: "languages", description: "Key vocabulary and conceptual frameworks" },
            { name: `Literature on ${capitalized}`, weight: 0.9, icon: "book", description: "Open access treatises and literature" }
          ]
        },
        {
          dimensionId: "science-data",
          dimensionLabel: "Data, Research & Open Science",
          topics: [
            { name: `${capitalized} open datasets`, weight: 1, icon: "database", description: "Structured metrics and statistical tables" },
            { name: `${capitalized} research studies`, weight: 0.9, icon: "file-text", description: "Peer-reviewed open scholarship" }
          ]
        }
      ]
    };
  }
};

export async function resolveEntity(query, options = {}) {
  const clean = cleanString(query, 120).toLowerCase();
  if (!clean) return null;

  // Try live Wikidata API first if enabled
  if (options.useLiveApi !== false && typeof fetch === "function") {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=5`;
      const res = await fetch(url, { headers: { "User-Agent": "OpenScroll/1.0 (https://openscroll.app; mailto:info@openscroll.app)" } });
      if (res.ok) {
        const data = await res.json();
        if (data.search && data.search.length > 0) {
          const top = data.search[0];
          return {
            id: top.id,
            label: top.label,
            description: top.description || `Open knowledge entity for ${top.label}`,
            aliases: top.aliases || [top.label],
            canonicalUrl: `https://www.wikidata.org/wiki/${top.id}`
          };
        }
      }
    } catch {
      // Fallback cleanly to curated graph
    }
  }

  const match = TOPIC_KNOWLEDGE_BASE[clean] || TOPIC_KNOWLEDGE_BASE.default(query);
  return deepFreeze(match.entity);
}

export async function expandTopics(query, options = {}) {
  const clean = cleanString(query, 120).toLowerCase();
  const base = TOPIC_KNOWLEDGE_BASE[clean] || TOPIC_KNOWLEDGE_BASE.default(query);
  const resolvedEntity = await resolveEntity(query, options);

  const flatTopics = base.dimensions.flatMap((d) => d.topics.map((t) => ({ ...t, dimensionId: d.dimensionId, dimensionLabel: d.dimensionLabel })));

  return deepFreeze({
    query,
    entity: resolvedEntity || base.entity,
    dimensions: base.dimensions,
    flatTopics,
    count: flatTopics.length
  });
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
