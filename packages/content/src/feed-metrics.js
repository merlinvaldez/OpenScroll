// Request-local diagnostics. Never include search text, source payloads, or credentials.
export function createFeedMetrics({ now = () => performance.now(), onCandidates } = {}) {
  const started = now();
  const phases = { planning: 0, retrieval: 0, evaluation: 0, composition: 0 };
  const counters = {
    sourceCalls: 0, sourceFailures: 0, rawResults: 0, normalizedCandidates: 0,
    normalizationFailures: 0, duplicates: 0, invalidCandidates: 0,
    evaluated: 0, accepted: 0, rejected: 0, retained: 0, droppedAccepted: 0,
    pending: 0, compositionExcluded: 0, visible: 0, rounds: 0,
    aiCalls: 0, aiFailures: 0, pipelineFailures: 0, cacheHits: 0, planReuses: 0
  };
  const usage = { promptTokens: 0, completionTokens: 0, cachedPromptTokens: 0, responsesWithUsage: 0 };
  const models = new Set();
  return {
    increment(name, amount = 1) {
      if (Object.hasOwn(counters, name)) counters[name] += amount;
    },
    set(name, value) {
      if (Object.hasOwn(counters, name)) counters[name] = value;
    },
    async measure(phase, operation) {
      const start = now();
      try { return await operation(); }
      finally { phases[phase] += now() - start; }
    },
    addUsage(payload, requestedModel) {
      models.add(payload?.model || requestedModel);
      if (!payload?.usage) return;
      usage.responsesWithUsage += 1;
      usage.promptTokens += payload.usage.prompt_tokens || 0;
      usage.completionTokens += payload.usage.completion_tokens || 0;
      usage.cachedPromptTokens += payload.usage.prompt_tokens_details?.cached_tokens || 0;
    },
    capture(candidates) { try { onCandidates?.(candidates); } catch { /* observer failure is isolated */ } },
    snapshot(status = "ok") {
      const fullPageMs = now() - started;
      return {
        version: "feed-metrics.v1", status,
        phasesMs: Object.fromEntries(Object.entries(phases).map(([key, value]) => [key, Math.round(value * 100) / 100])),
        fullPageMs: Math.round(fullPageMs * 100) / 100,
        firstCardReadyMs: status === "ok" && counters.visible > 0 ? Math.round(fullPageMs * 100) / 100 : null,
        counters: { ...counters }, usage: { ...usage }, models: [...models],
        estimatedCostUsd: null,
        notes: {
          firstCard: "Backend readiness, not browser paint; current feed delivers cards only at completion.",
          pending: "Undelivered accepted pool at snapshot time; not durable continuation. Retrieval overflow is counted separately.",
          cache: "No application cache exists; plan reuse and provider cached tokens are separate counters.",
          cost: "Unknown without an explicitly supplied model price; tokens are recorded when provided."
        }
      };
    }
  };
}

// Instrumentation callbacks must not change feed success/error behavior.
export function reportFeedMetrics(onMetrics, metrics, status) {
  try { onMetrics?.(metrics.snapshot(status)); } catch { /* observer failure is isolated */ }
}
