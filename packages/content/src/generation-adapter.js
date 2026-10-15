import { abortError, fetchJsonWithRetry, getRequestBudgetConfig, isAbortError } from "./source-batch.js";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const DEFAULT_GENERATION_MODEL = "gpt-6-luna";

export class OpenAIConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OpenAIConfigurationError";
    this.status = 503;
    this.code = "OPENAI_CONFIGURATION_ERROR";
  }
}

export class OpenAIRequestError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
    this.code = "OPENAI_REQUEST_ERROR";
  }
}

export function getGenerationConfig(options = {}) {
  const apiKey = options.apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "");
  const model = options.model || (typeof process !== "undefined" ? (process.env?.OPENAI_GENERATION_MODEL || process.env?.OPENAI_MODEL) : "") || DEFAULT_GENERATION_MODEL;

  if (!apiKey || !apiKey.trim()) {
    throw new OpenAIConfigurationError("OPENAI_API_KEY is required for OpenScroll AI generation.");
  }

  return {
    apiKey: apiKey.trim(),
    model: model.trim() || DEFAULT_GENERATION_MODEL
  };
}

export function extractResponseOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (item?.type === "message" || item?.role === "assistant") {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
              return part.text.trim();
            }
          }
        }
      }
    }
  }

  // Backwards compatibility with Chat Completions format if mock/proxy returns choices
  if (typeof payload?.choices?.[0]?.message?.content === "string" && payload.choices[0].message.content.trim()) {
    return payload.choices[0].message.content.trim();
  }

  return null;
}

export function checkResponseRefusalOrIncomplete(payload) {
  if (payload?.status === "incomplete") {
    const reason = payload.incomplete_details?.reason || "generation budget reached";
    throw new OpenAIRequestError(`OpenAI generation returned an incomplete response (${reason}).`, 502);
  }

  if (payload?.status === "failed") {
    throw new OpenAIRequestError("OpenAI generation request failed.", 502);
  }

  // Check for refusals in output items
  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (item?.type === "refusal") {
        const refusal = item.refusal || item.message || "Request was refused by model safety policy.";
        throw new OpenAIRequestError(`OpenAI refused the generation request: ${refusal}`, 400);
      }
      if (item?.content && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === "refusal") {
            const refusal = part.refusal || "Request was refused by model safety policy.";
            throw new OpenAIRequestError(`OpenAI refused the generation request: ${refusal}`, 400);
          }
        }
      }
    }
  }

  // Backwards compatibility with message refusal field
  if (payload?.choices?.[0]?.message?.refusal) {
    throw new OpenAIRequestError(`OpenAI refused the generation request: ${payload.choices[0].message.refusal}`, 400);
  }
}

export async function requestOpenAIStructuredOutput(params, options = {}) {
  try {
    return await requestOpenAIStructuredOutputMeasured(params, options);
  } catch (error) {
    options.metrics?.increment("aiFailures");
    throw error;
  }
}

async function requestOpenAIStructuredOutputMeasured(params, options = {}) {
  const { apiKey, model } = getGenerationConfig(options);

  if (typeof fetch !== "function") {
    throw new OpenAIConfigurationError("The server cannot reach OpenAI because fetch is unavailable.");
  }

  const {
    input,
    instructions,
    name = "structured_output",
    schema,
    reasoningEffort = options.reasoningEffort ?? "none"
  } = params;

  if (!input) {
    throw new OpenAIRequestError("Input is required for generation request.", 400);
  }
  if (!schema || typeof schema !== "object") {
    throw new OpenAIRequestError("A strict JSON schema is required for Structured Outputs.", 400);
  }

  const requestBody = {
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name,
        strict: true,
        schema
      }
    }
  };

  if (instructions && typeof instructions === "string" && instructions.trim()) {
    requestBody.instructions = instructions.trim();
  }

  if (reasoningEffort && reasoningEffort !== "default") {
    requestBody.reasoning = { effort: reasoningEffort };
  }

  const budget = getRequestBudgetConfig();
  let payload;
  try {
    payload = await fetchJsonWithRetry(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
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
      ? `OpenAI returned an invalid response (${status}).`
      : `OpenAI generation request failed: ${error?.message || "unknown error"}`;
    const failure = new OpenAIRequestError(message, status);
    failure.kind = error?.kind || "network";
    failure.retryable = Boolean(error?.retryable);
    throw failure;
  }

  options.metrics?.addUsage(payload, model);

  checkResponseRefusalOrIncomplete(payload);

  const rawText = extractResponseOutputText(payload);
  if (!rawText) {
    throw new OpenAIRequestError("OpenAI returned no JSON content.");
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new OpenAIRequestError("OpenAI returned invalid JSON content.");
  }
}

