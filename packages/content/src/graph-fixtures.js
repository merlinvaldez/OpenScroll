import { deepFreeze } from "./utils.js";

export const EPIC_E_KNOWLEDGE_SEED = deepFreeze({
  schemaVersion: "knowledge-seed.v1",
  rootEntityId: "wd:Q1028",
  retrievedAt: "2026-08-10T00:00:00.000Z",
  entities: [
    {
      id: "wd:Q1028",
      wikidataId: "Q1028",
      label: "Morocco",
      labels: { en: "Morocco", ar: "المغرب", fr: "Maroc", es: "Marruecos" },
      aliases: ["Maroc", "Marruecos", "المغرب", "Kingdom of Morocco", "Al Maghrib"],
      type: "country",
      description: "Country in the Maghreb region of North Africa",
      coordinates: [31.7917, -7.0926],
      topics: ["History", "Culture", "Architecture", "Music", "Darija", "Open data"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q1028", licenseId: "cc0" }
    },
    {
      id: "wd:Q56426",
      wikidataId: "Q56426",
      label: "Moroccan Arabic",
      labels: { en: "Moroccan Arabic", ar: "الدارجة", fr: "arabe marocain", es: "árabe marroquí" },
      aliases: ["Darija", "Moroccan Darija", "الدارجة", "داريجة"],
      type: "language",
      description: "Arabic dialect continuum spoken in Morocco",
      topics: ["Darija", "Culture"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q56426", licenseId: "cc0" }
    },
    {
      id: "wd:Q1501622",
      wikidataId: "Q1501622",
      label: "Gnawa",
      labels: { en: "Gnawa", ar: "كناوة", fr: "Gnawa", es: "Gnawa" },
      aliases: ["Gnaoua", "كناوة", "Gnawa music"],
      type: "cultural-tradition",
      description: "Moroccan musical and spiritual tradition",
      topics: ["Music", "Culture"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q1501622", licenseId: "cc0" }
    },
    {
      id: "wd:Q80985",
      wikidataId: "Q80985",
      label: "Fez",
      labels: { en: "Fez", ar: "فاس", fr: "Fès", es: "Fez" },
      aliases: ["Fes", "Fès", "فاس"],
      type: "city",
      description: "City in northern inland Morocco",
      coordinates: [34.0348, -5.0166],
      topics: ["History", "Architecture", "Darija"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q80985", licenseId: "cc0" }
    },
    {
      id: "wd:Q101625",
      wikidataId: "Q101625",
      label: "Marrakesh",
      labels: { en: "Marrakesh", ar: "مراكش", fr: "Marrakech", es: "Marrakech" },
      aliases: ["Marrakech", "Marrakesh Medina", "مراكش"],
      type: "city",
      description: "City in western Morocco",
      coordinates: [31.6295, -7.9811],
      topics: ["History", "Architecture", "Culture"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q101625", licenseId: "cc0" }
    },
    {
      id: "wd:Q3551",
      wikidataId: "Q3551",
      label: "Rabat",
      labels: { en: "Rabat", ar: "الرباط", fr: "Rabat", es: "Rabat" },
      aliases: ["الرباط"],
      type: "city",
      description: "Capital city of Morocco",
      coordinates: [34.0209, -6.8416],
      topics: ["Architecture", "History"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q3551", licenseId: "cc0" }
    },
    {
      id: "wd:Q193009",
      wikidataId: "Q193009",
      label: "Essaouira",
      labels: { en: "Essaouira", ar: "الصويرة", fr: "Essaouira", es: "Esauira" },
      aliases: ["Mogador", "الصويرة"],
      type: "city",
      description: "Atlantic coastal city in Morocco",
      coordinates: [31.5085, -9.7595],
      topics: ["Music", "Culture", "History"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q193009", licenseId: "cc0" }
    },
    {
      id: "wd:Q194277",
      wikidataId: "Q194277",
      label: "Ait Benhaddou",
      labels: { en: "Ait Benhaddou", ar: "آيت بن حدو", fr: "Aït-ben-Haddou", es: "Ait Ben Hadu" },
      aliases: ["Aït Benhaddou", "Ait Ben Haddou", "آيت بن حدو"],
      type: "world-heritage-site",
      description: "Historic fortified village in Morocco",
      coordinates: [31.047, -7.1295],
      topics: ["Architecture", "Culture", "History"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q194277", licenseId: "cc0" }
    },
    {
      id: "wd:Q1135111",
      wikidataId: "Q1135111",
      label: "Hassan Tower",
      labels: { en: "Hassan Tower", ar: "صومعة حسان", fr: "Tour Hassan", es: "Torre Hasán" },
      aliases: ["Tour Hassan", "صومعة حسان"],
      type: "monument",
      description: "Historic minaret in Rabat, Morocco",
      coordinates: [34.024, -6.822],
      topics: ["Architecture", "History"],
      source: { id: "wikidata", url: "https://www.wikidata.org/wiki/Q1135111", licenseId: "cc0" }
    }
  ],
  relationships: [
    { from: "wd:Q1028", to: "wd:Q56426", type: "has-language", weight: 0.98, confidence: 0.95, evidence: "Wikidata seed: Moroccan Arabic is associated with Morocco." },
    { from: "wd:Q1028", to: "wd:Q1501622", type: "has-cultural-tradition", weight: 0.92, confidence: 0.9, evidence: "Wikidata seed: Gnawa is associated with Morocco." },
    { from: "wd:Q1028", to: "wd:Q80985", type: "contains-place", weight: 0.9, confidence: 0.95, evidence: "Wikidata seed: Fez is a city in Morocco." },
    { from: "wd:Q1028", to: "wd:Q101625", type: "contains-place", weight: 0.9, confidence: 0.95, evidence: "Wikidata seed: Marrakesh is a city in Morocco." },
    { from: "wd:Q1028", to: "wd:Q3551", type: "contains-place", weight: 0.88, confidence: 0.95, evidence: "Wikidata seed: Rabat is the capital of Morocco." },
    { from: "wd:Q1028", to: "wd:Q193009", type: "contains-place", weight: 0.82, confidence: 0.9, evidence: "Wikidata seed: Essaouira is a Moroccan city." },
    { from: "wd:Q1028", to: "wd:Q194277", type: "contains-place", weight: 0.8, confidence: 0.9, evidence: "Wikidata seed: Ait Benhaddou is in Morocco." },
    { from: "wd:Q3551", to: "wd:Q1135111", type: "contains-monument", weight: 0.88, confidence: 0.92, evidence: "Wikidata seed: Hassan Tower is in Rabat." },
    { from: "wd:Q1501622", to: "topic:Music", type: "has-topic", weight: 0.95, confidence: 0.92, evidence: "Seed topic mapping." },
    { from: "wd:Q56426", to: "topic:Darija", type: "has-topic", weight: 0.98, confidence: 0.92, evidence: "Seed topic mapping." },
    { from: "wd:Q194277", to: "topic:Architecture", type: "has-topic", weight: 0.9, confidence: 0.9, evidence: "Seed topic mapping." },
    { from: "wd:Q80985", to: "topic:History", type: "has-topic", weight: 0.88, confidence: 0.86, evidence: "Seed topic mapping." }
  ]
});
