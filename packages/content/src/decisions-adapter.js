import { cleanString, unique } from "./utils.js";
import { abortError, fetchJsonWithRetry, getRequestBudgetConfig, isAbortError } from "./source-batch.js";
import { OpenAIConfigurationError, OpenAIRequestError, requestOpenAIStructuredOutput } from "./generation-adapter.js";

export const OPENAI_DECISIONS_URL = "https://api.openai.com/v1/decisions";
export const DEFAULT_DECISIONS_MODEL = "gpt-6-luna";
export const SUPPORTED_DECISIONS_MODELS = Object.freeze(["gpt-6-luna"]);
export const DEFAULT_DECISION_THRESHOLD = 0.7;
export const DECISIONS_PROMPT_VERSION = "decisions-predicate.v1";
export const DECISION_VERSION = "decisions.v1";
export const MAX_DECISIONS_BATCH_SIZE = 15;

export class UnsupportedDecisionsModelError extends Error {
  constructor(model) {
    super(`The Decisions API currently only supports 'gpt-6-luna'. Unsupported model: '${model}'.`);
    this.name = "UnsupportedDecisionsModelError";
    this.status = 400;
    this.code = "UNSUPPORTED_DECISIONS_MODEL";
  }
}

export function getDecisionsConfig(options = {}) {
  const apiKey = options.apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "");
  const model = options.model || (typeof process !== "undefined" ? process.env?.OPENAI_DECISIONS_MODEL : "") || DEFAULT_DECISIONS_MODEL;

  if (!apiKey || !apiKey.trim()) {
    throw new OpenAIConfigurationError("OPENAI_API_KEY is required for OpenScroll Decisions evaluation.");
  }

  const cleanModel = model.trim();
  if (!SUPPORTED_DECISIONS_MODELS.includes(cleanModel)) {
    throw new UnsupportedDecisionsModelError(cleanModel);
  }

  let threshold = options.threshold ?? options.evalConfig?.threshold;
  if (threshold === undefined || threshold === null) {
    const envThreshold = typeof process !== "undefined" ? process.env?.OPENAI_DECISION_THRESHOLD : undefined;
    threshold = envThreshold !== undefined && envThreshold !== "" ? Number(envThreshold) : DEFAULT_DECISION_THRESHOLD;
  }
  const parsedThreshold = Number(threshold);
  if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
    throw new TypeError(`Decision threshold must be a finite number between 0 and 1. Received: ${threshold}`);
  }

  return {
    apiKey: apiKey.trim(),
    model: cleanModel,
    threshold: parsedThreshold
  };
}

export function buildDecisionCandidateQuestion(candidate, index, term) {
  const cleanTerm = cleanString(term, 160);
  const title = cleanString(candidate.content?.title || candidate.title, 160) || "Untitled";
  const description = cleanString(candidate.content?.description || candidate.description, 300) || "";
  const sourceName = cleanString(candidate.source?.name || candidate.source?.id || candidate.sourceId, 100) || "Unknown Source";
  const mediaKind = cleanString(candidate.media?.kind || candidate.content?.type, 60) || "media";
  const topics = unique([
    ...(candidate.knowledge?.topics || []),
    ...(candidate.content?.topics || []),
    ...(candidate.topics || [])
  ]).map((topic) => cleanString(topic, 100)).filter(Boolean).slice(0, 8);

  const retrieval = candidate.knowledge?.retrieval;
  const retrievalInfo = retrieval ? {
    query: cleanString(retrieval.query || retrieval.originalQuery, 160),
    strategy: cleanString(retrieval.strategy, 80),
    entity: cleanString(retrieval.entity, 120)
  } : null;

  const candidateId = candidate.id ? String(candidate.id) : `candidate_${index}`;
  const questionName = `cand_${index}`;

  const retrievalText = retrievalInfo
    ? `query: "${retrievalInfo.query || ""}", strategy: "${retrievalInfo.strategy || ""}"`
    : "standard search";

  const instructions = [
    `Is candidate [${candidateId}] ("${title}") meaningfully and semantically about the target topic "${cleanTerm}"?`,
    `Title: ${title}`,
    `Description: ${description || "None provided"}`,
    `Source: ${sourceName} (${mediaKind})`,
    `Topics: ${topics.length ? topics.join(", ") : "None"}`,
    `Retrieval context: ${retrievalText}`,
    `Evaluation Rule: A candidate passes only when it is meaningfully about the search topic. Reject incidental keyword matches, generic media, loosely associated people or places, and items whose relevance depends only on the source name. Retrieval strategy explains how the candidate was retrieved, but is not proof of relevance.`
  ].join("\n");

  const sourceEvidence = {
    candidateId,
    title,
    description,
    sourceName,
    mediaKind,
    topics,
    retrieval: retrievalInfo
  };

  return {
    question: {
      type: "predicate",
      name: questionName,
      instructions
    },
    questionName,
    candidateIndex: index,
    sourceEvidence
  };
}

