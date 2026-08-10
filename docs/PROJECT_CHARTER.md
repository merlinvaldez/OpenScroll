# OpenScroll Project Charter

**Status:** Active delivery; Epic C implementation in review  
**Version:** 1.4  
**Date:** August 10, 2026  
**Product:** OpenScroll 1.0  
**Product type:** Mobile-first open knowledge and media discovery platform

## 1. Charter Purpose

This charter authorizes the design and development of OpenScroll 1.0 and establishes the shared product outcome, scope, principles, responsibilities, decision rules, measures of success, and major risks.

OpenScroll will turn an explicitly chosen interest into a peaceful, personalized multimedia stream assembled only from verifiably open knowledge, culture, media, archives, research, and data.

## 2. Product Mandate

OpenScroll exists to make the world's open collections easy to discover without requiring people to know which library, archive, museum, repository, government portal, or database to search.

The central promise is:

> Choose what you are curious about. Choose where you want to go. OpenScroll opens the world's collections for you.

The product must make scrolling feel worthwhile, calm, and intentional. It must not reproduce the attention-maximizing patterns of social feeds.

## 3. Problem Statement

Vast quantities of valuable open knowledge and culture are fragmented across institutional systems. Existing interfaces usually assume that users already know what to search for, how a collection is organized, what language or terminology to use, and which source may contain the material.

This creates four product problems:

1. **Discovery friction:** Users cannot easily move from a broad curiosity to meaningful material.
2. **Fragmentation:** Images, audio, books, research, maps, datasets, and archival objects live in separate systems.
3. **Rights ambiguity:** Free access is frequently confused with legal openness and reuse.
4. **Attention-hostile consumption:** Mainstream feeds optimize for continued engagement rather than curiosity, variety, depth, or user agency.

## 4. Vision

OpenScroll becomes the universal discovery interface for the open knowledge commons: a place where a person can enter any interest, select its meaningful branches, and encounter the world's openly reusable media and knowledge as one coherent experience.

## 5. 1.0 Outcome

A user can enter a broad interest such as **Morocco**, choose related topics such as Darija, Gnawa, architecture, food, history, and photography, and receive a varied Scroll containing eligible text, images, audio, video, cultural heritage, maps, research, datasets, and archival material.

Every item must clearly disclose its source, creator when known, license, reason for appearing, and basis for being considered open.

## 6. Target Users

### Primary users

- Curious generalists who want to explore a subject without knowing where to begin
- Lifelong learners who prefer multimedia discovery to formal courses
- Travelers and cultural explorers seeking depth beyond commercial guides
- Students and educators collecting trustworthy, reusable material
- Researchers and creators beginning broad discovery across collections

### Primary job to be done

> When I become curious about a subject, help me choose the directions that matter to me and continuously discover trustworthy, openly reusable material across many media without making me learn the underlying source systems.

## 7. Product Principles

1. **Intent before algorithm:** Explicit choices remain stronger than inferred behavior.
2. **Artifact before interface:** Media and knowledge objects receive the visual emphasis.
3. **Open or absent:** Unknown, restricted, noncommercial, or no-derivatives content does not enter the main Scroll.
4. **Quiet transparency:** Provenance and recommendation logic are always available but never visually compete with the artifact.
5. **Diversity over compulsion:** Ranking optimizes for relevance, variety, perspective, depth, and discovery rather than time spent.
6. **Progressive disclosure:** The first layer is simple; detail appears exactly when requested.
7. **Local perspective:** Country and culture Scrolls intentionally seek creators, languages, and institutions connected to the culture.
8. **One world, many media:** Institutional differences disappear at the interaction layer while source identity remains intact.
9. **User-controlled completion:** Sessions have humane stopping points and never rely on forced endlessness.
10. **No consumer accounts:** Anyone can use OpenScroll immediately. Personal Scrolls, preferences, history, saves, and collections remain local to that browser unless the user deliberately exports them for private backup or transfer.
11. **No user-generated content:** Users cannot upload, author, submit, publish, distribute, or publicly display their own media, writing, annotations, collections, Scroll recipes, or generated artifacts through OpenScroll.

## 8. Scope of OpenScroll 1.0

### In scope

- Interest entry and entity resolution
- AI- and knowledge-graph-assisted topic expansion
- User-selected topic graph and Scroll creation
- Multiple saved Scrolls
- Multimedia feed and medium-specific content cards
- Branch exploration and new-Scroll creation
- Explicit feed controls and semantic preference controls
- Global search and editorial exploration
- Locally saved Scrolls, preferences, history, saves, and collections
- Sharing canonical links to existing verified-open source items and public topic pages
- Private local export/import for backup and device transfer
- Source, rights, attribution, and recommendation transparency
- Multilingual discovery, translation, and original-language access
- Sensitive-content labeling and contextual notes
- Source registry, connector framework, normalization, deduplication, ranking, and feed composition
- Rights engine and human license-review queue
- Admin tools for source health, coverage, metadata, rights, and representation gaps
- Broad 1.0 source universe specified in the PRD

### Explicitly out of scope

- Social posts and social-feed aggregation
- Content with unknown or incompatible reuse rights
- Standard YouTube licensed video
- Spotify or Apple Music playback without an independently open recording
- Advertising-based behavioral profiling
- Consumer registration, login, profiles, account recovery, or cloud synchronization
- User uploads, posts, comments, annotations, public collections, public Scroll recipes, publishing tools, creator pages, or user-generated feeds
- A creator social network, comments, follower counts, or public popularity contests
- Final selection of the business model
- A commitment that the application code itself will be open source

## 9. Core Experience

The critical path is:

**Interest → Topic selection → Build Scroll → Consume mixed media → Inspect context or rights → Save or respond → Explore a branch → Continue or stop intentionally**

The 1.0 experience is successful only if this flow feels coherent across media types and source institutions.

