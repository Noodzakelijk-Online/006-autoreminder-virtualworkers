import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAptlssModelCatalog, resetAptlssModelCatalogForTests } from "./aptlssModelCatalog";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("APTLSS OpenAI model catalog", () => {
  beforeEach(() => {
    for (const name of [
      "OPENAI_API_KEY",
      "APTLSS_OPENAI_MODEL_INCLUDE",
      "APTLSS_OPENAI_MODEL_EXCLUDE",
      "APTLSS_OPENAI_INCLUDE_SNAPSHOTS",
      "APTLSS_OPENAI_MAX_MODELS",
    ]) vi.stubEnv(name, "");
    vi.stubEnv("APTLSS_MODEL_DISCOVERY_ENABLED", "true");
    resetAptlssModelCatalogForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reports only the OpenAI provider when no key is configured", async () => {
    const catalog = await getAptlssModelCatalog({ forceRefresh: true });

    expect(catalog.models).toEqual([]);
    expect(catalog.providers).toEqual([
      expect.objectContaining({ providerId: "openai-paid", status: "disabled" }),
    ]);
  });

  it("discovers account-visible OpenAI chat families and deduplicates snapshots", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      data: [
        { id: "gpt-4o-mini" },
        { id: "gpt-5.4-mini" },
        { id: "gpt-5.4-mini-2026-03-17" },
        { id: "gpt-5.5-pro" },
        { id: "gpt-5.6-sol" },
        { id: "o3-pro" },
        { id: "gpt-image-2" },
        { id: "text-embedding-3-small" },
        { id: "ft:gpt-5.4-mini:org:custom:id" },
      ],
    })));

    const catalog = await getAptlssModelCatalog({ forceRefresh: true });

    expect(catalog.models.map((model) => model.model)).toEqual([
      "gpt-4o-mini",
      "gpt-5.4-mini",
      "o3-pro",
      "gpt-5.5-pro",
      "gpt-5.6-sol",
    ]);
    expect(catalog.models.find((model) => model.model === "gpt-5.5-pro")?.reasoningEfforts)
      .toEqual(["medium", "high", "xhigh"]);
    expect(catalog.models.find((model) => model.model === "gpt-5.6-sol")?.reasoningEfforts)
      .toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(catalog.providers[0].exclusions)
      .toEqual(expect.objectContaining({ snapshot_deduplicated: 1, fine_tuned_requires_explicit_include: 1 }));
    expect(JSON.stringify(catalog)).not.toContain("openai-secret");
  });

  it("honors OpenAI include, exclude, and model-cap controls", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-secret");
    vi.stubEnv("APTLSS_OPENAI_MODEL_INCLUDE", "gpt-5*");
    vi.stubEnv("APTLSS_OPENAI_MODEL_EXCLUDE", "*-pro");
    vi.stubEnv("APTLSS_OPENAI_MAX_MODELS", "1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      data: [{ id: "gpt-4o-mini" }, { id: "gpt-5-mini" }, { id: "gpt-5.5" }, { id: "gpt-5.5-pro" }],
    })));

    const catalog = await getAptlssModelCatalog({ forceRefresh: true });

    expect(catalog.models.map((model) => model.model)).toEqual(["gpt-5-mini"]);
    expect(catalog.providers[0].exclusions).toEqual(expect.objectContaining({
      not_operator_included: 1,
      operator_excluded: 1,
      provider_model_cap: 1,
    }));
  });

  it("reuses a fresh catalog and keeps stale OpenAI models after a failed refresh", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-secret");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "gpt-5-mini" }] }))
      .mockRejectedValueOnce(new Error("temporary catalog outage"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getAptlssModelCatalog({ forceRefresh: true });
    const cached = await getAptlssModelCatalog();
    const stale = await getAptlssModelCatalog({ forceRefresh: true });

    expect(cached).toBe(first);
    expect(stale.models.map((model) => model.model)).toEqual(["gpt-5-mini"]);
    expect(stale.providers[0].status).toBe("stale");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