export function buildDecisionsInput(term, options = {}) {
  const cleanTerm = cleanString(term, 160);
  const topicMeaning = options.topicMeaning || options.entity;

  let meaningDetails = "";
  if (topicMeaning) {
    const label = cleanString(topicMeaning.label, 120);
    const description = cleanString(topicMeaning.description, 300);
    if (label) {
      meaningDetails = `\nResolved topic meaning: ${label}${description ? ` — ${description}` : ""}`;
    }
  }

  return `Target search term: "${cleanTerm}"${meaningDetails}

You are OpenScroll's relevance evaluator. Evaluate whether each identified candidate is meaningfully about the chosen topic. Reject incidental keyword matches, generic images, and loosely associated people or places. Retrieval strategy explains how candidates were found, but is context, not proof.`;
}

export async function evaluateFeedCandidates(term, candidates, options = {}) {
  const cleanTerm = cleanString(term, 160);
  if (!cleanTerm || !Array.isArray(candidates) || !candidates.length) {
    return { accepted: [], evaluations: [], unevaluated: [], partialFailures: false };
  }

  const { apiKey, model, threshold } = getDecisionsConfig(options);

  if (typeof fetch !== "function") {
    throw new OpenAIConfigurationError("The server cannot reach OpenAI because fetch is unavailable.");
  }

  // Bounded batching: process candidates in bounded batches if larger than MAX_DECISIONS_BATCH_SIZE
  if (candidates.length > MAX_DECISIONS_BATCH_SIZE) {
    const allAccepted = [];
    const allEvaluations = [];
    const allUnevaluated = [];
    let hadPartialFailures = false;

    for (let i = 0; i < candidates.length; i += MAX_DECISIONS_BATCH_SIZE) {
      const slice = candidates.slice(i, i + MAX_DECISIONS_BATCH_SIZE);
      const batchResult = await evaluateDecisionsBatch(cleanTerm, slice, {
        ...options,
        apiKey,
        model,
        threshold,
        startIndex: i
      });
      allAccepted.push(...batchResult.accepted);
      allEvaluations.push(...batchResult.evaluations);
      allUnevaluated.push(...batchResult.unevaluated);
      if (batchResult.partialFailures) hadPartialFailures = true;
    }

    return {
      accepted: allAccepted,
      evaluations: allEvaluations,
      unevaluated: allUnevaluated,
      partialFailures: hadPartialFailures
    };
  }

  return evaluateDecisionsBatch(cleanTerm, candidates, {
    ...options,
    apiKey,
    model,
    threshold,
    startIndex: 0
  });
}

import { relevanceDecisionsCache, computeDecisionCacheKey } from "./shared-cache.js";