## 10. Core Deliverables

### Product and design

- Validated information architecture
- End-to-end mobile-first UX flows
- Design system and icon language
- Medium-specific card system
- Accessibility specification
- Interactive prototype of the critical path
- Content, provenance, rights, and AI-labeling patterns

### Platform

- Universal Content Object and source schema
- Source Registry and connector SDK
- Normalized license ontology, License Gate, and Attribution Engine
- Knowledge, content, and interest graph models
- Search, semantic retrieval, multilingual query planning, and entity resolution
- Deduplication, ranking, diversity constraints, and feed composition
- Ingestion, refresh, caching, availability, and source health systems
- Admin console and rights-review workflow

### Initial integrations

- Wikimedia ecosystem
- Openverse
- Smithsonian Open Access
- Europeana
- DPLA
- Internet Archive qualifying collections
- MusicBrainz plus eligible audio sources
- Open scholarship discovery plus qualifying full text
- OpenStreetMap
- CKAN, Socrata, ArcGIS, and qualifying government open data

## 11. Workstreams and Ownership

| Workstream | Accountable role | Primary responsibilities |
| --- | --- | --- |
| Product | Product lead | Vision, priorities, acceptance, scope integrity |
| Experience design | Design lead | IA, flows, design system, prototypes, accessibility |
| Content and editorial | Content lead | Taxonomy quality, context standards, sensitive content |
| Rights and provenance | Rights lead / counsel | License ontology, policies, edge-case review |
| Data and platform | Engineering lead | Schemas, ingestion, search, graph, infrastructure |
| Connectors | Integrations lead | Source adapters, health, rate limits, refresh |
| AI and relevance | ML/relevance lead | Expansion, retrieval, ranking, enrichment, evaluation |
| Cultural representation | Research/editorial lead | Local-source coverage, language and perspective evaluation |
| Trust and safety | Trust lead | Labels, user controls, historical-context standards |
| Measurement | Analytics lead | Metrics, guardrails, experiments, instrumentation |

One person may hold multiple roles early, but every decision area must have a named accountable owner.

## 12. Decision Rules

When trade-offs arise, the team will decide in this order:

1. Legal openness and user safety
2. Source truth and provenance
3. User intent and control
4. Accessibility
5. Content quality and cultural representation
6. Calmness and clarity of the experience
7. Breadth and novelty
8. Engagement and growth

No growth or engagement objective may override the first six priorities.

## 13. Milestones Within 1.0

This is incremental delivery of a large 1.0, not a reduction of the product vision.

### A. Foundation

Universal Content Object, Source Registry, License Gate, attribution, graph model, connector SDK, design foundations.

### B. Collection breadth

Wikimedia, Openverse, Smithsonian, Europeana, DPLA, archival and book sources.

### C. Media breadth

Audio, music knowledge, eligible video, maps, research, open datasets, visualizations.

### D. Intelligence

Topic expansion, multilingual queries, entity resolution, translation, summarization, deduplication, diversity-aware ranking.

### E. Complete product experience

Scroll creation, media-native feed, branch exploration, collections, source controls, rights transparency, admin coverage tools, and release readiness.

Each milestone must leave the shared architecture usable and tested by the next workstream.

## 14. Success Measures

### North-star measure

**Meaningful Discovery Rate:** the percentage of feed sessions in which a user explicitly saves, explores, collects, or marks as valuable at least one previously unknown item across more than one medium.

### Product measures

- Scroll creation rate
- Intent alignment rating
- Feed satisfaction
- Explore-branch rate
- Save and collection rate
- Media diversity engaged
- Source diversity represented
- Local-perspective representation
- Session completion or intentional continuation rate

### Platform quality measures

- Verified open-rights coverage
- Attribution completeness
- License decision accuracy
- Duplicate suppression
- Source availability
- Metadata completeness
- Accessible-media coverage, including captions, transcripts, and alt text

### Guardrails

- Repetitive content
- Source, language, geographic, or institutional concentration
- Low-confidence rights exposure
- Broken media or source links
- AI factual corrections
- Mislabeling AI enrichment as source metadata
- Compulsive-use signals caused by product mechanics

Time spent is diagnostic, not a primary success metric.

## 15. Major Risks and Responses

| Risk | Consequence | Required response |
| --- | --- | --- |
| Rights metadata is incomplete or wrong | Legal and trust failure | Fail closed; verify at source; human review for unknown licenses |
| Open current-events supply is thin | Current feeds feel stale | Set expectations; prioritize open reporting, government releases, and data |
| Foreign institutions dominate cultural Scrolls | Distorted representation | Measure and rank for local creators, languages, and institutions |
| Breadth creates a noisy interface | Product loses calmness | Media-first layout, progressive disclosure, limited persistent controls |
| Icon-first UI becomes ambiguous | Usability and accessibility failure | Standard icons, labels on first use and focus, accessible names, usability testing |
| Downloaded or exported source material loses required attribution | Rights and trust failure | Bundle attribution and license data with every permitted source download or metadata export |
| Source APIs change or fail | Broken feeds | Independent connectors, cached metadata, health states, fallback composition |
| AI invents context or metadata | Misinformation | Field-level provenance, evaluation, source-authoritative display, correction tools |
| Cross-source duplicates overwhelm users | Repetition | Canonical clusters, perceptual hashes, identifiers, semantic matching |
| Large 1.0 becomes ungovernable | Delays and integration debt | Shared contracts, acceptance gates, incremental vertical slices, named owners |

## 16. Release Gates

OpenScroll 1.0 is releasable when:

