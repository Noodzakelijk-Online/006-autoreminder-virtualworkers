import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./aptlssAuditDb", () => ({
  countLlmProviderAttempts: vi.fn().mockResolvedValue(0),
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

import { countLlmProviderAttempts } from "./aptlssAuditDb";
import {
  getAvailableAptlssLlmStages,
  getAptlssLlmConfigurationStatus,
  getConfiguredAptlssLlmStages,
  invokeAptlssLLM,
  resetAptlssLlmRouterStateForTests,
  type AptlssValidationIssue,
} from "./aptlssLlmRouter";

const response = (content: unknown, model = "test-model") => new Response(JSON.stringify({
  id: `response-${model}`,
  created: 1,
  model,
  choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
}), { status: 200, headers: { "content-type": "application/json" } });

const responseCatalog = (content: unknown) => new Response(JSON.stringify(content), {
  status: 200,
  headers: { "content-type": "application/json" },
});

const params = {
  messages: [{ role: "user" as const, content: "Create a precise task." }],
  response_format: {
    type: "json_schema" as const,
    json_schema: {
      name: "test_output",
      strict: true,
      schema: {
        type: "object",
        properties: { task: { type: "string" } },
        required: ["task"],
        additionalProperties: false,
      },
    },
  },
};

function clearProviderEnv() {
  for (const name of [
    "OPENROUTER_API_KEY",
    "APTLSS_OLLAMA_MODELS",
    "GEMINI_API_KEY",
    "BUILT_IN_FORGE_API_KEY",
    "OPENAI_API_KEY",
    "APTLSS_LLM_STAGES_JSON",
    "APTLSS_LLM_MAX_RANK",
    "APTLSS_LLM_MAX_CALLS_PER_RUN",
    "APTLSS_MODEL_DISCOVERY_ENABLED",
    "APTLSS_OLLAMA_DISCOVERY_ENABLED",
  ]) vi.stubEnv(name, "");
}

function customStages(stages: Array<Record<string, unknown>>) {
  vi.stubEnv("TEST_LLM_KEY", "test-secret");
  vi.stubEnv("APTLSS_LLM_STAGES_JSON", JSON.stringify(stages.map((stage, index) => ({
    id: `stage-${index + 1}`,
    providerId: `provider-${index + 1}`,
    label: `Provider ${index + 1}`,
    tier: index === 0 ? "free" : index === 1 ? "open_source" : "paid",
    rank: (index + 1) * 10,
    endpoint: `https://provider-${index + 1}.test/v1/chat/completions`,
    apiKeyEnv: "TEST_LLM_KEY",
    model: `model-${index + 1}`,
    supportsJsonSchema: true,
    ...stage,
  }))));
}