async function evaluateDecisionsBatch(term, candidates, options = {}) {
  const { apiKey, model, threshold, startIndex = 0 } = options;
  const budget = getRequestBudgetConfig();

  const evaluationsByLocalIndex = new Array(candidates.length);
  const uncachedIndices = [];
  const cacheKeys = new Array(candidates.length);

  for (let localIdx = 0; localIdx < candidates.length; localIdx += 1) {
    const candidate = candidates[localIdx];
    const cacheKey = computeDecisionCacheKey({
      term,
      topicMeaning: options.topicMeaning || options.entity,
      model,
      promptVersion: DECISIONS_PROMPT_VERSION,
      threshold,
      candidate
    });
    cacheKeys[localIdx] = cacheKey;

    if (!options.skipCache && relevanceDecisionsCache.has(cacheKey)) {
      const cached = relevanceDecisionsCache.get(cacheKey);
      evaluationsByLocalIndex[localIdx] = cached;
      candidate.decision = cached;
      candidate.sourceEvidence = cached.sourceEvidence;
      candidate.ranking = {
        ...(candidate.ranking || {}),
        relevanceProbability: cached.probability
      };
      options.metrics?.increment("cacheHits");
    } else {
      uncachedIndices.push(localIdx);
    }
  }

  // If every candidate in this batch was resolved from shared cache, return immediately without AI call
  if (!uncachedIndices.length) {
    const accepted = candidates.filter((_, idx) => evaluationsByLocalIndex[idx]?.accepted === true);
    return {
      accepted,
      evaluations: evaluationsByLocalIndex,
      unevaluated: [],
      partialFailures: false
    };
  }

  const prepared = uncachedIndices.map((localIdx, qIdx) =>
    buildDecisionCandidateQuestion(candidates[localIdx], startIndex + qIdx, term)
  );

  const questions = prepared.map((p) => p.question);
  const questionMap = new Map();
  prepared.forEach((p, qIdx) => {
    const localIdx = uncachedIndices[qIdx];
    questionMap.set(p.questionName, {
      candidate: candidates[localIdx],
      candidateIndex: startIndex + localIdx,
      localIdx,
      sourceEvidence: p.sourceEvidence
    });
  });

  const input = buildDecisionsInput(term, options);

  let payload;
  try {
    payload = await fetchJsonWithRetry(OPENAI_DECISIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input,
        questions
      }),
      signal: options.signal,
      deadline: options.deadline,
      timeoutMs: options.aiTimeoutMs ?? budget.aiTimeoutMs,
      maxRetries: options.aiMaxRetries ?? budget.aiMaxRetries,
      baseDelayMs: options.retryBaseDelayMs,
      onAttempt: () => options.metrics?.increment("aiCalls"),
      onRetry: () => options.metrics?.increment("aiRetries")
    });
  } catch (error) {
    if (isAbortError(error)) throw abortError();
    const status = Number.isInteger(error?.status) ? error.status : error?.kind === "timeout" ? 504 : 502;
    const message = error?.kind === "malformed"
      ? `OpenAI Decisions returned an invalid response (${status}).`
      : `OpenAI Decisions request failed: ${error?.message || "unknown error"}`;
    const failure = new OpenAIRequestError(message, status);
    failure.kind = error?.kind || "network";
    failure.retryable = Boolean(error?.retryable);
    options.metrics?.increment("aiFailures");
    throw failure;
  }

  options.metrics?.addUsage(payload, model);

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.answers)) {
    options.metrics?.increment("aiFailures");
    throw new OpenAIRequestError("OpenAI Decisions returned an invalid payload missing answers array.", 502);
  }

  const answers = payload.answers;
  const seenQuestionNames = new Set();
  const unevaluated = [];
  let partialFailures = false;

  for (const answer of answers) {
    if (!answer || typeof answer !== "object" || typeof answer.name !== "string" || !answer.name.trim()) {
      partialFailures = true;
      continue;
    }

    const questionName = answer.name.trim();

    if (!questionMap.has(questionName)) {
      // Unknown question name returned by model
      partialFailures = true;
      continue;
    }

    if (seenQuestionNames.has(questionName)) {
      // Duplicate answer for same question name
      partialFailures = true;
      continue;
    }
    seenQuestionNames.add(questionName);

    const { candidate, candidateIndex, sourceEvidence } = questionMap.get(questionName);
    const localIdx = candidateIndex - startIndex;

    const provenance = {
      decisionVersion: DECISION_VERSION,
      model,
      promptVersion: DECISIONS_PROMPT_VERSION,
      threshold,
      calibratedAgainstHumanLabels: false,
      evaluatedAt: Date.now()
    };

    if (answer.type === "refusal") {
      partialFailures = true;
      const refusalMsg = answer.refusal || answer.message || "Model refused question";
      const evalRecord = {
        candidateIndex,
        questionName,
        probability: null,
        accepted: false,
        pass: false,
        unevaluated: true,
        failureKind: "refusal",
        refusal: refusalMsg,
        provenance,
        sourceEvidence
      };
      evaluationsByLocalIndex[localIdx] = evalRecord;
      candidate.decision = evalRecord;
      candidate.sourceEvidence = sourceEvidence;
      unevaluated.push(candidate);
      continue;
    }

    if (answer.type !== "predicate") {
      partialFailures = true;
      const evalRecord = {
        candidateIndex,
        questionName,
        probability: null,
        accepted: false,
        pass: false,
        unevaluated: true,
        failureKind: "unexpected_type",
        provenance,
        sourceEvidence
      };
      evaluationsByLocalIndex[localIdx] = evalRecord;
      candidate.decision = evalRecord;
      candidate.sourceEvidence = sourceEvidence;
      unevaluated.push(candidate);
      continue;
    }

    const prob = Number(answer.probability);
    if (!Number.isFinite(prob) || prob < 0 || prob > 1) {
      partialFailures = true;
      const evalRecord = {
        candidateIndex,
        questionName,
        probability: null,
        accepted: false,
        pass: false,
        unevaluated: true,
        failureKind: "malformed_probability",
        provenance,
        sourceEvidence
      };
      evaluationsByLocalIndex[localIdx] = evalRecord;
      candidate.decision = evalRecord;
      candidate.sourceEvidence = sourceEvidence;
      unevaluated.push(candidate);
      continue;
    }

    const accepted = prob >= threshold;
    const evalRecord = {
      candidateIndex,
      questionName,
      probability: prob,
      accepted,
      pass: accepted,
      threshold,
      unevaluated: false,
      provenance,
      sourceEvidence
    };

    evaluationsByLocalIndex[localIdx] = evalRecord;

    // Cache definitive evaluation in shared relevance decisions cache
    if (!options.skipCache && cacheKeys[localIdx]) {
      relevanceDecisionsCache.set(cacheKeys[localIdx], evalRecord);
    }

    // Attach decision and ranking relevance probability to candidate
    candidate.decision = evalRecord;
    candidate.sourceEvidence = sourceEvidence;
    candidate.ranking = {
      ...(candidate.ranking || {}),
      relevanceProbability: prob
    };
  }

  // Handle missing answers for any question that was not answered
  for (let qIdx = 0; qIdx < uncachedIndices.length; qIdx += 1) {
    const localIdx = uncachedIndices[qIdx];
    if (!evaluationsByLocalIndex[localIdx]) {
      partialFailures = true;
      const candidate = candidates[localIdx];
      const p = prepared[qIdx];
      const provenance = {
        decisionVersion: DECISION_VERSION,
        model,
        promptVersion: DECISIONS_PROMPT_VERSION,
        threshold,
        calibratedAgainstHumanLabels: false,
        evaluatedAt: Date.now()
      };
      const evalRecord = {
        candidateIndex: p.candidateIndex,
        questionName: p.questionName,
        probability: null,
        accepted: false,
        pass: false,
        unevaluated: true,
        failureKind: "missing_answer",
        provenance,
        sourceEvidence: p.sourceEvidence
      };
      evaluationsByLocalIndex[localIdx] = evalRecord;
      candidate.decision = evalRecord;
      candidate.sourceEvidence = p.sourceEvidence;
      unevaluated.push(candidate);
    }
  }

  const accepted = candidates.filter((_, idx) => evaluationsByLocalIndex[idx]?.accepted === true);

  return {
    accepted,
    evaluations: evaluationsByLocalIndex,
    unevaluated,
    partialFailures
  };
}