- A broad interest reliably becomes a useful, editable topic graph.
- A user can build, consume, edit, save locally, and branch a Scroll.
- Rich interests yield a genuinely mixed-media session where eligible content exists.
- Every main-feed object passes rights verification and exposes required provenance.
- AI-generated and translated fields remain distinguishable and traceable.
- Feed composition prevents dominant sources, media, duplicate artifacts, and repetitive entities.
- Core flows meet WCAG 2.2 AA and have passed assistive-technology testing.
- Usability testing confirms that the icon-led interface is understandable without instructional walls of text.
- Source and rights failures degrade safely without collapsing the feed.

## 17. Governance Cadence

- Weekly product, design, platform, and integration review
- Biweekly rights and provenance review
- Monthly cultural-representation and source-coverage review
- Milestone release-readiness review using the acceptance criteria
- Decision log for scope, rights, AI, representation, and interaction changes

## 18. Open Decisions

- Brand clearance and final name
- Jurisdiction rules for public-domain content
- Translation and AI-summary derivative-work policy
- ShareAlike propagation across generated artifacts
- Asset caching by source and rights class
- Formal method for measuring local perspective
- Business model and institutional edition boundaries

## 19. Charter Approval

Approval means the team agrees that OpenScroll 1.0 is a broad, rights-first, multimedia product and that implementation sequencing will not be used to quietly narrow the product promise.

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product sponsor |  |  |  |
| Product lead |  |  |  |
| Design lead |  |  |  |
| Engineering lead |  |  |  |
| Rights lead |  |  |  |

## 20. OpenScroll 1.0 Delivery Backlog

This backlog converts the PRD into implementation tickets. Together, the tickets cover the complete 1.0 user experience and the platform capabilities required to support it. Ticket ordering expresses dependencies, not a smaller product scope.

### Ticket standard

Every ticket is complete only when:

- Acceptance criteria pass in automated or documented manual verification.
- Loading, empty, error, offline, permission, and degraded states relevant to the feature are handled.
- WCAG 2.2 AA requirements are met for the changed surface.
- Analytics use privacy-preserving events and contain no unnecessary behavioral payload.
- Source metadata, AI enrichment, translation, and rights decisions remain field-level traceable.
- Security, privacy, performance, localization, and observability implications are reviewed.
- User-facing documentation and internal runbooks are updated where applicable.

### Epic A: Product foundation and design system

**Status:** Complete. Merged to `main` in PR #4 on August 10, 2026; OS-001 through OS-008 are accepted as the production foundation.

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-001 | **Establish the monorepo and environments.** As a contributor, I need a consistent workspace so that clients, services, workers, and shared packages can be developed safely. | Local, test, staging, and production configurations are separated; secrets are externalized; lint, test, build, and migration commands run in CI. | None |
| OS-002 | **Create shared API and event contracts.** As a platform team, we need versioned contracts so independently delivered services remain compatible. | Schemas are versioned; breaking-change checks run in CI; error and pagination envelopes are standardized. | OS-001 |
| OS-003 | **Implement OpenScroll design tokens.** As a user, I need a visually coherent interface across media and platforms. | Light/dark colors, typography, spacing, radii, motion, elevation, and semantic states match `OpenScroll_DESIGN.md`; contrast checks pass. | OS-001 |
| OS-004 | **Implement the icon system.** As a user, I need compact actions that remain understandable and accessible. | One icon family is used; every control has a 44px target, accessible name, focus state, tooltip where relevant, and labeled expanded state; nonstandard icons teach on first use. | OS-003 |
| OS-005 | **Build core interaction primitives.** As a designer and engineer, I need consistent sheets, toasts, controls, chips, viewers, skeletons, and error states. | Components support keyboard, screen reader, RTL, dynamic type, reduced motion, light/dark themes, and responsive layouts. | OS-003, OS-004 |
| OS-006 | **Build responsive app shells.** As a user, I need navigation appropriate to mobile, tablet, and desktop. | Mobile bottom navigation, tablet rail, desktop three-region layout, global search access, and focus restoration behave as specified. | OS-005 |
| OS-007 | **Create accessibility test harness.** As a disabled user, I need core interactions to work with assistive technology. | Automated checks run in CI; manual test scripts cover screen reader, keyboard, switch, zoom, reduced motion, captions, RTL, and chart alternatives. | OS-005 |
| OS-008 | **Create localization and script framework.** As a multilingual user, I need the interface and content layers to render naturally in my language. | Locale routing, pluralization, date/number formatting, font fallback, bidi isolation, RTL layout, and original/translation attribution are supported. | OS-003, OS-006 |

### Epic B: Local-first preferences, continuity, and privacy

**Status:** Complete. Merged to `main` in PR #5 on August 10, 2026; OS-009 through OS-012 are accepted as the local-first privacy and continuity foundation.

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-009 | **Enable account-free exploration.** As a new user, I want to start and keep using OpenScroll without registering or logging in. | Interest entry, topic selection, Scroll creation, saves, collections, history, and settings work anonymously; no consumer authentication code, identifier, or account prompt appears. | OS-006 |
| OS-010 | **Implement the local data layer.** As a returning user, I want my Scrolls and preferences to remain in this browser. | Versioned IndexedDB stores Scrolls, settings, saves, collections, explicit feedback, and history; transactions, migrations, quota errors, unsupported/private-mode behavior, and corruption recovery are tested. | OS-009 |
| OS-011 | **Build local settings and storage controls.** As a user, I want to manage languages, media, sources, history, accessibility, privacy, and device storage. | Settings persist locally; storage use and persistence status are visible; Clear, Export, and Import are understandable and reversible where possible. | OS-010, OS-008 |
| OS-012 | **Implement local privacy and data lifecycle.** As a user, I want control over every locally stored personalization record. | Explicit and implicit signals are distinguishable; history clearing, selective deletion, complete local reset, portable export, validated import, and retention limits work end to end; telemetry remains separate and minimal. | OS-010 |

### Epic C: Universal content, source registry, and connectors

