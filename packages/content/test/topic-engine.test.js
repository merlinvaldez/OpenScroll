import test from "node:test";
import assert from "node:assert/strict";
import {
  expandTopics,
  resolveEntity,
  evaluateFeedCandidates,
  generateRelevanceExplanation,
  buildQueryPlan,
  UnsupportedDecisionsModelError,
  OPENAI_RESPONSES_URL,
  OPENAI_DECISIONS_URL,
  DEFAULT_GENERATION_MODEL,
  DEFAULT_DECISIONS_MODEL,
  DEFAULT_DECISION_THRESHOLD,
  DECISION_VERSION,
  DECISIONS_PROMPT_VERSION,
} from "../src/topic-engine.js";

function graphResponse() {
  return {
    entity: {
      label: "Morocco",
      description:
        "A country in North Africa with layered Amazigh, Arab, African, Mediterranean, and Atlantic histories.",
      aliases: ["Morocco", "Kingdom of Morocco"],
    },
    categories: [
      {
        categoryId: "sacred-practices",
        categoryLabel: "Sacred Practices and Ritual Life",
        categoryDescription:
          "Religious and ceremonial traditions connected to the query.",
        icon: "sparkles",
        color: "#ec4899",
      },
      {
        categoryId: "trade-diaspora",
        categoryLabel: "Trade Routes and Diaspora",
        categoryDescription:
          "Movement, exchange, and communities connected to the query.",
        icon: "compass",
        color: "#f59e0b",
      },
      {
        categoryId: "language-poetry",
        categoryLabel: "Language and Poetic Forms",
        categoryDescription:
          "Language, literature, and oral traditions connected to the query.",
        icon: "book-open",
        color: "#6366f1",
      },
      {
        categoryId: "built-landscapes",
        categoryLabel: "Built Landscapes and Memory",
        categoryDescription:
          "Places and material culture connected to the query.",
        icon: "landmark",
        color: "#10b981",
      },
      {
        categoryId: "living-craft",
        categoryLabel: "Living Craft and Performance",
        categoryDescription:
          "Contemporary cultural practice connected to the query.",
        icon: "music",
        color: "#8b5cf6",
      },
    ].map((category) => ({
      ...category,
      topics: [
        {
          name: `${category.categoryLabel} topic one`,
          description: "A specific concept returned by OpenAI.",
          weight: 1,
          icon: category.icon,
        },
        {
          name: `${category.categoryLabel} topic two`,
          description: "Another specific concept returned by OpenAI.",
          weight: 0.9,
          icon: category.icon,
        },
        {
          name: `${category.categoryLabel} topic three`,
          description: "A third specific concept returned by OpenAI.",
          weight: 0.8,
          icon: category.icon,
        },
      ],
    })),
  };
}

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function mockResponsesApiPayload(data, status = "completed") {
  return {
    id: "resp_test123",
    object: "response",
    status,
    model: "gpt-6-luna",
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: typeof data === "string" ? data : JSON.stringify(data),
          },
        ],
      },
    ],
    usage: {
      input_tokens: 64,
      output_tokens: 32,
      total_tokens: 96,
    },
  };
}

function mockDecisionsApiPayload(answers, model = "gpt-6-luna") {
  return {
    model,
    answers,
    usage: {
      input_tokens: 120,
      output_tokens: 0,
      total_tokens: 120,
    },
  };
}

function withMockedFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("default generation and decisions models default to gpt-6-luna", () => {
  assert.equal(DEFAULT_GENERATION_MODEL, "gpt-6-luna");
  assert.equal(DEFAULT_DECISIONS_MODEL, "gpt-6-luna");
  assert.equal(DEFAULT_DECISION_THRESHOLD, 0.7);
  assert.equal(DECISION_VERSION, "decisions.v1");
  assert.equal(DECISIONS_PROMPT_VERSION, "decisions-predicate.v1");
});

