import { readFileSync } from "node:fs";
import { resolveEntity, expandTopics, evaluateFeedCandidates } from "../packages/content/src/topic-engine.js";
import { createFeedMetrics } from "../packages/content/src/feed-metrics.js";

try {
  const env = readFileSync(".env.local", "utf8");
  const keyMatch = env.match(/OPENAI_API_KEY=([^\r\n]+)/);
  if (keyMatch) process.env.OPENAI_API_KEY = keyMatch[1].trim();
} catch {}

if (!process.env.OPENAI_API_KEY?.trim()) {
  console.log("Skipping live benchmark: OPENAI_API_KEY is not set.");
  process.exit(0);
}

console.log("=== Step 5 Benchmark: Responses Reasoning Settings & Decisions Batch Sizes ===");

async function benchmarkResponsesReasoning() {
  console.log("\n--- 1. Responses API: Comparing Reasoning Settings (none vs low) ---");
  for (const effort of ["none", "low"]) {
    const start = performance.now();
    try {
      const entity = await resolveEntity("Gnawa music Morocco", { reasoningEffort: effort });
      const durationMs = Math.round(performance.now() - start);
      console.log(`[reasoningEffort: ${effort.padEnd(4)}] Resolved: "${entity.label}" in ${durationMs}ms`);
    } catch (err) {
      console.log(`[reasoningEffort: ${effort.padEnd(4)}] Failed: ${err.message}`);
    }
  }
}

async function benchmarkDecisionsBatchSizes() {
  console.log("\n--- 2. Decisions API: Comparing Batch Sizes (2, 5, 10 candidates) ---");
  const sampleCandidates = [
    { id: "c1", title: "Gnawa musicians in Essaouira", description: "Lila healing ceremony performance.", source: { name: "Wikimedia Commons" } },
    { id: "c2", title: "Krakebs iron castanets", description: "Traditional idiophone instrument used in Gnawa music.", source: { name: "Wikimedia Commons" } },
    { id: "c3", title: "Guembri three-stringed lute", description: "Plucked lute used in Moroccan Gnawa ceremonies.", source: { name: "Wikimedia Commons" } },
    { id: "c4", title: "Essaouira Gnaoua and World Music Festival", description: "Annual world music celebration in Morocco.", source: { name: "Wikipedia" } },
    { id: "c5", title: "Moroccan couscous dish", description: "Semolina dish with steamed vegetables.", source: { name: "Wikimedia Commons" } },
    { id: "c6", title: "Marrakech Medina market alley", description: "Cobblestone street with textile vendors.", source: { name: "Wikimedia Commons" } },
    { id: "c7", title: "Maalem Mahmoud Guinia recording", description: "Influential Gnawa master musician album.", source: { name: "Wikimedia Commons" } },
    { id: "c8", title: "Atlas Mountains peak", description: "Snowy landscape in High Atlas.", source: { name: "Wikimedia Commons" } },
    { id: "c9", title: "Gnawa ritual trance dance", description: "Spiritual dance movements in Moroccan culture.", source: { name: "Wikimedia Commons" } },
    { id: "c10", title: "Casablanca airport terminal", description: "Modern passenger airport architecture.", source: { name: "Wikimedia Commons" } }
  ];

  for (const size of [2, 5, 10]) {
    const subset = sampleCandidates.slice(0, size);
    const metrics = createFeedMetrics();
    const start = performance.now();
    try {
      const result = await evaluateFeedCandidates("Gnawa music Morocco", subset, {
        metrics,
        topicMeaning: { label: "Gnawa music", description: "Moroccan spiritual music tradition" }
      });
      const durationMs = Math.round(performance.now() - start);
      const snapshot = metrics.snapshot();
      const inputTokens = snapshot.usage.promptTokens;
      // Decisions API with gpt-6-luna is $0.10 per 1M tokens ($0.0000001 per token)
      const costUsd = ((inputTokens * 0.10) / 1000000).toFixed(6);
      const acceptedCount = result.accepted.length;
      console.log(`[Batch size: ${String(size).padStart(2)}] Duration: ${durationMs}ms | Accepted: ${acceptedCount}/${size} | Input tokens: ${inputTokens} | Cost: $${costUsd}`);
      for (const cand of result.accepted) {
        console.log(`   + Accepted: "${cand.title}" (prob: ${cand.decision?.probability})`);
      }
    } catch (err) {
      console.log(`[Batch size: ${String(size).padStart(2)}] Failed: ${err.message}`);
    }
  }
}

await benchmarkResponsesReasoning();
await benchmarkDecisionsBatchSizes();
console.log("\n=== Benchmark Completed Successfully ===");