**Status:** Implementation in review. OS-013 through OS-020 are included in the Epic C pull request for acceptance.

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-013 | **Implement the Universal Content Object.** As the platform, we need one canonical representation across source types. | Required identity, content, creator, time, geography, language, knowledge, media, source, rights, ranking, and system fields validate; field provenance is retained. | OS-002 |
| OS-014 | **Build the Source Registry.** As an administrator, I need to define source behavior, quality, rights, coverage, and refresh policy. | Sources store connector, auth, rate limit, content types, language/geography, rights model, quality scores, refresh cadence, terms, and health. | OS-013 |
| OS-015 | **Build the connector SDK and conformance suite.** As an integration engineer, I need a standard adapter model. | Search, fetch, normalize, extract-rights, fetch-media, resolve-entities, refresh, rate-limit, and healthcheck contracts have fixtures and conformance tests. | OS-013, OS-014 |
| OS-016 | **Implement ingestion orchestration.** As the platform, we need resilient scheduled and on-demand collection. | Idempotent jobs, retries with backoff, dead-letter handling, rate-limit awareness, checkpoints, and per-source isolation work. | OS-015 |
| OS-017 | **Integrate Wikimedia knowledge projects.** As a user, I want open encyclopedia, travel, source text, and dictionary material. | Wikipedia, Wikidata, Wikisource, Wikivoyage, and Wiktionary items normalize with language, revision, attribution, links, and rights. | OS-015, OS-021 |
| OS-018 | **Integrate Wikimedia Commons.** As a user, I want eligible images, audio, and video. | File and page licenses are verified; renditions, captions, creators, categories, and attribution normalize; unsupported files degrade safely. | OS-015, OS-021 |
| OS-019 | **Integrate Openverse discovery.** As a user, I want broad open image and audio discovery. | Openverse results are treated as candidates; original-source rights are rechecked; unverifiable items are rejected. | OS-015, OS-021 |
| OS-020 | **Integrate major cultural aggregators.** As a user, I want material from Smithsonian, Europeana, and DPLA. | Each connector supports search/fetch, item-level rights, institution/collection, IIIF where present, media renditions, and source links; open metadata is separated from media rights. | OS-015, OS-021 |

### Epic D: Rights, licensing, and attribution

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-021 | **Implement normalized license ontology.** As the rights service, I need machine-readable permission and obligation rules. | CC0, Public Domain, CC BY, CC BY-SA, ODbL, qualifying government licenses, versions, and jurisdiction notes map to access, redistribution, modification, commercial use, attribution, and ShareAlike. | OS-002 |
| OS-022 | **Implement the Open License Gate.** As a user, I should only see verified-open objects in the main Scroll. | Unknown, restricted, NC, ND, non-redistributable, and noncommercial candidates fail closed; decisions retain evidence, timestamp, and rule version. | OS-013, OS-021 |
| OS-023 | **Build item-level source verification.** As the rights team, we need aggregators checked against authoritative source records. | Verification follows canonical source metadata or approved source rules; stale or conflicting evidence queues review; AI cannot approve rights. | OS-022 |
| OS-024 | **Build rights-review queue.** As an administrator, I need to classify new and ambiguous licenses. | Reviewers can inspect evidence, approve/reject/escalate, version decisions, and apply an identical verified rule prospectively with audit logs. | OS-022, OS-071 |
| OS-025 | **Build the Attribution Engine.** As a reuser, I need correct attribution when viewing or downloading eligible source material. | Title, creator, institution, license, source, permitted-use terms, and applicable obligations render from normalized rules and accompany every permitted download or metadata export. | OS-021, OS-023 |
| OS-026 | **Implement “Why open?” UI.** As a user, I want to understand what I may do with an item. | One gesture reveals license, plain-language permissions, obligations, rights holder, verification evidence, attribution, and source; legal icons always include text. | OS-005, OS-025 |
| OS-027 | **Implement rights-safe source downloads.** As a user, I need downloads limited to uses and formats OpenScroll can legally support. | Download eligibility derives from verified rights and source terms; every download includes or links required attribution; restricted derivatives and unsupported formats are blocked with a precise explanation. | OS-025 |

### Epic E: Knowledge, entity, content, and interest graphs

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-028 | **Build foundational Knowledge Graph ingestion.** As the topic engine, I need structured world relationships. | Wikidata entities, aliases, types, locations, dates, relationships, and external identifiers are indexed with refresh and provenance. | OS-017 |
| OS-029 | **Implement entity resolution.** As a user, I want Fez, Fes, and فاس treated as the same place. | Multilingual aliases, identifiers, coordinates, context, and confidence resolve entities; ambiguity triggers user or admin review instead of silent merging. | OS-028, OS-008 |
| OS-030 | **Build the Content Graph.** As a user, I want items connected by people, places, topics, time, media, collections, and sources. | Edges retain origin, confidence, and update time; source and AI-inferred edges remain distinguishable. | OS-013, OS-029 |
| OS-031 | **Build the Interest Graph.** As a user, I want explicit topic choices, weights, and exclusions to govern my Scroll. | Root topics, selected branches, semantic weights, exclusions, languages, media, time, depth, surprise, sources, and change history persist independently of world knowledge. | OS-010, OS-028 |
| OS-032 | **Implement graph relationship APIs.** As clients and ranking services, we need predictable traversal and explanation paths. | Bounded traversal, relationship filtering, permissions, caching, pagination, and causal-path responses meet latency targets. | OS-030, OS-031 |