test("topic expansion uses Responses API with strict Structured Outputs and gpt-6-luna", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse(mockResponsesApiPayload(graphResponse()));
  });

  try {
    const expanded = await expandTopics("Morocco", { apiKey: "test-key" });
    assert.equal(expanded.entity.label, "Morocco");
    assert.equal(expanded.source, "OpenAI (gpt-6-luna)");
    assert.equal(expanded.categories.length, 5);
    assert.equal(
      expanded.categories[0].categoryLabel,
      "Sacred Practices and Ritual Life",
    );
    assert.ok(expanded.mindmap.nodes.length >= 16);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, OPENAI_RESPONSES_URL);
    assert.equal(requests[0].init.headers.Authorization, "Bearer test-key");

    const requestBody = JSON.parse(requests[0].init.body);
    assert.equal(requestBody.model, "gpt-6-luna");
    assert.equal(requestBody.text.format.type, "json_schema");
    assert.equal(requestBody.text.format.strict, true);
    assert.equal(requestBody.text.format.name, "topic_expansion");
    assert.equal(requestBody.reasoning?.effort, "none");
    assert.match(
      requestBody.input,
      /Generate the category IDs, labels, and descriptions/,
    );
    assert.match(requestBody.input, /do not use a fixed taxonomy/);
  } finally {
    restore();
  }
});

test("topic expansion benchmarks and supports reasoning effort option", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse(mockResponsesApiPayload(graphResponse()));
  });

  try {
    await expandTopics("Morocco", {
      apiKey: "test-key",
      reasoningEffort: "low",
    });
    assert.equal(requests.length, 1);
    const requestBody = JSON.parse(requests[0].init.body);
    assert.equal(requestBody.reasoning?.effort, "low");
  } finally {
    restore();
  }
});

test("Responses API handles refusal and incomplete response explicitly", async () => {
  // Test refusal
  const restoreRefusal = withMockedFetch(async () =>
    mockResponse({
      id: "resp_refused",
      status: "completed",
      output: [{ type: "refusal", refusal: "Topic violates safety policies." }],
    }),
  );

  try {
    await assert.rejects(
      () => expandTopics("Forbidden Topic", { apiKey: "test-key" }),
      /OpenAI refused the generation request/,
    );
  } finally {
    restoreRefusal();
  }

  // Test incomplete
  const restoreIncomplete = withMockedFetch(async () =>
    mockResponse({
      id: "resp_incomplete",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    }),
  );

  try {
    await assert.rejects(
      () => expandTopics("Very Long Topic", { apiKey: "test-key" }),
      /OpenAI generation returned an incomplete response/,
    );
  } finally {
    restoreIncomplete();
  }
});

test("OpenAI failures are surfaced instead of falling back", async () => {
  const restore = withMockedFetch(async () =>
    mockResponse({ error: { message: "model unavailable" } }, 503),
  );

  try {
    await assert.rejects(
      () => expandTopics("Jazz", { apiKey: "test-key" }),
      /model unavailable/,
    );
  } finally {
    restore();
  }
});

test("topic expansion fails when the OpenAI key is not configured", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () => expandTopics("Ancient Egypt"),
      /OPENAI_API_KEY is required/,
    );
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("entity resolution uses Responses API with strict Structured Outputs", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse(
      mockResponsesApiPayload({
        label: "Jazz",
        description: "A musical tradition originating in New Orleans.",
        aliases: ["Jazz music", "Classical American music"],
      }),
    );
  });

  try {
    const entity = await resolveEntity("Jazz", { apiKey: "test-key" });
    assert.equal(entity.label, "Jazz");
    assert.equal(entity.id, "AI-jazz");
    assert.deepEqual(entity.aliases, [
      "Jazz",
      "Jazz music",
      "Classical American music",
    ]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, OPENAI_RESPONSES_URL);
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.name, "entity_resolution");
  } finally {
    restore();
  }
});

test("feed evaluation uses POST /v1/decisions with gpt-6-luna and one predicate per candidate", async () => {
  const requests = [];
  const restore = withMockedFetch(async (url, init) => {
    requests.push({ url, init });
    return mockResponse(
      mockDecisionsApiPayload([
        { type: "predicate", name: "cand_0", probability: 0.95 },
        { type: "predicate", name: "cand_1", probability: 0.15 },
      ]),
    );
  });

  try {
    const candidates = [
      {
        id: "c1",
        title: "Gnawa ritual music in Morocco",
        description: "Lila ceremony recording.",
      },
      {
        id: "c2",
        title: "Morocco desert sunset",
        description: "Landscape photo.",
      },
    ];

    const result = await evaluateFeedCandidates(
      "Gnawa music Morocco",
      candidates,
      {
        apiKey: "test-key",
      },
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, OPENAI_DECISIONS_URL);
    assert.equal(requests[0].init.headers.Authorization, "Bearer test-key");

    const reqBody = JSON.parse(requests[0].init.body);
    assert.equal(reqBody.model, "gpt-6-luna");
    assert.match(reqBody.input, /Target search term: "Gnawa music Morocco"/);
    assert.equal(reqBody.questions.length, 2);
    assert.equal(reqBody.questions[0].type, "predicate");
    assert.equal(reqBody.questions[0].name, "cand_0");
    assert.match(
      reqBody.questions[0].instructions,
      /Gnawa ritual music in Morocco/,
    );
    assert.equal(reqBody.questions[1].type, "predicate");
    assert.equal(reqBody.questions[1].name, "cand_1");

    assert.deepEqual(
      result.accepted.map((c) => c.id),
      ["c1"],
    );
    assert.equal(result.accepted[0].ranking.relevanceProbability, 0.95);
    assert.equal(result.accepted[0].decision.accepted, true);
    assert.equal(
      result.accepted[0].decision.threshold,
      DEFAULT_DECISION_THRESHOLD,
    );
    assert.equal(
      result.accepted[0].decision.provenance.decisionVersion,
      DECISION_VERSION,
    );
    assert.equal(
      result.accepted[0].decision.provenance.calibratedAgainstHumanLabels,
      false,
    );
    assert.equal(result.evaluations[1].accepted, false);
    assert.equal(result.evaluations[1].probability, 0.15);
  } finally {
    restore();
  }
});

