# Desired user behavior

People enter a term, choose media types, and receive relevant cards quickly. The first useful cards appear while additional results are still being retrieved. Scrolling continues without repeated cards, skipped accepted results, or an unexpected end caused by a temporary source failure.

For example, a search for "Gnawa music Morocco" should favor actual Gnawa performances and explanations, rather than general Moroccan street photographs. Stronger matches appear earlier within the available media types while the feed still mixes images, text, audio, video, and data.

Licensing is no longer an OpenScroll eligibility requirement. Items do not need license metadata to enter the feed, be saved, be exported, or use available media actions. Remove license filtering, rights passports, licensing review, license badges, "Why open?" explanations, and license-dependent download restrictions. Keep source links, creator information when available, original-versus-generated labels, and technical availability checks as ordinary provenance. The app must not replace removed checks with invented permission or "verified open" claims.

Topic interpretation and generated topic data use `gpt-6-luna` through the Responses API. Relevance uses `gpt-6-luna` through the Decisions API. No active AI path defaults or silently falls back to GPT-4o, Jev, a different model, or fixture content.

Loading, empty, and error behavior:

- Show planning, retrieval, and evaluation progress until the first cards arrive; continue loading unobtrusively afterward.
- Keep displayed cards and the current scroll position when a source or evaluator fails later.
- Offer Retry when unfinished work fails. A failed request, work deadline, or empty intermediate batch does not mean "End of feed."
- Declare the end only when all relevant source searches are exhausted and no accepted cards remain pending.
- An initial search with no matches and genuinely exhausted sources shows an empty state with a way to revise the term or media types.
- An expired continuation offers to restart the search, without discarding saved items.
- Saved items and exported/imported local data from the previous version remain readable after licensing removal.

## Scope and decisions

Status: Step 1 implemented on October 14, 2026; later implementation steps remain unchecked. Created October 14, 2026.

This incorporates the preceding backend recommendations, with the user's licensing removal replacing the earlier recommendation to improve license normalization. Include relevance ranking within media buckets as part of "everything recommended." Retain mixed-media exploration and deterministic ordering for a search session. Feedback remains explicit and local; broad learned preference modeling is not required by this change.

Existing sources remain in scope. Removing licensing does not itself add new repositories, paid-content access, or a new download/proxy service. Available direct media/source actions depend on technical availability, not license classifications.

The new requirements supersede the older rights-first product rules in `docs/PROJECT_CHARTER.md`, `docs/OPENSCROLL_SPEC_V1.md`, and `docs/EPIC_D_RIGHTS.md`. Update these during implementation so future work does not restore the removed requirements.

Current code dependencies:

- Root `app/api/feed/compose/route.js` and `apps/web/src/app/api/feed/compose/route.js` are mirrored entry points; keep behavior synchronized.
- `packages/content/src/feed-search.js` currently targets 25 passing candidates, retrieves 5 candidates per media-type/variant pair, and allows 20 rounds. Passing count precedes composition filtering.
- `source-connectors.js` currently returns arrays, advances using offsets, loses upstream continuation, and turns source failures into empty results. Wikipedia summary requests run sequentially.
- `topic-engine.js` currently shares a Chat Completions JSON helper for interpretation and relevance, with a GPT-4o default.
- Rights are embedded in content normalization, connector conformance, ingestion, source registry, schemas, fixtures, UI, and local saves. Removing only the composer gate is insufficient.
- Current streaming sends progress and one final result, not incremental cards.

## Verified OpenAI guidance

Checked official documentation on October 14, 2026:

- [Decisions guide](https://developers.openai.com/api/docs/guides/decisions): public beta; dedicated `POST /v1/decisions`; currently supports only `gpt-6-luna`. Inputs are text and/or images. Named questions return named typed answers. Predicates return probabilities from 0 to 1. Decisions is suitable for passage relevance and classification, not generating arbitrary objects or written explanations.
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna): efficient model for focused, high-volume tasks; Responses and Structured Outputs supported. Use low/none reasoning only where the selected endpoint supports it and benchmark the result.
- [Deprecations](https://developers.openai.com/api/docs/deprecations): GPT-4o August/November 2024 snapshots are scheduled to shut down January 14, 2027, with `gpt-6-luna` recommended. The older May 2024 snapshot shuts down October 23, 2026. Do not treat every GPT-4o snapshot as sharing one shutdown date.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): use a supported strict schema for Responses-based topic interpretation and expansion; retain application-level validation.

The Decisions guide advertises roughly 10x faster evaluation than Responses. That is provider guidance, not a measured OpenScroll speedup. Actual project access, rate limits, SDK support, thresholds, and latency require verification during implementation. The guide specifies JavaScript SDK 7.30.0 or later for its examples; direct HTTP is also documented. If using images later, Decisions currently requires inline base64 data URLs rather than hosted URLs or file IDs. Initial relevance evaluation remains metadata-based; audio/video understanding is not claimed.

# Implementation steps

## 1. Establish a baseline and success criteria

Outcome: measure whether changes make useful results faster and more accurate.

- [x] Read repository instructions and the relevant installed Next.js guides before editing routes, caching, or streaming.
- [x] Add phase timings and counters around planning, retrieval, evaluation, and composition. Include source calls, raw results, normalized candidates, duplicates, accepted/rejected/pending items, failures, cache hits, and final visible cards.
- [x] Record first-card time, full-page time, source/AI call counts, and request cost where available. Separate cold and warm cache runs and compare median and slow-tail latency.
- [x] Capture the baseline before changing the provider. If GPT-4o is unavailable, record that limitation and use a frozen candidate set with a documented accessible comparator.
- [x] Choose and record numerical release targets from the baseline: faster first-card and page latency, fewer unnecessary calls, and no regression in continuation correctness. Do not invent existing measurements or claim measured relevance precision/recall without a labeled evaluation set. A human-labeling workflow is not required.

Step 1 evidence: [baseline report, limitations, targets, and commands](../benchmarks/feed/README.md). The configured provider was `gpt-5.6-luna`; an explicit GPT-4o probe also succeeded. Six of 12 live attempts completed within the harness's 30-second deadline. First-card measurements are backend readiness, not browser paint. First/repeat cohorts do not force provider cache state. Performance targets are provisional because the successful sample is small. Application behavior, licensing requirements, and provider defaults remain unchanged until subsequent steps.

## 2. Remove licensing across contracts and backend

Outcome: usable source items normalize and enter the feed without licensing data.

- [ ] Update `content-object.js`, `source-registry.js`, and `packages/contracts/src/schemas.js` to remove mandatory rights/rightsModel fields, rights-derived eligibility, and licensing provenance. Version changed public contracts rather than silently redefining `uco.v1`.
- [ ] Preserve identity, canonical source URL, creator, content, language, media, capture time, and original/generated provenance independently of rights.
- [ ] Remove `extractRights` as a required connector method and licensing gates/review queues from `connector-sdk.js` and `ingestion.js`. Update conformance tests and connector contract versions.
- [ ] Remove the license gate from `feed-composer.js` and rights-dependent filtering from sample construction, item/article routes, and any other retrieval path. Keep valid-record, availability, media-type, explicit hide, and relevance checks.
- [ ] Remove fabricated default licenses, permission flags, license parsing, rights verification, download policies, and mandatory attribution bundles from live connectors. Retrieve only metadata still needed for provenance or relevance.
- [ ] Remove obsolete active exports, schemas, fixtures, events, review helpers, and tests in `rights.js`, content/contracts indexes, and related files after checking their consumers. Historical documentation may describe past behavior but must be marked superseded.
- [ ] Migrate old saved records and exports without losing IDs, collections, source links, playback state, or user feedback. Legacy rights fields may be accepted on import for compatibility, but must not be required, displayed as guarantees, or used for eligibility.

## 3. Fix source continuation and failure reporting

Outcome: filtering and timeouts cannot masquerade as source exhaustion.

- [ ] Change source results to a validated batch contract containing items, upstream continuation, exhausted state, source/query identity, and explicit failure information. Preserve raw source counts for diagnostics.
- [ ] Follow MediaWiki continuation, including generator/property continuation where applicable. Advance from source-provided state rather than normalized candidate count.
- [ ] Distinguish empty successful pages, exhausted sources, malformed responses, rate limits, and retryable failures. Keep failed continuation positions retryable.
- [ ] Propagate abort signals and configurable source/AI timeouts. Keep deadlines active through response-body reading and clean up timers in all paths.
- [ ] Replace normalization's catch-and-return-raw behavior with explicit invalid-record handling; one malformed item should not silently violate the content contract.
- [ ] Add bounded retries for transient failures, honoring rate-limit guidance and the total request deadline. Never substitute fixtures or a different AI model on failure.

## 4. Preserve complete feed state between requests

Outcome: accepted results survive page boundaries and retries.

- [ ] Define a versioned continuation that binds the normalized query, chosen topic meaning, media types, sources, seed, plan version, and evaluation configuration.
- [ ] Retain per-search upstream continuation, permanently exhausted pairs, candidate metadata/decision cache references, seen IDs, delivered IDs, and pending accepted overflow.
- [ ] Use opaque server-validated continuation with a shared TTL store suitable for separate server instances. Choose and document the store and expiry during implementation; do not rely on process memory or expose unbounded state in browser requests. Add deterministic setup/migration commands if a datastore is introduced.
- [ ] Make delivery/retry acknowledgments idempotent: replaying an interrupted batch must not lose or duplicate cards. Avoid advancing committed delivery state before the client can recover the batch.
- [ ] Compose from pending accepted items first, retaining the remainder. Refill toward requested visible page size after normalization, deduplication, and feedback exclusions.
- [ ] Separate page position within a retained pool from new source retrieval. A nonzero cursor must not slice unrelated newly retrieved candidates.
- [ ] Validate page sizes, query lengths, continuation size, and request budgets. Persist exhaustion instead of restarting empty searches on every page.

## 5. Replace GPT-4o and introduce Decisions relevance

Outcome: generation uses Responses; evaluation returns validated relevance probabilities.

- [ ] Separate the generation and decision adapters in `topic-engine.js` or focused modules. Default generation and decisions to `gpt-6-luna`; expose distinct server-side configuration and prohibit unsupported Decisions models.
- [ ] Migrate `resolveEntity`, topic expansion, and remaining generation callers to Responses with strict Structured Outputs. Validate label, description, aliases, categories, unique identifiers, refusals, and incomplete responses. Benchmark supported low/none reasoning settings.
- [ ] Implement `POST /v1/decisions` with `model`, shared `input`, and `questions`. Use one named predicate per candidate in a bounded batch, asking whether that identified candidate is meaningfully about the chosen topic. Include original query, resolved meaning, candidate IDs, titles, descriptions, and useful source evidence; retrieval strategy is context, not proof.
- [ ] Map answers by unique question name, not response position. Require every expected answer exactly once, the expected type, and a finite probability between 0 and 1. Handle missing, duplicate, unknown, malformed, refused, and failed answers explicitly.
- [ ] Treat failures/refusals as unevaluated, not relevant or permanently irrelevant. Keep them retryable within a bounded budget and surface partial failure honestly.
- [ ] Make the acceptance threshold configurable and store model/prompt/threshold versions with decisions. Test multi-question batches for candidate isolation, answer mapping, and predictable handling of missing evidence; compare speed and cost with smaller batches. Document that the threshold is not calibrated against human labels.
- [ ] Preserve probabilities for ranking. Do not label them guaranteed confidence or retain the old generated-reason contract as though Decisions supplies free-form reasons.
- [ ] Retain source evidence and decision provenance for explanations. If a generated explanation is needed, request it on demand through Responses against actual evidence and cache it; do not add an explanation-generation call for every card.
- [ ] Keep metadata-only evaluation as the initial behavior. Optional image evaluation requires its own latency/accuracy benchmark and supported image input handling; no implied audio/video verification.
- [ ] Verify project access with a small live request during implementation. If beta access is unavailable, report that dependency explicitly without substituting another relevance API.

## 6. Reduce retrieval and evaluation work

Outcome: spend the request budget on searches likely to return new useful items.

- [ ] Start with original/canonical variants and add title/alias variants only when needed. Use source-appropriate plans for Commons versus Wikipedia. Preserve staged activation across continuation.
- [ ] Fetch Wikipedia summaries concurrently with a bounded per-source worker pool. Avoid the all-queries barrier: process completed batches while slower searches remain pending, subject to stable delivery and diversity rules.
- [ ] Introduce configurable candidate, time, concurrency, and round budgets. Budget exhaustion returns resumable work, not permanent exhaustion. Prioritize underrepresented selected media types without waiting indefinitely for scarce types.
- [ ] Compare retrieval sizes 5, 10, and 15 only after overflow preservation. Set the default from evidence rather than simply increasing the existing constant.
- [ ] Deduplicate by stable source identity before AI calls, preserving distinct works that share titles. Use deliberate canonical clustering rather than truncated-title equality alone.
- [ ] Cache normalized interpretations, source metadata, and relevance decisions with bounded storage, TTLs, and in-flight request coalescing. Keys include topic meaning, language, source parameters, candidate metadata version, and model/prompt versions as appropriate.
- [ ] Apply current local feedback after shared caching. Do not put private feedback, saves, or personalized feed responses in a shared content cache.
- [ ] Defer thumbnails and display-only enrichment until acceptance where feasible. Keep descriptions/categories needed by the judge and creator/source metadata needed for provenance; remove licensing-only metadata requests.
- [ ] Prefetch the next small batch near the end of displayed cards; cancel stale searches/prefetches and ignore late results from a previous query.

## 7. Rank strong matches while retaining variety

Outcome: relevance affects visible order without eliminating mixed-media discovery.

- [ ] Rank accepted items within media buckets using calibrated relevance probability, completeness, quality, and explicit item feedback. Retain seeded tie-breaking and media/source diversity when alternatives exist.
- [ ] Define stable append-only delivered order: newly discovered results must not reshuffle already displayed cards. Prioritize among ready items without letting a scarce media type stall the feed.
- [ ] Keep hide/less/more feedback effective and clearly distinguish exact-item scoring from future topic-level personalization. Do not introduce inferred broad preferences in this change.
- [ ] Pass one topic interpretation consistently through retrieval and evaluation. For ambiguous input, show the chosen meaning with a way to refine it; only require clarification when the interpretation cannot be resolved usefully.

## 8. Stream useful cards and remove licensing UI

Outcome: users can browse before the full request finishes, with source transparency instead of license controls.

- [ ] Version the NDJSON protocol with progress, accepted-item batches, recoverable error information, and final completion/continuation. Define IDs/acknowledgments so streamed cards also present in a final response cannot be appended twice.
- [ ] Update both compose routes and `readFeedResponse`/search/load-more handlers in `open-scroll-app.js` together. Handle split lines, multiple lines per chunk, malformed/truncated streams, and non-stream JSON consistently.
- [ ] Display small accepted batches immediately. Keep existing cards on partial failure; show retry without declaring the feed exhausted. Reject stale request results and avoid concurrent duplicate load-more calls.
- [ ] Propagate browser cancellation through server orchestration and upstream calls; stop enqueueing after disconnect and clean up stream/controller resources.
- [ ] Replace `WhyOpenSheet` and license controls with ordinary source details in `sheets.js` and `media-cards.js`. Remove license/rights fields and invented defaults from `transformUcoToCard`, reader/viewer badges, captions, saves, imports/exports, and settings.
- [ ] Remove license-based download gating. Show technically available source/media actions with neutral labels, preserving original source access and local-data export.
- [ ] Update English, Spanish, and Arabic strings, RTL/accessibility labels, styles, and public claims such as "verifiably open" wherever they rely on the removed guarantee. Keep OpenScroll's name.

## 9. Align docs, configuration, and release checks

Outcome: a future developer can run the new flow without restoring obsolete requirements.

- [ ] Update README, environment examples, architecture/contracts documentation, charter, original spec, and Epic D status to the new discovery/provenance scope, model defaults, Decisions beta dependency, state/cache setup, and stream protocol.
- [ ] Document configurable deadlines, retry limits, staged search budgets, cache TTLs, threshold versions, and behavior on access failure. All API credentials remain server-side.
- [ ] Add focused mocked tests for each changed contract and meaningful integration checks. Replace permissive live tests that succeed on empty arrays with explicit verified-success or clearly reported unavailable integration checks.
- [ ] Run `npm test`, `npm run test:contracts`, `npm run lint`, and `npm run build`; perform relevant browser/a11y checks. Distinguish mock coverage from live provider/source verification.
- [ ] Compare performance baseline and latency results against step 1 targets. Record evidence, remaining limitations, and regression results before calling the implementation complete. Do not require a human-labeled benchmark or human review.

# How to check it works

- [ ] Search Gnawa music: cards appear early and source links work. Verify the evaluator instructions require meaningful relevance and reject generic country associations; do not present this instruction check as measured relevance accuracy.
- [ ] Search an ambiguous term and refine its meaning: retrieval and Decisions use the same interpretation; late results from the original search do not appear.
- [ ] Select each media type and a mixed selection: scarce audio/video does not block available cards; no placeholder content is substituted.
- [ ] Scroll through multiple pages, including a source page whose records are filtered: no duplicate displayed IDs, skipped accepted overflow, or premature exhaustion.
- [ ] Disconnect mid-stream and retry: displayed cards remain, pending cards are recoverable, and batches are not delivered twice.
- [ ] Simulate source timeout, 429, malformed response, and evaluator refusal/failure: retry remains available, continuation stays recoverable, and unevaluated items are not displayed as accepted.
- [ ] Hit a request budget with zero accepted cards but more upstream results: show resumable search rather than final end-of-feed. Exhaust all searches and pending cards: show the actual end once.
- [ ] Load an item with absent or formerly incompatible license metadata: it can normalize, enter the feed, be saved, and use technically available media actions without rights fields or license UI.
- [ ] Import old saved data: IDs, collections, feedback, and source links survive; obsolete licensing claims do not reappear.
- [ ] Warm caches and repeat identical searches: fewer retrieval/evaluation calls; metadata/model/prompt changes invalidate affected decisions; feedback from one browser does not affect another.
- [ ] Verify relevance-ranked media buckets and stable delivered order with a fixed seed; controlled decision responses produce the expected filtering and ranking.
- [ ] Confirm live relevance calls use `/v1/decisions` and `gpt-6-luna`; generation uses Responses with the documented schema. No active GPT-4o default or silent fallback remains.
- [ ] Check desktop/mobile, keyboard interaction, screen-reader loading/error announcements, and English/Spanish/Arabic views. Licensing controls and claims are absent throughout.
- [ ] Review first-card/full-page timing and source/AI calls against the baseline; report measured improvements rather than repeating the provider's advertised speedup.