### Epic F: Interest entry, topic expansion, and Scroll creation

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-033 | **Build interest-entry experience.** As a user, I want to begin by typing anything I am curious about. | The screen follows the design spec, supports keyboard/voice input where available, avoids onboarding walls, and handles no-network and no-match states. | OS-006, OS-009 |
| OS-034 | **Resolve root-interest entities.** As a user, I want the system to understand whether Morocco means the country or another entity. | High-confidence entities resolve automatically; genuine ambiguity opens a compact selection sheet; chosen identity is visible and reversible. | OS-029, OS-033 |
| OS-035 | **Build Topic Graph Engine.** As a user, I want meaningful dimensions and branches generated from a broad interest. | Structured graph evidence is primary; AI fills gaps without inventing entities; cultural, historical, linguistic, geographic, societal, artistic, and domain-appropriate dimensions are returned. | OS-028, OS-029 |
| OS-036 | **Build multilingual Query Planner.** As a user, I want discovery beyond my interface language. | Root entity and topics generate structured IDs, synonyms, transliterations, and source-specific searches in relevant languages; original terms and generation provenance persist. | OS-008, OS-029, OS-035 |
| OS-037 | **Build topic-selection experience.** As a user, I want to choose, weight, expand, or exclude suggested topics without learning graph mechanics. | Grouped topics, pinned selections, Show more, semantic weights, exclusions, accessible controls, and Build Scroll behavior match the design specification. | OS-005, OS-035 |
| OS-038 | **Create and edit Scrolls.** As a user, I want multiple named Scrolls with controllable settings. | Root, selected/excluded topics, weights, languages, media, depth, time, geography, surprise, and sources save; edits take effect predictably without losing history. | OS-031, OS-037 |
| OS-039 | **Build honest Scroll-generation state.** As a user, I want feedback while sources and rights are checked. | Real activities are named; no fake percentage appears; long waits offer cancellation or background completion; partial failures do not fabricate success. | OS-038, OS-016, OS-022 |

### Epic G: Search, indexing, translation, and AI enrichment

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-040 | **Build full-text and faceted index.** As a user, I need fast search across titles, descriptions, creators, places, languages, sources, licenses, and media. | Multilingual analysis, filtering, pagination, highlighting, reindexing, and source deletion are supported. | OS-013, OS-016 |
| OS-041 | **Build semantic retrieval index.** As a user, I want conceptually relevant items despite vocabulary differences. | Versioned multilingual embeddings support retrieval and refresh; vector access respects rights and deletion state. | OS-013, OS-016 |
| OS-042 | **Build global search experience.** As a user, I want Gnawa results grouped into useful media and knowledge modes. | Overview, images, listen, watch, read, research, archives, data, people, places, and collections appear only when populated; filters and original-language queries work. | OS-006, OS-040, OS-041 |
| OS-043 | **Implement translation pipeline.** As a user, I want translated metadata while retaining the original. | Titles, descriptions, and eligible text translate with source language, model/version, timestamp, confidence, original toggle, and license compatibility. | OS-008, OS-021, OS-013 |
| OS-044 | **Implement AI classification and context.** As a user, I want useful topics and explanations without confusing generated context with source truth. | AI topics, summaries, descriptions, methods/limitations, and context are field-labeled; citations point to eligible source material; hallucination evaluation gates release. | OS-013, OS-030, OS-043 |
| OS-045 | **Implement source and AI metadata correction workflow.** As a user or admin, I want factual or attribution errors reviewable. | Reports retain the disputed field and provenance; source corrections and AI corrections route separately; resolution is audited and reflected in indexes. | OS-044, OS-071 |

### Epic H: Deduplication, ranking, and feed composition

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-046 | **Build exact and near-duplicate clustering.** As a user, I should not see the same artifact from multiple repositories repeatedly. | Checksums, perceptual hashes, identifiers, IIIF IDs, metadata, and embeddings form reviewable clusters; distinct works are not silently merged. | OS-013, OS-030, OS-041 |
| OS-047 | **Select canonical representations.** As a user, I want the highest-quality available object while retaining all provenance. | Resolution, accessibility, completeness, availability, rights, and source quality select a representation; alternatives and holding institutions remain inspectable. | OS-046, OS-023 |
| OS-048 | **Implement candidate retrieval.** As a user, I want items relevant to my Interest Graph from the verified corpus. | Retrieval combines structured, full-text, and semantic signals; rights, safety, availability, and exclusion filters are hard gates. | OS-032, OS-040, OS-041, OS-022 |
| OS-049 | **Implement transparent relevance ranking.** As a user, I want relevant discoveries without engagement-maximizing drift. | Explicit interest dominates implicit signals; source confidence, novelty, depth, perspective, temporal variety, and discovery value are measurable; engagement time is not the primary objective. | OS-031, OS-048 |
| OS-050 | **Implement diversity-aware feed composer.** As a user, I want a varied multimedia rhythm. | No more than two consecutive items share a medium or source; repeated entity and duplicate penalties work; contemporary/historical, introductory/deep, local/global, and familiar/surprising items are balanced. | OS-047, OS-049 |
| OS-051 | **Build local-perspective objective.** As a user exploring a culture, I want creators, languages, and institutions connected to that culture represented. | Creator origin, institution location, language, and geographic relevance are measured; coverage gaps are visible; ranking targets are configurable and evaluated by local reviewers. | OS-014, OS-029, OS-049 |
| OS-052 | **Implement feed pagination and session boundaries.** As a user, I want control over continuing after a meaningful batch. | Stable cursor pagination avoids repeats; the 25-item marker summarizes sources/media and offers Pause or Continue; no streak or loss framing appears. | OS-050 |

