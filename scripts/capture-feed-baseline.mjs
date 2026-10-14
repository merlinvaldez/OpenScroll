import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { composeSearchFeed } from "../packages/content/src/feed-search.js";
import { evaluateFeedCandidates } from "../packages/content/src/topic-engine.js";
import { createFeedMetrics } from "../packages/content/src/feed-metrics.js";
import { summarizeRuns, estimateCost } from "./feed-baseline-summary.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const mode = option("--mode", "live");
const repetitions = Number(option("--repetitions", "2"));
const timeoutMs = Number(option("--timeout-ms", "45000"));
if (!["live", "frozen"].includes(mode) || !Number.isInteger(repetitions) || repetitions < 2 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Use --mode live|frozen, --repetitions >= 2 and a positive --timeout-ms.");
try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required; no secret values are printed.");
const model = option("--model", process.env.OPENAI_MODEL || "gpt-4o");
process.env.OPENAI_MODEL = model;
const allCases = JSON.parse(await readFile(new URL("../benchmarks/feed/cases.json", import.meta.url)));
const caseId = option("--case", null);
const cases = caseId ? allCases.filter((scenario) => scenario.id === caseId) : allCases;
if (!cases.length) throw new Error("Unknown --case ID.");
const ratesPath = option("--rates", null);
const rates = ratesPath ? JSON.parse(await readFile(ratesPath)) : null;
const output = option("--output", `benchmarks/feed/${mode}-baseline.json`);
const originalFetch = globalThis.fetch;
const runs = [];
const frozen = new Map();
for (const scenario of cases) {
  for (let index = 0; index < repetitions; index += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let metrics;
    globalThis.fetch = (url, init = {}) => originalFetch(url, {
      ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
    });
    const run = { caseId: scenario.id, temperature: index === 0 ? "first" : "repeat", repetition: index + 1 };
    try {
      if (mode === "live") {
        const data = await composeSearchFeed({ interest: scenario.term, mediaTypes: scenario.mediaTypes, seed: 1729, pageSize: 25 }, {
          onMetrics: (value) => { metrics = value; },
          onCandidates: (items) => {
            for (const item of items) frozen.set(`${scenario.id}:${item.id}`, {
              caseId: scenario.id,
              candidate: {
                id: item.id,
                content: { title: item.content?.title, description: item.content?.description },
                knowledge: { topics: item.knowledge?.topics, retrieval: item.knowledge?.retrieval },
                source: { id: item.source?.id, name: item.source?.name },
                identity: { sourceRecordUrl: item.identity?.sourceRecordUrl },
                media: { kind: item.media?.kind }
              }
            });
          }
        });
        run.visibleIds = data.items.map((item) => item.id);
        run.sourceHasMore = data.sourceHasMore;
      } else {
        const observer = createFeedMetrics();
        try {
          const candidates = scenario.candidates;
          const result = await observer.measure("evaluation", () => evaluateFeedCandidates(scenario.term, candidates, { model, metrics: observer }));
          observer.increment("evaluated", candidates.length);
          observer.increment("accepted", result.accepted.length);
          observer.increment("rejected", candidates.length - result.accepted.length);
          metrics = observer.snapshot();
          run.acceptedIds = result.accepted.map((candidate) => candidate.id);
        } catch (error) { metrics = observer.snapshot("error"); throw error; }
      }
    } catch (error) {
      // Provider error bodies can contain request data: record safe classifications only.
      run.error = { name: error.name, status: error.status || null, deadlineExceeded: controller.signal.aborted };
    } finally {
      clearTimeout(timer);
      globalThis.fetch = originalFetch;
    }
    run.metrics = metrics;
    if (metrics) metrics.estimatedCostUsd = estimateCost(metrics, rates);
    runs.push(run);
    console.log(JSON.stringify({ caseId: run.caseId, temperature: run.temperature, status: metrics?.status || "error", durationMs: metrics?.fullPageMs, sourceFailures: metrics?.counters.sourceFailures }));
  }
}
const report = {
  version: "feed-baseline.v1", capturedAt: new Date().toISOString(),
  gitHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  model, mode, timeoutMs, repetitions, runs, summary: summarizeRuns(runs), ratesSource: ratesPath,
  limitations: [
    "First/repeat are cold-like/warm-like cohorts, not forced provider cache states; no application cache exists.",
    "Small samples: nearest-rank p95 is descriptive, not a statistically reliable production tail.",
    "Direct backend timing excludes HTTP transport, browser decoding and paint.",
    "Frozen mode measures only evaluator latency and consistency on synthetic unlabelled candidates, not relevance accuracy or full-feed latency.",
    "Costs remain unknown unless complete token usage and an explicit model price schedule are supplied."
  ]
};
await mkdir(new URL("../benchmarks/feed/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (mode === "live") await writeFile("benchmarks/feed/captured-candidates.json", `${JSON.stringify([...frozen.values()], null, 2)}\n`, "utf8");
console.log(`Saved ${output}`);
