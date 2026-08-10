# Epic E Graph Notes

Epic E implements OS-028 through OS-032 as the Knowledge Graph, Entity Resolution, Content Graph, Interest Graph, and graph relationship API layer for OpenScroll.

## Ticket Coverage

| Ticket | Implementation |
| --- | --- |
| OS-028 Foundational Knowledge Graph ingestion | `@openscroll/content` exposes `ingestKnowledgeGraph`, `createSeedKnowledgeGraph`, and `createWikidataClient`. The ingestion path supports deterministic fixtures for tests and live Wikidata reads through injectable `fetch`. |
| OS-029 Entity resolution | `resolveEntity` and `resolveEntityOrRoot` normalize labels, aliases, diacritics, Arabic text, multilingual labels, and Wikidata IDs into canonical graph entities with `resolved`, `ambiguous`, `fallback-root`, and `not-found` states. |
| OS-030 Content Graph | `createContentGraph` links accepted Universal Content Objects to entities, topics, places, sources, media kinds, languages, and collections. |
| OS-031 Interest Graph | `createInterestGraph` stores the user's explicit root interest, selected branches, exclusions, weights, media/source/language settings, traversal depth, and surprise level as browser-local graph state. |
| OS-032 Graph relationship APIs | `createGraphRelationshipApi`, `topicBranchesForInterest`, `rankContentForInterest`, `explainContentMatch`, and `traverseGraph` provide topic expansion, ranked matches, graph paths, and explanation text for the UI. |

## API Boundary

Epic E is API-ready and testable without secrets.

The live Wikidata client uses:

```env
OPENSCROLL_USER_AGENT="OpenScroll/1.0 (contact: contact@example.com)"
OPENSCROLL_CONTACT_EMAIL="contact@example.com"
```

For compatibility with earlier naming, the client also accepts `OPENSCR0LL_USER_AGENT` and `OPENSCR0LL_CONTACT_EMAIL`.

The client wraps Wikidata `wbsearchentities`, `wbgetentities`, and SPARQL relationship reads. Tests inject a fake `fetch` implementation, so CI does not call external APIs and does not require API keys.

## Product Behavior

The topic-selection screen now comes from graph branches instead of a hardcoded topic list. Feed details include:

- resolved root entity
- graph path
- graph-based reason an item appears
- source, creator, license, attribution, rights explanation, and download rule

Local Scroll records preserve an Interest Graph snapshot. Saved items preserve a lightweight graph match snapshot alongside the rights passport snapshot.
