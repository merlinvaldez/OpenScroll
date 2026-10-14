# Feed baseline and release targets

Step 1 capture: October 14, 2026. The current feed behavior, licensing gate, retrieval sizes, and AI endpoints were preserved. `.env.local` selected `gpt-5.6-luna`; the code default is still `gpt-4o`. No credential or model configuration was rewritten.

## Captured evidence

- `live-baseline.json`: six representative queries, one first run and one immediate repeat each, using the actual backend orchestration and sources. A 30-second harness deadline bounds each attempt. Six attempts completed; six hit the deadline. One deadline attempt also recorded a source failure. Failed/degraded attempts are retained in the report but excluded from success-only percentile calculations.
- `frozen-current-baseline.json`: the same six terms against fixed synthetic metadata in `cases.json`, using the configured model. All 12 evaluator calls completed. This isolates evaluator latency and repeatability; it does not measure full-feed latency or relevance accuracy.
- `gpt-4o-probe.json`: two successful evaluator calls for the precise synthetic case with an explicit GPT-4o override confined to that runner process. GPT-4o was accessible; no replacement comparator was necessary.
- `captured-candidates.json`: frozen public-source metadata actually presented to the live evaluator, including candidates from attempts that later failed. No human relevance labels are collected or required.
- `standard-prices-2026-10-14.json`: USD per million input/cached-input/output tokens, verified against [OpenAI Standard pricing](https://developers.openai.com/api/docs/pricing). Estimates assume Standard processing and exclude provider-specific discounts, taxes, and infrastructure. A failed request with incomplete usage remains unknown, never $0.

The live capture overlapped local build/test work and some independent evaluator probes. Treat it as a development baseline, not an isolated production benchmark. Rerun alone with larger samples before claiming a reliable p95 or a causal improvement. The frozen file contains synthetic descriptions authored for repeatable inputs, not verified source records or ground-truth relevance judgments.

## Observations

| Successful live runs | First cohort | Immediate repeats |
| --- | ---: | ---: |
| Completed attempts / attempted | 4 / 6 | 2 / 6 |
| Attempts returning cards | 3 | 1 |
| Median full-page backend time | 14.07 s | 16.02 s |
| Sample p95 full-page backend time | 26.84 s | 24.70 s |
| Median first-card backend readiness, nonempty runs | 18.96 s | 24.70 s |
| Median source HTTP calls | 13.5 | 30 |
| Median AI calls | 2 | 2.5 |

Empty-but-successful sparse-video results are included in full-page statistics and excluded from first-card statistics. These are heterogeneous query cohorts; compare the same cases and card yields when evaluating later changes. Deadline-censored attempts are at least 30 seconds, not 30-second successful pages. The small success sample makes p95 descriptive only.

The ambiguous repeat accepted 31 candidates, retained 25, and dropped 6; the Spanish first run accepted 26 and dropped 1. These are continuation risks, not judgments about whether those candidates are truly relevant. No measured precision or recall is claimed.

First-card readiness currently equals backend completion because the route sends cards only after composition. It excludes request transport, serialization, client decoding, and browser paint. Frozen evaluator latency is roughly 2.53 seconds median in the first cohort and 2.14 seconds on repeats; it is not first-card latency. First/repeat means cold-like/warm-like application runs; no application cache exists and provider caching is not force-controlled. Cached-token usage is reported separately from the zero application-cache hit counter.

## Numerical targets for the later implementation

These are release goals selected from this baseline, not improvements already achieved:

1. Median first-card backend readiness at most 50% of the corresponding baseline nonempty cohort: **9.48 s first / 12.35 s repeat**. Also measure browser first-card paint separately when incremental streaming is implemented.
2. Median full-page backend time at most 75% of the corresponding baseline: **10.55 s first / 12.02 s repeat**. Sample p95 should not exceed **26.84 s first / 24.70 s repeat**; establish a larger quiet-run reference before treating tail timing as a release gate.
3. Reduce median source calls by at least 25%, with the same cases and no lower delivered-card yield: **at most 10 first / 22 repeat**. Median AI calls must not increase above **2 first / 2.5 repeat** without documented evidence that the extra call improves the required behavior.
4. **Zero duplicate delivered IDs, zero dropped accepted overflow, zero premature exhaustion** in controlled multi-page/retry tests. Preserve technically usable pending results between requests. The measurements alone do not fix these current defects.
5. **All six cases complete or produce a clearly recoverable partial/error state within 30 seconds**, retaining any displayed cards. A fast empty result is not an improvement if useful cards were lost. Compare deadline/failure rates alongside success-only timing.

Targets are provisional because only four nonempty live attempts succeeded. Use at least 20 repetitions per case, with first-run cohorts from separate quiet sessions where practical, for a stronger reference. Include per-case results and failures, not just aggregate medians. Deterministic tests check filtering/ranking with controlled provider responses; they do not establish real-world semantic accuracy.

## Run it yourself

From the repository root in PowerShell, with the existing ignored `.env.local`:

```powershell
npm run benchmark:feed -- --mode live --timeout-ms 30000 --rates benchmarks/feed/standard-prices-2026-10-14.json --output benchmarks/feed/live-baseline-new.json
npm run benchmark:feed -- --mode frozen --timeout-ms 15000 --rates benchmarks/feed/standard-prices-2026-10-14.json --output benchmarks/feed/frozen-baseline-new.json
node --test packages/content/test/feed-metrics.test.js packages/content/test/feed-search.test.js
```

These benchmark commands make billable API requests. `--case precise` selects one case, `--repetitions 20` increases the sample, and `--model` explicitly selects a runner-only comparator without changing application configuration. Unknown pricing/models produce null cost estimates. An aggregate with no successful runs produces null timing metrics rather than misleading zeros.

Enable `FEED_METRICS_LOG=1` locally, start `npm run dev`, search and load another page. Each compose request writes one `feed.metrics` event to the server terminal, for both JSON and NDJSON routes, including failures. The event contains only durations, counts, model IDs, and token usage. No query text, candidate contents, feedback, or credentials are logged. Public response envelopes are unchanged.

Pending counts describe the request's undelivered pool, not durable state. The original capture counted pending only after composition; on failed captured attempts inspect `retained` for accepted-but-undelivered items. Current telemetry also reports those retained items as pending on error. Retrieval overflow is always counted separately. No caches or continuation fixes were implemented in Step 1.
