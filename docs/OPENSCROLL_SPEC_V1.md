# OpenScroll 1.0 Complete System Specification

**Status:** Authoritative Specification  
**Version:** 1.0.0  
**Product:** OpenScroll 1.0  
**Target:** Mobile-First, Responsive Desktop, Account-Free, Zero-UGC Universal Open Knowledge Discovery Platform

---

## 1. Product Mission & Philosophy

### 1.1 The Core Promise
> **Choose what you are curious about. Choose where you want to go. OpenScroll opens the world's collections for you.**

OpenScroll turns an explicitly chosen curiosity into a peaceful, personalized multimedia stream assembled exclusively from verifiably open knowledge, cultural heritage, scientific literature, archival media, maps, and datasets.

### 1.2 Non-Negotiable Tenets
1. **Verifiably Open Corpus Only**: Only media and knowledge objects possessing an unambiguous, legally qualified open license (CC0, CC BY, CC BY-SA, Public Domain, ODbL) enter the main Scroll. Unknown, NonCommercial (`-NC`), NoDerivatives (`-ND`), or unverified rights strictly fail closed.
2. **Zero Consumer Accounts & Zero Surveillance**: No registration, passwords, OAuth, cloud user profiles, or cross-site tracking exist. All personal Scrolls, topic weights, exclusions, saved items, collections, reading positions, and explicit feedback remain local to the browser's IndexedDB.
3. **Strict Zero-UGC Boundary**: OpenScroll is not a social network or publishing platform. Users cannot upload media, author posts, leave public comments, publish collections, or broadcast custom recipes.
4. **Intent Before Algorithm**: Explicit user topic choices and weights govern the stream. The system does not optimize for time-on-app, compulsion loops, infinite streaks, or behavioral addiction.
5. **Artifact-First Zen Aesthetic**: Media and knowledge objects lead the visual hierarchy. Chrome and controls recede into quiet progressive disclosure layers.

---

## 2. Information Architecture & Navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Universal Header                               │
│  [O Brand Icon]               [Active Scroll / Search]         [Locale / RTL] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                               Content Stage                                 │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌────────┐  │
│  │   Image Stage   │  │   Audio Player  │  │  Article Reader │  │ Map/Data│ │
│  │  (Zoom & Props) │  │  (Waveform/Trs) │  │  (Typography)   │  │ (Stage) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         4-Tab Primary Navigation                            │
│    [📜 Scrolls]         [🧭 Explore]         [🔖 Saved]        [⚙️ Settings] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Primary Views
1. **Scrolls (`/scrolls`)**: Multi-Scroll management dashboard. Create new Scrolls, switch active interest streams, adjust topic recipes, view generation history, and export backup JSON.
2. **Explore (`/explore`)**: Curated editorial journeys, categorical gateways (Eras, Civilizations, Sonic Traditions, Open Science, Biodiversity), and featured institution spotlights.
3. **Saved (`/saved`)**: Browser-local library of saved objects. Supports filter-by-medium, search within saves, custom named collections (e.g., *"Moroccan Architecture"*, *"Renaissance Astronomy"*), and offline inspection.
4. **Settings (`/settings`)**: Local device storage controls, persistence status (`navigator.storage.persist()`), export/import backup, language selection (`en`, `es`, `ar` with RTL), theme mode (`system`, `light`, `dark`), media toggles, and privacy controls.

---

## 3. Data Models & Contracts

### 3.1 Universal Content Object (`uco.v1`)
Every piece of content ingested from any global institution is normalized into a strict, immutable `uco.v1` record:

```typescript
interface UniversalContentObject {
  schemaVersion: "uco.v1";
  id: string; // e.g. "uco:smithsonian:nmafa-robe-morocco"
  canonicalUrl: string; // "https://openscroll.app/item/smithsonian/nmafa-robe-morocco"
  identity: {
    sourceItemId: string;
    sourceRecordUrl: string;
    originalSourceUrl: string;
    stableKey: string;
  };
  content: {
    type: "article" | "dictionary" | "source-text" | "travel-guide" | "image" | "audio" | "video" | "museum-object" | "dataset" | "map" | "knowledge-entity";
    title: string;
    originalTitle: string;
    description: string;
    topics: string[];
  };
  creator: {
    names: Array<{ name: string; role: string }>;
    institution: string;
  };
  time: {
    createdAt?: string;
    publishedAt?: string;
    temporalCoverage?: string;
    retrievedAt: string;
    freshness: "dated" | "source-current";
  };
  geography: {
    places: Array<{ label: string; countryCode?: string; coordinates?: [number, number] }>;
    countryCodes: string[];
  };
  language: {
    original: string; // e.g. "ar", "en", "zgh"
    available: string[];
    translatedFields: string[];
  };
  knowledge: {
    entities: Array<{ id: string; label: string; source: string }>;
    topics: string[];
    collection: string;
  };
  media: {
    kind: "image" | "audio" | "video" | "text" | "dataset" | "map" | "museum-object" | "knowledge-entity";
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    accessibility: {
      altText?: string;
      captions?: string;
      transcript?: string;
    };
  };
  source: {
    id: string; // e.g. "smithsonian-open-access"
    name: string;
    connector: string;
    retrievedAt: string;
    links: string[];
  };
  rights: RightsPassport;
  ranking: {
    quality: number; // 0.0 to 1.0
    relevanceSignals: {
      explicitTopicMatch: number;
      sourceConfidence: number;
      metadataCompleteness: number;
    };
    diversitySignals: {
      medium: string;
      source: string;
      language: string;
      geography: string;
    };
  };
  system: {
    createdAt: string;
    updatedAt: string;
    ingestRunId: string;
    sourceHealth: "healthy" | "degraded" | "rate-limited" | "offline";
    warnings: string[];
    provenance: Record<string, FieldProvenance>;
  };
}
```

### 3.2 Rights Passport (`rights.v1`)
```typescript
interface RightsPassport {
  schemaVersion: "rights.v1";
  ontologyVersion: "license-ontology.v1";
  licenseId: "cc0" | "public-domain" | "public-domain-mark" | "us-gov-public-domain" | "cc-by-4.0" | "cc-by-sa-4.0" | "odbl";
  label: string;
  url: string;
  attribution: string;
  attributionNotice: {
    text: string;
    markdown: string;
    parts: { title: string; creator: string; sourceName: string; sourceUrl: string; licenseLabel: string; licenseUrl: string };
    obligations: Array<"attribution" | "share-alike">;
  };
  verifiedAt: string;
  verification: {
    status: "verified" | "needs-review" | "failed";
    sourceVerified: boolean;
    evidence: string;
    originalSourceUrl: string;
  };
  eligibility: "eligible" | "review" | "rejected";
  openUse: {
    access: boolean;
    redistribution: boolean;
    modification: boolean;
    commercialUse: boolean;
  };
  whyOpen: {
    headline: string;
    bullets: string[];
    basis: string;
  };
  downloadPolicy: {
    allowed: boolean;
    access: "source-file-and-metadata" | "blocked";
    notice: string;
    files: { mediaUrl?: string; metadataUrl?: string };
  };
}
```

---

## 4. Entity Resolution & Dynamic Topic Expansion

```
[ User Input Query (e.g. "Morocco" / "Renaissance" / "Oceanography") ]
                             │
                             ▼
              [ 1. Entity Resolution Engine ]
       Queries Wikidata API (`wbsearchentities` / `wbgetentities`)
      Resolves canonical entity Q-ID + Multilingual aliases + Coordinates
                             │
                             ▼
              [ 2. Topic Graph Generator ]
     Traverses P31 (instance-of), P279 (subclass), P361 (part-of)
   Clusters related knowledge into 5–7 thematic dimensions (18–30 topics)
  ├── Historical & Archival Dimensions
  ├── Arts, Music & Acoustic Culture
  ├── Architecture, Heritage & Urbanism
  ├── Languages, Literature & Dialects
  └── Geospatial, Environmental & Open Data
                             │
                             ▼
              [ 3. Multilingual Query Planner ]
      Constructs parallel query vectors in English, Arabic, French, etc.
```

---

## 5. Multi-Source Connectors & Ingestion Architecture

| Connector | Sources Covered | Methods Supported | Rights Verification Mode |
| :--- | :--- | :--- | :--- |
| **Wikimedia Knowledge** | Wikipedia, Wikidata, Wikisource, Wikivoyage, Wiktionary | `search`, `fetch`, `normalize`, `extractRights`, `resolveEntities` | Strict CC BY-SA 4.0 / CC0 item-level metadata check |
| **Wikimedia Commons** | Wikimedia Commons media repository | `search`, `fetchMedia`, `extractRights` | File page license check; verified CC0/CC BY/CC BY-SA/PD |
| **Openverse** | Independent open photo & audio repositories | `search`, `fetch`, `extractRights` | Strict re-verification against original source; fails closed on NC/ND |
| **Smithsonian Open Access** | Smithsonian Museums (NMAfA, NMNH, SAAM, Cooper Hewitt, etc.) | `search`, `fetch`, `normalize` | Verified CC0 Open Access items with IIIF & high-res assets |
| **Europeana** | 2,000+ European libraries, galleries, and archives | `search`, `fetch`, `normalize` | Item-level EDM rights statement (PDM, CC0, CC BY, CC BY-SA) |
| **DPLA** | Digital Public Library of America | `search`, `fetch`, `normalize` | Standardized RightsStatements.org and CC open metadata |