describe("APTLSS model and effort router", () => {
  beforeEach(() => {
    clearProviderEnv();
    resetAptlssLlmRouterStateForTests();
    vi.mocked(countLlmProviderAttempts).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("orders supported OpenAI effort stages without inventing ultra", () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-test-key");
    const stages = getConfiguredAptlssLlmStages();

    expect(stages.filter((stage) => stage.model === "gpt-5.5").map((stage) => stage.reasoningEffort))
      .toEqual(["low", "medium", "high", "xhigh"]);
    expect(stages.filter((stage) => stage.model === "gpt-5.6-luna").map((stage) => stage.reasoningEffort))
      .toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(stages.some((stage) => stage.reasoningEffort === ("ultra" as never))).toBe(false);
    expect(stages.at(-1)?.id).toBe("openai-paid:gpt-5.6-sol:max");
  });

  it("turns every discovered OpenAI model into a strictly ordered stage range", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-test-key");
    vi.stubEnv("APTLSS_MODEL_DISCOVERY_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseCatalog({
      data: [
        { id: "gpt-4o-mini" },
        { id: "gpt-5.6-sol" },
      ],
    })));

    const stages = await getAvailableAptlssLlmStages({ forceRefresh: true });
    const compact = stages.filter((stage) => stage.model === "gpt-4o-mini");
    const reasoner = stages.filter((stage) => stage.model === "gpt-5.6-sol");

    expect(compact.map((stage) => stage.id)).toEqual(["openai-paid:gpt-4o-mini"]);
    expect(reasoner.map((stage) => stage.id)).toEqual([
      "openai-paid:gpt-5.6-sol:low",
      "openai-paid:gpt-5.6-sol:medium",
      "openai-paid:gpt-5.6-sol:high",
      "openai-paid:gpt-5.6-sol:xhigh",
      "openai-paid:gpt-5.6-sol:max",
    ]);
    expect(stages.map((stage) => stage.rank)).toEqual([...stages.map((stage) => stage.rank)].sort((a, b) => a - b));
    expect(stages[0].model).toBe("gpt-4o-mini");
  });

  it("exposes a complete secret-free model inventory for readiness inspection", async () => {
    customStages([{}, {}]);

    const status = await getAptlssLlmConfigurationStatus();

    expect(status).toMatchObject({ configured: true, providerCount: 2, modelCount: 2, stageCount: 2 });
    expect(status.models).toEqual([
      expect.objectContaining({ providerId: "provider-1", model: "model-1", source: "configured" }),
      expect.objectContaining({ providerId: "provider-2", model: "model-2", source: "configured" }),
    ]);
    expect(JSON.stringify(status)).not.toContain("test-secret");
  });

  it("stops when the next higher stage passes the candidate", async () => {
    customStages([{}, {}]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ task: "Prepare the signed client handoff" }, "model-1"))
      .mockResolvedValueOnce(response({
        verdict: "pass",
        confidence: 94,
        flaws: [],
        correctedOutput: { task: "Prepare the signed client handoff" },
      }, "model-2"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeAptlssLLM(params, { purpose: "test", validateCandidate: () => [] });

    expect(JSON.parse(result.choices[0].message.content as string)).toEqual({ task: "Prepare the signed client handoff" });
    expect(result.routing).toMatchObject({ outcome: "verified", selectedStageId: "stage-1", verifiedByStageId: "stage-2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repairs a flawed candidate and has the next stage verify the repair", async () => {
    customStages([{}, {}, {}]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ task: "Review" }, "model-1"))
      .mockResolvedValueOnce(response({
        verdict: "revise",
        confidence: 88,
        flaws: [{ code: "vague", severity: "error", message: "Task is vague." }],
        correctedOutput: { task: "Compare the signed contract against the approved scope" },
      }, "model-2"))
      .mockResolvedValueOnce(response({
        verdict: "pass",
        confidence: 97,
        flaws: [],
        correctedOutput: { task: "Compare the signed contract against the approved scope" },
      }, "model-3"));
    vi.stubGlobal("fetch", fetchMock);
    const validateCandidate = (candidate: Record<string, unknown>) => {
      const issues: AptlssValidationIssue[] = [];
      if (typeof candidate.task !== "string" || candidate.task.length < 12) {
        issues.push({ code: "vague", severity: "error", message: "Task is too vague." });
      }
      return issues;
    };

    const result = await invokeAptlssLLM(params, { purpose: "test", validateCandidate });

    expect(JSON.parse(result.choices[0].message.content as string).task).toContain("signed contract");
    expect(result.routing).toMatchObject({ outcome: "repaired", selectedStageId: "stage-2", verifiedByStageId: "stage-3" });
    expect(result.routing?.attempts.map((attempt) => attempt.purpose)).toEqual(["generate", "repair", "review"]);
  });

  it("skips a provider whose configured quota is exhausted", async () => {
    customStages([{ dailyLimit: 1 }, {}]);
    vi.mocked(countLlmProviderAttempts).mockImplementation(async (providerId) => providerId === "provider-1" ? 1 : 0);
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ task: "Prepare the verified client handoff" }, "model-2"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeAptlssLLM(params, { purpose: "test", requireReview: false, validateCandidate: () => [] });

    expect(result.routing?.selectedStageId).toBe("stage-2");
    expect(result.routing?.attempts[0]).toMatchObject({ stageId: "stage-1", status: "skipped" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("advances after a lower stage is rate-limited", async () => {
    customStages([{}, {}]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "60" } }))
      .mockResolvedValueOnce(response({ task: "Prepare the verified client handoff" }, "model-2"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeAptlssLLM(params, { purpose: "test", requireReview: false, validateCandidate: () => [] });

    expect(result.routing?.selectedStageId).toBe("stage-2");
    expect(result.routing?.attempts).toEqual(expect.arrayContaining([
      expect.objectContaining({ stageId: "stage-1", status: "failed" }),
      expect.objectContaining({ stageId: "stage-2", status: "success" }),
    ]));
  });
});
