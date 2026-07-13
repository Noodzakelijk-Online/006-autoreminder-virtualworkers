import { describe, expect, it } from "vitest";
import { buildDeterministicAptlssPlan } from "./aptlssFallback";
import type { TrelloCardContext } from "./aptlssEngine";

function card(overrides: Partial<TrelloCardContext> = {}): TrelloCardContext {
  return {
    id: "card123",
    name: "Landing page wireframes",
    desc: "Create final wireframes for the landing page hero and packages.",
    url: "https://trello.com/c/card123",
    shortUrl: "https://trello.com/c/card123",
    due: null,
    dueComplete: false,
    labels: [],
    listName: "In Progress",
    boardName: "Client Website",
    checklists: [],
    comments: [],
    attachments: [],
    lastActivityMs: Date.now(),
    ...overrides,
  };
}

describe("deterministic APTLSS fallback", () => {
  it("builds a schema-compatible plan with actionable steps from Trello context", () => {
    const plan = buildDeterministicAptlssPlan(card(), "OPENAI_API_KEY is not configured");

    expect(plan.action).toContain("Landing page wireframes");
    expect(plan.steps.length).toBeGreaterThanOrEqual(5);
    expect(plan.steps.every((step, index) => step.number === index + 1)).toBe(true);
    expect(plan.steps.every((step) => typeof step.estimatedMinutes === "number" && step.estimatedMinutes > 0)).toBe(true);
    expect(plan.confidenceScore).toBeGreaterThanOrEqual(65);
    expect(plan.links).toContain("https://trello.com/c/card123");
  });

  it("flags vague cards as low-confidence repair work without inventing a Robert decision", () => {
    const plan = buildDeterministicAptlssPlan(card({ desc: "", name: "Website thing" }));

    expect(plan.confidenceScore).toBeLessThan(65);
    expect(plan.escalationCategory).toBe("low_confidence");
    expect(plan.robertDecision).toBeNull();
    expect(plan.steps.some((step) => step.requiresRobert)).toBe(false);
  });

  it("does not infer an unresolved decision from a sensitive topic alone", () => {
    const plan = buildDeterministicAptlssPlan(card({
      name: "Budget and invoice administration",
      desc: "Prepare a status overview from the current records.",
    }));

    expect(plan.robertDecision).toBeNull();
    expect(plan.steps.some((step) => step.requiresRobert)).toBe(false);
  });
});
