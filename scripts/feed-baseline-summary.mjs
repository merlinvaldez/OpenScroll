export function percentile(values, fraction) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  if (fraction === 0.5) {
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
}

export function summarizeRuns(runs) {
  return Object.fromEntries(["first", "repeat"].map((temperature) => {
    const matching = runs.filter((run) => run.temperature === temperature);
    const successful = matching.filter((run) => run.metrics?.status === "ok" && run.metrics.counters.sourceFailures === 0);
    const withCards = successful.filter((run) => run.metrics.counters.visible > 0);
    const values = (key) => successful.map((run) => run.metrics[key]);
    return [temperature, {
      attempts: matching.length, successful: successful.length, withCards: withCards.length,
      medianFullPageMs: percentile(values("fullPageMs"), 0.5),
      p95FullPageMs: percentile(values("fullPageMs"), 0.95),
      medianFirstCardReadyMs: percentile(withCards.map((run) => run.metrics.firstCardReadyMs), 0.5),
      p95FirstCardReadyMs: percentile(withCards.map((run) => run.metrics.firstCardReadyMs), 0.95),
      medianSourceCalls: percentile(successful.map((run) => run.metrics.counters.sourceCalls), 0.5),
      medianAiCalls: percentile(successful.map((run) => run.metrics.counters.aiCalls), 0.5),
      medianEvaluationMs: percentile(successful.map((run) => run.metrics.phasesMs?.evaluation), 0.5)
    }];
  }));
}

export function estimateCost(metrics, rates) {
  if (!rates || metrics.status !== "ok" || metrics.usage.responsesWithUsage !== metrics.counters.aiCalls || !metrics.models.length) return null;
  if (!metrics.models.every((model) => rates[model])) return null;
  // A run must use one price schedule; mixed-model runs need per-call accounting.
  if (metrics.models.length !== 1) return null;
  const rate = rates[metrics.models[0]];
  if (![rate.input, rate.cachedInput, rate.output].every((value) => Number.isFinite(value) && value >= 0)) return null;
  const usage = metrics.usage;
  return ((usage.promptTokens - usage.cachedPromptTokens) * rate.input + usage.cachedPromptTokens * rate.cachedInput + usage.completionTokens * rate.output) / 1e6;
}