### Epic I: Multimedia Scroll and content viewers

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-053 | **Build the core Scroll feed.** As a user, I want to move smoothly through a mixed-media feed. | Header collapse/return, next/previous, action rail, focus restoration, session marker, loading, and degraded states match the design spec; gestures have visible equivalents. | OS-006, OS-052 |
| OS-054 | **Build image and archival viewers.** As a user, I want to inspect photographs, art, scans, manuscripts, posters, and primary sources. | Natural ratio, zoom, full-resolution option, creator/date/location/collection, primary-source label, context, alt text, and provenance work without destructive crops. | OS-053, OS-025 |
| OS-055 | **Build audio and music viewers.** As a user, I want to hear eligible recordings and understand artists, works, and relationships. | Accessible transport, duration, waveform where useful, transcript, performer, recording/source distinction, MusicBrainz relationships, and background interruption handling work. | OS-053, OS-025, OS-064 |
| OS-056 | **Build video viewer.** As a user, I want eligible open video with accessible playback. | Captions, transcript, poster, aspect ratio, quality selection, playback position, license, and original-source access work; autoplay with sound is prohibited. | OS-053, OS-025, OS-065 |
| OS-057 | **Build article, book, and research readers.** As a user, I want distraction-free reading and source-aware summaries. | Reading controls, original/translation, citations, author/date, research methods/limitations, full-text eligibility, and browser-local reading progress work. | OS-053, OS-043, OS-044 |
| OS-058 | **Build museum and 3D object viewer.** As a user, I want to inspect objects and eligible 3D assets. | Dimensions, materials, period, institution, accessible fallback media, rotate/zoom, supported formats, and performance limits work. | OS-053, OS-020 |
| OS-059 | **Build map and timeline viewers.** As a user, I want spatial and chronological exploration. | Keyboard-accessible map controls, layer attribution, geographic descriptions, event sources, time navigation, and nonvisual alternatives work. | OS-053, OS-068 |
| OS-060 | **Build dataset and visualization viewer.** As a user, I want to understand open data without first downloading a file. | Appropriate chart, clear measure/units, methodology, freshness, transformations, source/license, data table, accessible description, and download options work. | OS-053, OS-069 |
| OS-061 | **Build language and dictionary cards.** As a user, I want terms, pronunciation, transliteration, examples, etymology, and relationships. | Script rendering, language labeling, audio where eligible, transliteration conventions, source attribution, and original/translation separation work. | OS-053, OS-017, OS-008 |
| OS-062 | **Build universal provenance sheet.** As a user, I want source, creator, license, AI context, translations, and relationships in one predictable place. | Long press and visible control open the sheet; original, translated, inferred, and generated fields are visually distinct; source record is authoritative. | OS-025, OS-026, OS-053 |

### Epic J: Remaining source universe and media infrastructure

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-063 | **Integrate books and archival repositories.** As a user, I want eligible Internet Archive, Project Gutenberg, digital-library, and national-library material. | Item-level jurisdiction and license checks, OCR/text links, editions, scans, availability, and attribution normalize; unknown rights fail closed. | OS-015, OS-022 |
| OS-064 | **Integrate music knowledge and open audio.** As a user, I want music relationships plus playable eligible recordings. | MusicBrainz core data is separated from supplementary licensing; recordings come from independently verified Openverse, Commons, archive, or institutional sources. | OS-015, OS-022 |
| OS-065 | **Integrate eligible open video.** As a user, I want Commons, archives, and qualifying Creative Commons YouTube video. | YouTube queries use the Creative Commons filter, Standard License is rejected, item/source license is rechecked, captions and availability are captured. | OS-015, OS-022 |
| OS-066 | **Integrate open scholarship.** As a user, I want research discovery and transformable full text where legally allowed. | OpenAlex/DOAJ/repository metadata is distinguished from full-text rights; version and license are verified; metadata-only records cannot be summarized from restricted text. | OS-015, OS-022 |
| OS-067 | **Build institutional discovery connectors.** As a user, I want material from IIIF, OAI-PMH, SPARQL, bulk dumps, static datasets, and custom APIs. | Each connector type passes conformance tests, source-specific terms are recorded, and item-level rights flow through the same gate. | OS-015, OS-022 |
| OS-068 | **Integrate OpenStreetMap and geography.** As a user, I want open maps and geographic relationships. | ODbL attribution, tile/provider terms, place linking, layers, coordinates, and ShareAlike implications are handled. | OS-015, OS-021, OS-029 |
| OS-069 | **Integrate open government data.** As a user, I want understandable current and historical datasets. | CKAN, Socrata, ArcGIS, CSV, JSON, GeoJSON, API, and spreadsheet connectors capture schema, methodology, freshness, geography, transformations, and rights. | OS-015, OS-022 |
| OS-070 | **Build media delivery and derivative service.** As a user, I want reliable, performant media while source terms are respected. | Direct serve, embed, proxy, cache, thumbnail, transcoding, and expiration behavior are source-configurable; derivatives retain attribution and obligations. | OS-014, OS-025 |

### Epic K: Administration, source health, and coverage

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-071 | **Build role-based internal admin console.** As an administrator, I need secure staff-only access to source, rights, metadata, AI, and coverage tools. | Internal administrator identity is isolated from the consumer product; least-privilege roles, strong authentication, audit logging, filtering, saved views, and safe bulk actions work. | OS-014 |
| OS-072 | **Build source-health monitoring.** As an operator, I need connector failure visibility without collapsing the user feed. | Healthy, degraded, rate-limited, offline, auth-error, and schema-change states derive from checks; alerts, runbooks, and fallback composition work. | OS-016, OS-071 |
| OS-073 | **Build source-review and discovery queue.** As an integrations team, we need to evaluate APIs, OAI-PMH, IIIF, CKAN, SPARQL, feeds, and license metadata safely. | Candidate evidence, terms, rights patterns, technical tests, reviewer decisions, and rejection reasons persist; no source is auto-trusted. | OS-067, OS-071 |
| OS-074 | **Build coverage dashboard.** As the product team, we need to see topic, geography, language, medium, era, and local-perspective gaps. | Coverage can be filtered by Scroll/root entity and source; missing or thin dimensions are quantified without counting unverifiable candidates as coverage. | OS-014, OS-051, OS-071 |
| OS-075 | **Build metadata and duplicate review tools.** As an administrator, I need to repair malformed objects and incorrect clusters. | Reviewers can compare source records, split/merge clusters, correct mappings without rewriting source truth, and trigger reindexing with audit history. | OS-045, OS-046, OS-071 |

