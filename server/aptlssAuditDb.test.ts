import { describe, expect, it } from "vitest";

import { summarizeLlmUsagePayloads } from "./aptlssAuditDb";

describe("APTLSS LLM usage aggregation", () => {
  it("totals successful, failed, cached, completion, and reasoning usage", () => {
    expect(summarizeLlmUsagePayloads([
      JSON.stringify({
        status: "success",
        promptTokens: 120,
        cachedTokens: 80,
        completionTokens: 30,
        reasoningTokens: 10,
        totalTokens: 150,
      }),
      JSON.stringify({
        status: "failed",
        promptTokens: 20,
        cachedTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 20,
      }),
      "not-json",
    ])).toEqual({
      attempts: 3,
      successes: 1,
      failures: 1,
      promptTokens: 140,
      cachedTokens: 80,
      completionTokens: 30,
      reasoningTokens: 10,
      totalTokens: 170,
    });
  });
});