---

## 6. Diversity-Aware Feed Composition & Ranking

The Feed Composer guarantees a calm, non-monotonous, and deeply enriching discovery rhythm:

1. **Medium Diversity Constraint**: No more than **two consecutive items** may share the same medium (e.g., Image → Image → Must be Audio, Reader, Map, Dataset, or Museum Object).
2. **Source Diversity Constraint**: No more than **two consecutive items** may come from the same repository institution.
3. **Pacing Rhythm**: Alternates visual immersion, auditory exploration, deep reading, and spatial/analytical discovery.
4. **Active Feedback Re-Weighting**: When a user selects *"More like this"*, *"Go deeper"*, or *"More surprising"*, the active Interest Graph weights are dynamically updated, modifying subsequent retrieval scoring in real-time.
5. **Humane Session Boundaries**: Every 25 items, a peaceful session marker pauses the stream with a clear summary:
   > *"You explored 25 objects across 8 verified open sources. Take a breath, pause here, or continue when ready."*

---

## 7. Media-Native Card Specifications

| Media Type | Visual Hierarchy | Core Controls & Features |
| :--- | :--- | :--- |
| **High-Res Image** | Full-width natural aspect ratio presentation with subtle zoom affordance. | Zoom inspector, caption drawer, creator attribution, rights badge. |
| **Audio & Music** | Ambient wave visualizer, prominent transport controls, and duration. | Play/pause/seek, transcript sheet, performer & recording distinctions. |
| **Video** | Native aspect video container with custom play controls. | Closed captions, transcripts, quality switcher (no autoplay with sound). |
| **Article Reader** | Humanist typography excerpt with reading time estimate. | Distraction-free full-screen reader modal, typography switcher, translation toggle. |
| **Map & Geography** | Interactive OpenStreetMap tile stage with geographic coordinate pins. | Zoom/pan controls, layer selector, ODbL attribution, place details. |
| **Dataset & Charts** | Clear bar/line/metric visualization or structured data table. | Measurement units, data freshness, methodology drawer, download CSV/JSON. |
| **Museum & 3D Object** | High-contrast neutral gallery stage for 3D/sculptural artifacts. | Material, era, dimensions, zoom inspection, institutional collection context. |
| **Dictionary & Language** | Hero script typography with pronunciation and etymology. | Audio pronunciation button, transliteration, root derivation, usage notes. |

---

## 8. Local-First IndexedDB Architecture

```
Database: "openscroll-local" (Version 1)
├── Object Store: "meta" (Key: key) -> Schema versions, migration timestamps
├── Object Store: "settings" (Key: key) -> Locale, theme, media toggles, sources, accessibility
├── Object Store: "scrolls" (Key: id) -> Named Scrolls, root entities, topic weights, exclusions
├── Object Store: "saves" (Key: id) -> Bookmarked UCOs with complete rights passports
├── Object Store: "collections" (Key: id) -> User-named groupings of saved items
├── Object Store: "feedback" (Key: id) -> Explicit user signals (more-like-this, deeper, hidden)
└── Object Store: "history" (Key: id) -> Browsing history (cleared independently anytime)
```

---

## 9. Accessibility & Internationalization (WCAG 2.2 AA)

* **44px Minimum Touch Target** for all interactive icons and buttons.
* **Persistent Accessible Names** on every icon button (`aria-label`, tooltips, and screen-reader context).
* **Right-to-Left (RTL) First-Class Support**: Full bidirectional mirroring for Arabic (`dir="rtl"`), directional icon flipping, and localized numbers (`Intl.NumberFormat`).
* **High-Contrast Typography**: Complies with 4.5:1 text contrast and 3:1 graphical element contrast in both light and dark gallery themes.
* **Reduced Motion**: Full compatibility with `prefers-reduced-motion: reduce` and local user settings.