### Epic L: Feedback, exploration, local saves, and canonical linking

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-076 | **Implement explicit interest feedback.** As a user, I want More/Less like this, More/Less topic, Too basic, Go deeper, More surprising, Hide, and Already know this. | Actions update the Interest Graph transparently, undo works, and implicit behavior never silently overrides explicit settings. | OS-031, OS-053 |
| OS-077 | **Implement “Why this?” explanation.** As a user, I want to understand and change why an item appeared. | Root → selected topic → related topic → item → source path is one gesture away; every link is evidence-backed; feedback controls are offered in the same sheet. | OS-032, OS-049, OS-076 |
| OS-078 | **Build fractal branch exploration.** As a user, I want any discovered concept to become an exploration. | The branch sheet shows definition, relationship path, related topics, Explore now, Add to Scroll, and Create New Scroll; returning restores the exact feed position. | OS-035, OS-038, OS-053 |
| OS-079 | **Build saves and collections.** As a user, I want to save objects and organize them with full provenance. | Double tap and bookmark save with undo; collections need only a name; objects retain rights/attribution snapshots and refresh status; offline behavior is clear. | OS-010, OS-053, OS-062 |
| OS-080 | **Share canonical source-item links.** As a user, I want to send someone an existing verified-open item without publishing my own data. | Native Share and Copy Link expose only the canonical OpenScroll item/topic URL and source attribution; no Scroll settings, collection membership, history, annotations, device identifier, or user-created object is uploaded or encoded. | OS-025, OS-053 |
| OS-081 | **Build editorial Scroll templates.** As a user, I want to start from OpenScroll-curated topic recipes without receiving another user's data. | Templates are created only by authorized OpenScroll editorial staff, are clearly labeled, contain no consumer data, and copy into an independent browser-local Scroll only after confirmation. | OS-038, OS-071 |
| OS-082 | **Enforce the no-UGC boundary.** As the product owner, I need every consumer surface and API to reject user publication. | No consumer endpoint or UI accepts media, posts, prose, annotations, public collections, public Scrolls, generated exhibitions, creator profiles, or public recipe submission; security tests verify that imports remain local and cannot become hosted content. | OS-009, OS-012, OS-071 |

### Epic M: Explore, current information, source controls, and safety

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-083 | **Build editorial Explore.** As a user, I want to browse countries, periods, genres, languages, artists, places, and open discoveries without entering a query. | Sections are editorial and diverse, not popularity-only; every destination can preview or create a Scroll; sponsorship is absent or explicitly labeled. | OS-042, OS-038 |
| OS-084 | **Build current-events category.** As a user, I want current open information without weakening rights standards. | Only verified-open journalism, government releases, institutional reporting, and data enter; freshness is visible; thin coverage is stated honestly. | OS-022, OS-069, OS-050 |
| OS-085 | **Build source controls.** As a user, I want to inspect and disable repositories powering my Scroll. | Included sources, status, coverage role, and rights model are visible; disabling updates retrieval without deleting the user's topics; zero-source states are recoverable. | OS-014, OS-038, OS-048 |
| OS-086 | **Implement sensitive-content labels.** As a user, I want control over violence, nudity, racist artifacts, colonial material, medical imagery, and other sensitive records. | Labels separate source description from modern context; reveal is accessible and user-controlled; legitimate historical material is not silently erased. | OS-044, OS-053 |
| OS-087 | **Implement safety and representation preferences.** As a user, I want durable but revisable controls for sensitive categories and perspective. | Defaults are age-appropriate and jurisdiction-aware; choices persist locally and are included in optional export; emergency or illegal-content handling follows documented policy. | OS-011, OS-086 |

### Epic N: Analytics, quality, performance, security, and release

| ID | User story / ticket | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| OS-088 | **Implement privacy-preserving product analytics.** As the product team, we need to evaluate useful discovery without ad-style surveillance. | Scroll creation, intent alignment, media/source diversity, save, branch, and session-choice events use minimal payloads; users can opt out where required. | OS-012 |
| OS-089 | **Implement data-quality and rights-quality scorecards.** As operators, we need to detect attribution, license, metadata, accessibility, and broken-media failures. | Automated audits sample source and feed outputs; thresholds block release or disable a connector; correction ownership is explicit. | OS-022, OS-025, OS-072 |
| OS-090 | **Build ranking and AI evaluation suites.** As a user, I need relevance, diversity, factuality, multilingual quality, and local representation to remain trustworthy. | Curated test sets, counterfactual tests, human review, regression thresholds, and model/rule versioning cover named risks; watch-time optimization is excluded. | OS-044, OS-049, OS-051 |
| OS-091 | **Meet performance and resilience budgets.** As a user, I need a responsive Scroll despite large media and external failures. | Defined p75/p95 budgets cover first content, next-card readiness, search, topic expansion, and viewers; load, cache, backpressure, failover, and chaos tests pass. | OS-053, OS-070, OS-072 |
| OS-092 | **Complete security and abuse review.** As a user and source partner, I need local data, ingestion, canonical links, and internal administration protected. | Threat model covers IndexedDB exposure, XSS, malicious imports/media, prompt injection in source text, SSRF, supply chain, link abuse, rate abuse, privacy leaks, attempts to bypass the no-UGC boundary, and staff authentication; critical findings close. | OS-070, OS-071, OS-080, OS-082 |
| OS-093 | **Complete accessibility certification.** As a disabled user, I need the full critical path and every media viewer to be independently usable. | Automated and expert manual audits cover mobile/web, screen readers, keyboard/switch, zoom, captions, charts, reduced motion, and RTL; critical issues close. | OS-007, OS-053 through OS-062 |
| OS-094 | **Run end-to-end usability and cultural review.** As the product team, we need evidence that OpenScroll is calm, understandable, and locally representative. | First-time Morocco task, icon comprehension, provenance, rights, branching, session pause, Arabic/RTL, and local-perspective tests meet predefined success criteria. | OS-077, OS-078, OS-086, OS-093 |
| OS-095 | **Execute migration, rollback, and disaster-recovery validation.** As an operator, I need recoverable releases and preserved provenance. | Backups, point-in-time recovery, index rebuild, connector replay, rights-rule rollback, model rollback, and incident communication are rehearsed. | OS-016, OS-040, OS-072 |
| OS-096 | **Complete 1.0 release readiness.** As the sponsor, I need proof that the full charter gates are met. | Every release gate has evidence; critical tickets are accepted; source breadth is present; operational ownership, legal sign-off, support plan, and public limitations are documented. | OS-001 through OS-095 |

