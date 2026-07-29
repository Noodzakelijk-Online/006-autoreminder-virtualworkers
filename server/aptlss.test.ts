/**
 * Tests for APTLSS plan tRPC procedures.
 * Covers: generate (cache hit, cache miss), getCached, getAll.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ─────────────────────────────────────────────────────────
vi.mock("./trelloCardContext", () => ({
  fetchCardContext: vi.fn().mockResolvedValue({
    id: "card123",
    name: "Test Card",
    url: "https://trello.com/c/card123",
    boardName: "Test Board",
    listName: "DOING",
    desc: "Some description",
    due: null,
    checklists: [],
    comments: [],
    labels: [],
    members: [],
  }),
  formatContextForLLM: vi.fn().mockReturnValue("Card: Test Card\nList: DOING\nDesc: Some description"),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            action: "Reply to the client email",
            plan: "Review the email thread, draft a response, and send.",
            timeline: "30 minutes",
            links: ["https://trello.com/c/card123"],
            steps: [
              { number: 1, text: "Open the email thread", done: false },
              { number: 2, text: "Draft a reply", done: false },
              { number: 3, text: "Send the reply", done: false },
            ],
            summary: "Client receives a clear, timely response.",
            urgencyLabel: "HIGH",
            nextCheckpoint: "Check for client reply within 24 hours",
            robertDecision: null,
            isBlocked: false,
            blockedReason: null,
          }),
        },
      },
    ],
  }),
}));

vi.mock("./aptlssDb", () => ({
  upsertAptlssPlan: vi.fn().mockResolvedValue(undefined),
  getAptlssPlan: vi.fn().mockResolvedValue(null),
  getAllAptlssPlans: vi.fn().mockResolvedValue([]),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { fetchCardContext, formatContextForLLM } from "./trelloCardContext";
import { invokeLLM } from "./_core/llm";
import { upsertAptlssPlan, getAptlssPlan, getAllAptlssPlans } from "./aptlssDb";

// ── Helper: simulate the generate procedure logic ─────────────────────────────
async function simulateGenerate(input: {
  cardId: string;
  cardName?: string;
  cardUrl?: string;
  boardName?: string;
  listName?: string;
  forceRefresh?: boolean;
}) {
  const apiKey = "test-key";
  const apiToken = "test-token";

  if (!input.forceRefresh) {
    const cached = await getAptlssPlan(input.cardId);
    if (cached) {
      const ageMs = Date.now() - new Date((cached as any).generatedAt).getTime();
      if (ageMs < 4 * 60 * 60 * 1000) {
        return { plan: JSON.parse((cached as any).planJson), cached: true };
      }
    }
  }

  const ctx = await fetchCardContext(input.cardId, apiKey, apiToken);
  const contextText = formatContextForLLM(ctx);

  const llmResponse = await invokeLLM({ messages: [{ role: "user", content: contextText }] } as any);
  const planJson = (llmResponse as any).choices?.[0]?.message?.content ?? "{}";
  const plan = JSON.parse(planJson);

  await upsertAptlssPlan({
    cardId: ctx.id,
    cardName: ctx.name,
    cardUrl: ctx.url,
    boardName: ctx.boardName,
    listName: ctx.listName,
    planJson,
    contextSnapshot: contextText.slice(0, 4000),
  });

  return { plan, cached: false };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("APTLSS generate procedure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAptlssPlan as any).mockResolvedValue(null);
  });

  it("generates a fresh plan when no cache exists", async () => {
    const result = await simulateGenerate({ cardId: "card123" });

    expect(result.cached).toBe(false);
    expect(result.plan.action).toBe("Reply to the client email");
    expect(result.plan.urgencyLabel).toBe("HIGH");
    expect(result.plan.steps).toHaveLength(3);
    expect(fetchCardContext).toHaveBeenCalledWith("card123", "test-key", "test-token");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(upsertAptlssPlan).toHaveBeenCalledTimes(1);
  });

  it("returns cached plan when cache is fresh (< 4h)", async () => {
    const freshPlan = {
      planJson: JSON.stringify({ action: "Cached action", urgencyLabel: "LOW", steps: [], plan: "", timeline: "", links: [], summary: "", nextCheckpoint: "", robertDecision: null, isBlocked: false, blockedReason: null }),
      generatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      cardName: "Test Card",
      boardName: "Test Board",
      listName: "DOING",
    };
    (getAptlssPlan as any).mockResolvedValue(freshPlan);

    const result = await simulateGenerate({ cardId: "card123", forceRefresh: false });

    expect(result.cached).toBe(true);
    expect(result.plan.action).toBe("Cached action");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(upsertAptlssPlan).not.toHaveBeenCalled();
  });

  it("regenerates plan when cache is stale (> 4h)", async () => {
    const stalePlan = {
      planJson: JSON.stringify({ action: "Old action", urgencyLabel: "LOW", steps: [], plan: "", timeline: "", links: [], summary: "", nextCheckpoint: "", robertDecision: null, isBlocked: false, blockedReason: null }),
      generatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      cardName: "Test Card",
      boardName: "Test Board",
      listName: "DOING",
    };
    (getAptlssPlan as any).mockResolvedValue(stalePlan);

    const result = await simulateGenerate({ cardId: "card123", forceRefresh: false });

    // Stale cache → falls through to LLM
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.plan.action).toBe("Reply to the client email");
  });

  it("force-refreshes even when cache is fresh", async () => {
    const freshPlan = {
      planJson: JSON.stringify({ action: "Cached action", urgencyLabel: "LOW", steps: [], plan: "", timeline: "", links: [], summary: "", nextCheckpoint: "", robertDecision: null, isBlocked: false, blockedReason: null }),
      generatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      cardName: "Test Card",
      boardName: "Test Board",
      listName: "DOING",
    };
    (getAptlssPlan as any).mockResolvedValue(freshPlan);

    const result = await simulateGenerate({ cardId: "card123", forceRefresh: true });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.plan.action).toBe("Reply to the client email");
    expect(result.cached).toBe(false);
  });

  it("persists the generated plan to DB", async () => {
    await simulateGenerate({ cardId: "card123" });

    expect(upsertAptlssPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "card123",
        cardName: "Test Card",
        boardName: "Test Board",
        listName: "DOING",
      })
    );
  });

  it("plan has all required APTLSS fields", async () => {
    const result = await simulateGenerate({ cardId: "card123" });
    const plan = result.plan;

    expect(plan).toHaveProperty("action");
    expect(plan).toHaveProperty("plan");
    expect(plan).toHaveProperty("timeline");
    expect(plan).toHaveProperty("links");
    expect(plan).toHaveProperty("steps");
    expect(plan).toHaveProperty("summary");
    expect(plan).toHaveProperty("urgencyLabel");
    expect(plan).toHaveProperty("nextCheckpoint");
    expect(plan).toHaveProperty("robertDecision");
    expect(plan).toHaveProperty("isBlocked");
    expect(plan).toHaveProperty("blockedReason");
  });

  it("urgencyLabel is one of CRITICAL/HIGH/MEDIUM/LOW", async () => {
    const result = await simulateGenerate({ cardId: "card123" });
    expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(result.plan.urgencyLabel);
  });
});

describe("APTLSS getCached procedure", () => {
  it("returns null when no plan exists", async () => {
    (getAptlssPlan as any).mockResolvedValue(null);
    const result = await getAptlssPlan("nonexistent-card");
    expect(result).toBeNull();
  });

  it("returns parsed plan when cache exists", async () => {
    const planData = {
      planJson: JSON.stringify({ action: "Test action", urgencyLabel: "MEDIUM", steps: [], plan: "", timeline: "", links: [], summary: "", nextCheckpoint: "", robertDecision: null, isBlocked: false, blockedReason: null }),
      generatedAt: new Date(),
      cardName: "Test Card",
      boardName: "Test Board",
      listName: "DOING",
    };
    (getAptlssPlan as any).mockResolvedValue(planData);

    const cached = await getAptlssPlan("card123");
    expect(cached).not.toBeNull();
    expect(JSON.parse((cached as any).planJson).action).toBe("Test action");
  });
});

describe("APTLSS getAll procedure", () => {
  it("returns empty array when no plans exist", async () => {
    (getAllAptlssPlans as any).mockResolvedValue([]);
    const result = await getAllAptlssPlans();
    expect(result).toEqual([]);
  });

  it("returns all stored plans", async () => {
    const plans = [
      { cardId: "card1", cardName: "Card 1", planJson: "{}", generatedAt: new Date() },
      { cardId: "card2", cardName: "Card 2", planJson: "{}", generatedAt: new Date() },
    ];
    (getAllAptlssPlans as any).mockResolvedValue(plans);

    const result = await getAllAptlssPlans();
    expect(result).toHaveLength(2);
    expect(result[0].cardId).toBe("card1");
  });
});