test("prohibits unsupported Decisions models", async () => {
  await assert.rejects(
    () =>
      evaluateFeedCandidates("Test", [{ id: "c1", title: "T" }], {
        apiKey: "test-key",
        model: "gpt-4o",
      }),
    UnsupportedDecisionsModelError,
  );

  await assert.rejects(
    () =>
      evaluateFeedCandidates("Test", [{ id: "c1", title: "T" }], {
        apiKey: "test-key",
        model: "gpt-5.6-luna",
      }),
    UnsupportedDecisionsModelError,
  );
});

test("maps answers by unique question name, not response position", async () => {
  const restore = withMockedFetch(async () => {
    // Return answers in reversed/shuffled order
    return mockResponse(
      mockDecisionsApiPayload([
        { type: "predicate", name: "cand_1", probability: 0.1 },
        { type: "predicate", name: "cand_0", probability: 0.9 },
      ]),
    );
  });

  try {
    const candidates = [
      { id: "item-0", title: "Zero" },
      { id: "item-1", title: "One" },
    ];

    const result = await evaluateFeedCandidates("Term", candidates, {
      apiKey: "test-key",
    });
    assert.equal(result.evaluations[0].questionName, "cand_0");
    assert.equal(result.evaluations[0].probability, 0.9);
    assert.equal(result.evaluations[0].accepted, true);

    assert.equal(result.evaluations[1].questionName, "cand_1");
    assert.equal(result.evaluations[1].probability, 0.1);
    assert.equal(result.evaluations[1].accepted, false);
  } finally {
    restore();
  }
});

test("handles refusal in Decisions API as unevaluated without permanent rejection", async () => {
  const restore = withMockedFetch(async () => {
    return mockResponse(
      mockDecisionsApiPayload([
        { type: "refusal", name: "cand_0", refusal: "Sensitive topic refusal" },
        { type: "predicate", name: "cand_1", probability: 0.85 },
      ]),
    );
  });

  try {
    const candidates = [
      { id: "refused-item", title: "Refused" },
      { id: "accepted-item", title: "Accepted" },
    ];

    const result = await evaluateFeedCandidates("Term", candidates, {
      apiKey: "test-key",
    });
    assert.deepEqual(
      result.accepted.map((c) => c.id),
      ["accepted-item"],
    );
    assert.equal(result.evaluations[0].unevaluated, true);
    assert.equal(result.evaluations[0].accepted, false);
    assert.equal(result.evaluations[0].failureKind, "refusal");
    assert.equal(result.unevaluated.length, 1);
    assert.equal(result.unevaluated[0].id, "refused-item");
    assert.equal(result.partialFailures, true);
  } finally {
    restore();
  }
});

test("handles missing, duplicate, unknown, and malformed answers explicitly", async () => {
  const restore = withMockedFetch(async () => {
    return mockResponse(
      mockDecisionsApiPayload([
        { type: "predicate", name: "unknown_question", probability: 0.99 },
        { type: "predicate", name: "cand_0", probability: 0.8 },
        { type: "predicate", name: "cand_0", probability: 0.9 }, // duplicate!
        { type: "predicate", name: "cand_1", probability: "not-a-number" }, // malformed!
        // cand_2 is missing entirely
      ]),
    );
  });

  try {
    const candidates = [
      { id: "c0", title: "C0" },
      { id: "c1", title: "C1" },
      { id: "c2", title: "C2" },
    ];

    const result = await evaluateFeedCandidates("Term", candidates, {
      apiKey: "test-key",
    });
    assert.equal(result.evaluations[0].accepted, true);
    assert.equal(result.evaluations[0].probability, 0.8);
    assert.equal(result.evaluations[1].unevaluated, true);
    assert.equal(result.evaluations[1].failureKind, "malformed_probability");
    assert.equal(result.evaluations[2].unevaluated, true);
    assert.equal(result.evaluations[2].failureKind, "missing_answer");
    assert.equal(result.partialFailures, true);
  } finally {
    restore();
  }
});