// On-demand explanation cache to prevent regenerating explanations for every card
const explanationCache = new Map();
const MAX_EXPLANATION_CACHE_SIZE = 500;

export async function generateRelevanceExplanation(term, candidate, options = {}) {
  const cleanTerm = cleanString(term, 160);
  const candidateId = candidate?.id || "unknown";
  const cacheKey = `${cleanTerm}:${candidateId}`;

  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey);
  }

  const evidence = candidate.sourceEvidence || {
    title: cleanString(candidate.content?.title || candidate.title, 160),
    description: cleanString(candidate.content?.description || candidate.description, 300),
    sourceName: cleanString(candidate.source?.name, 80)
  };

  const prob = candidate.decision?.probability ?? candidate.ranking?.relevanceProbability;
  const probText = Number.isFinite(prob) ? `relevance probability ${(prob * 100).toFixed(0)}%` : "evaluated candidate";

  const prompt = `Explain in 1-2 concise, engaging sentences why this content is relevant to "${cleanTerm}". Use the evidence provided.

Candidate:
Title: ${evidence.title}
Description: ${evidence.description || "N/A"}
Source: ${evidence.sourceName || "N/A"}
Status: ${probText}`;

  const schema = {
    type: "object",
    properties: {
      explanation: { type: "string" }
    },
    required: ["explanation"],
    additionalProperties: false
  };

  const result = await requestOpenAIStructuredOutput({
    name: "relevance_explanation",
    instructions: "You are OpenScroll's provenance and explanation assistant. Write concise, accurate 1-2 sentence explanations grounded solely in the provided evidence. Do not extrapolate or fabricate facts.",
    input: prompt,
    schema
  }, options);

  const explanation = cleanString(result?.explanation, 400);

  if (explanationCache.size >= MAX_EXPLANATION_CACHE_SIZE) {
    const firstKey = explanationCache.keys().next().value;
    explanationCache.delete(firstKey);
  }
  explanationCache.set(cacheKey, explanation);
  if (candidate) {
    candidate.explanation = explanation;
  }

  return explanation;
}

