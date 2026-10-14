import { readFile, writeFile } from "node:fs/promises";
import { estimateCost, summarizeRuns } from "./feed-baseline-summary.mjs";

const [reportPath, ratesPath] = process.argv.slice(2);
if (!reportPath || !ratesPath) throw new Error("Usage: node scripts/price-feed-baseline.mjs REPORT.json RATES.json");
const report = JSON.parse(await readFile(reportPath, "utf8"));
const rates = JSON.parse(await readFile(ratesPath, "utf8"));
for (const run of report.runs) if (run.metrics) run.metrics.estimatedCostUsd = estimateCost(run.metrics, rates);
report.ratesSource = ratesPath;
report.summary = summarizeRuns(report.runs);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Added standard-rate estimates to ${reportPath}; incomplete usage remains unknown.`);