test("acceptance threshold is configurable and stored with provenance", async () => {
  const restore = withMockedFetch(async () => {
    return mockResponse(
      mockDecisionsApiPayload([
        { type: "predicate", name: "cand_0", probability: 0.65 },
      ]),
    );
  });

  try {
    const candidate = [{ id: "c1", title: "Test" }];

    // Default threshold is 0.7: 0.65 should not pass
    const resDefault = await evaluateFeedCandidates("Term", candidate, {
      apiKey: "test-key",
    });
    assert.equal(resDefault.accepted.length, 0);
    assert.equal(resDefault.evaluations[0].threshold, 0.7);

    // Custom threshold of 0.6: 0.65 should pass!
    const resCustom = await evaluateFeedCandidates("Term", candidate, {
      apiKey: "test-key",
      threshold: 0.6,
    });
    assert.equal(resCustom.accepted.length, 1);
    assert.equal(resCustom.evaluations[0].threshold, 0.6);
    assert.equal(
      resCustom.evaluations[0].provenance.promptVersion,
      DECISIONS_PROMPT_VERSION,
    );
  } finally {
    restore();
  }
});

test("retains source evidence and supports on-demand explanation with caching", async () => {
  const responsesRequests = [];
  const restore = withMockedFetch(async (url, init) => {
    if (url === OPENAI_DECISIONS_URL) {
      return mockResponse(
        mockDecisionsApiPayload([
          { type: "predicate", name: "cand_0", probability: 0.92 },
        ]),
      );
    }
    if (url === OPENAI_RESPONSES_URL) {
      responsesRequests.push({ url, init });
      return mockResponse(
        mockResponsesApiPayload({
          explanation:
            "This recording features authentic Gnawa maalem musicians in Essaouira performing traditional ceremonies.",
        }),
      );
    }
    return mockResponse({}, 404);
  });

  try {
    const candidates = [
      {
        id: "gnawa-audio",
        title: "Gnawa Lila performance",
        description: "Traditional Moroccan spiritual acoustic performance",
        source: { name: "Wikimedia Commons" },
        knowledge: { retrieval: { query: "Gnawa", strategy: "title-match" } },
      },
    ];

    const evalResult = await evaluateFeedCandidates("Gnawa", candidates, {
      apiKey: "test-key",
    });
    const acceptedCandidate = evalResult.accepted[0];

    assert.ok(acceptedCandidate.sourceEvidence);
    assert.equal(
      acceptedCandidate.sourceEvidence.title,
      "Gnawa Lila performance",
    );
    assert.equal(
      acceptedCandidate.sourceEvidence.retrieval.strategy,
      "title-match",
    );

    // Evaluation alone did NOT call Responses API for explanations!
    assert.equal(responsesRequests.length, 0);

    // Now request explanation on demand
    const explanation1 = await generateRelevanceExplanation(
      "Gnawa",
      acceptedCandidate,
      { apiKey: "test-key" },
    );
    assert.match(explanation1, /authentic Gnawa maalem/);
    assert.equal(responsesRequests.length, 1);

    // Second call for the same candidate hits cache without extra AI calls!
    const explanation2 = await generateRelevanceExplanation(
      "Gnawa",
      acceptedCandidate,
      { apiKey: "test-key" },
    );
    assert.equal(explanation2, explanation1);
    assert.equal(
      responsesRequests.length,
      1,
      "Cached explanation must not produce additional AI calls",
    );
  } finally {
    restore();
  }
});

test("query planner constructs multi-source search vectors", () => {
  const entity = { id: "AI-morocco", label: "Morocco" };
  const plan = buildQueryPlan(
    entity,
    ["Gnawa", "Architecture", "Darija"],
    "en",
  );
  assert.equal(plan.entityLabel, "Morocco");
  assert.ok(plan.searchTerms.wikimedia.includes("Gnawa"));
  assert.ok(plan.searchTerms.commons.includes("Morocco"));
});