### Coverage map from product promise to tickets

| Product capability | Primary tickets |
| --- | --- |
| Interest → topic graph → user selection | OS-028–OS-039 |
| Multiple editable Scrolls and explicit controls | OS-031, OS-038, OS-076, OS-085 |
| Verifiably open-only corpus | OS-021–OS-027, OS-063–OS-070 |
| Broad source universe | OS-017–OS-020, OS-063–OS-069, OS-073 |
| Mixed-media feed and native viewers | OS-048–OS-062 |
| Multilingual and cross-script discovery | OS-008, OS-029, OS-036, OS-040–OS-044, OS-061 |
| Explainable recommendation and rights | OS-026, OS-062, OS-076, OS-077 |
| Fractal exploration | OS-035, OS-078 |
| Local saves and collections, canonical item links, and no UGC | OS-010–OS-012, OS-079–OS-082 |
| Search and editorial Explore | OS-042, OS-083 |
| Current information without license exceptions | OS-084 |
| No social-post or compulsion model | OS-049, OS-052, OS-088, release review |
| Cultural representation and local perspective | OS-051, OS-074, OS-087, OS-090, OS-094 |
| Safety and historical context | OS-086, OS-087 |
| Admin, rights review, health, and coverage | OS-024, OS-071–OS-075 |
| Privacy, security, quality, and release | OS-012, OS-088–OS-096 |

### Definition of 1.0 completion

OpenScroll 1.0 is complete only when OS-096 is accepted. Individual epics may be delivered incrementally behind controlled release states, but no partial subset should be described as the full OpenScroll 1.0 promised in this charter.

## 21. Account-Free Local Storage Architecture

### Product rule

OpenScroll has no consumer authentication or cloud profile. The browser and device are the boundary of personal state. The OpenScroll backend serves the verified content corpus, topic expansion, search, ranking inputs, canonical item/topic pages, and staff-created editorial templates; it does not maintain identifiable consumer profiles or host consumer-created content.

### Recommended storage allocation

| Browser capability | OpenScroll use | Rule |
| --- | --- | --- |
| IndexedDB | Scrolls, topic weights, exclusions, preferences, saves, collections, history, explicit feedback, reading/listening position, compact cached metadata | Primary local database; asynchronous, transactional, indexed, and schema-versioned |
| `localStorage` | At most a tiny boot preference such as theme, locale, or completed first-use hints | Never use for the main data model; synchronous and string-only; no sensitive data |
| Cache Storage + service worker | Application shell and a bounded cache of eligible thumbnails, transcripts, and media responses | Cache only when source rights and terms permit; version and evict with a size-aware policy |
| Storage Manager | Quota estimates and optional persistent-storage request | Request persistence only after the user creates meaningful local state; never claim it is guaranteed |

### Required reliability practices

- Treat browser storage as durable but user-controlled, not as an infallible backup. Browsers may use best-effort storage by default, and users can clear site data at any time.
- Offer **Export OpenScroll Data** as a versioned JSON file containing preferences, Scroll recipes, saves, collections, and history selected by the user.
- Offer validated **Import OpenScroll Data**, with schema migration, preview, duplicate handling, and rollback on failure.
- Show a calm first-run disclosure: **Saved on this device. Clearing browser data removes it. Export a backup anytime.**
- Ask `navigator.storage.persist()` only after the user has created or saved meaningful state, and explain that the browser decides whether to grant it.
- Use `navigator.storage.estimate()` to monitor quota and warn before large offline downloads.
- Keep full media out of IndexedDB by default. Cache only eligible, deliberately saved offline media with clear size controls and least-recently-used eviction.
- Version every local schema and test forward migrations, interrupted migrations, downgrade handling, and corruption recovery.
- Validate imported JSON strictly. Never execute imported markup, scripts, URLs, or model instructions.
- Use a strict Content Security Policy, dependency controls, output encoding, and sanitization. Browser-local data is readable by JavaScript running on the same origin, so encryption alone does not solve XSS.
- Private/incognito storage may be temporary or restricted. Detect failures and explain them without blocking scrolling.

### Experience consequences

- **No cross-device sync:** A Scroll created on a phone does not automatically appear on a laptop. Export/import is the privacy-first transfer mechanism in 1.0.
- **No recovery account:** If site data is cleared and no export exists, local preferences and saves cannot be restored.
- **No publishing:** Scrolls, collections, preferences, annotations, and generated arrangements never become hosted OpenScroll objects. Export creates a private local file only.
- **Canonical links only:** Share actions may send an existing source-item or public topic URL. They never transmit the user's local context or create a public user object.
- **No following or remixing people:** There are no consumer identities, creator profiles, public recipes, or author-update relationships. Only staff-created editorial templates may be copied locally.
- **Backend analytics remain aggregate:** The system may measure source health and aggregate product quality, but it must not reconstruct a persistent consumer profile.
