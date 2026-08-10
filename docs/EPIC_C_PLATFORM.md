# Epic C Platform Notes

Epic C implements OS-013 through OS-020 as a tested, dependency-free content platform layer.

## Ticket Coverage

| Ticket | Implementation |
| --- | --- |
| OS-013 Universal Content Object | `@openscroll/content` creates and validates canonical `uco.v1` objects with identity, content, creator, time, geography, language, knowledge, media, source, rights, ranking, system, and field-level provenance. |
| OS-014 Source Registry | Source records define connector ownership, auth mode, rate limits, content types, language/geography coverage, rights model, quality scores, refresh policy, terms, and health. |
| OS-015 Connector SDK | The connector contract requires search, fetch, normalize, extract-rights, fetch-media, resolve-entities, refresh, rate-limit, and healthcheck methods, with a conformance runner. |
| OS-016 Ingestion orchestration | Ingestion runs create deterministic jobs, retry with backoff budget, isolate source failures, write checkpoints, reject ineligible candidates, and dead-letter failed connectors. |
| OS-017 Wikimedia knowledge projects | Wikipedia, Wikidata, Wikisource, Wikivoyage, and Wiktionary fixture records normalize with language, revision/source links, attribution, entities, and open rights. |
| OS-018 Wikimedia Commons | Commons image, audio, and video fixtures normalize renditions, captions/transcript placeholders, creators, categories/entities, attribution, and verified licenses. |
| OS-019 Openverse | Openverse results are treated as candidates and rechecked against original-source rights; noncommercial or unverifiable candidates fail closed. |
| OS-020 Cultural aggregators | Smithsonian Open Access, Europeana, and DPLA fixtures normalize institution, collection, source link, media, item-level rights, and metadata-vs-media provenance. |

## Boundaries

The implementation is fixture-backed. It establishes contracts, governance, and deterministic behavior before production API credentials, scheduled workers, and staff rights-review tools are introduced in later epics.

The consumer product remains account-free and has no upload, publishing, profile, comment, or public collection surface.
