import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkQueueDashboard } from "./WorkQueueDashboard";
import type { WorkQueueSourceData } from "@/lib/workQueue";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    aptlss: {
      getWorkQueueContext: { useQuery: vi.fn(() => ({ data: undefined })) },
      getCardAuditLog: { useQuery: vi.fn(() => ({ data: [] })) },
      getDailyPlan: { useQuery: vi.fn(() => ({ data: undefined })) },
      getDecisionQueue: { useQuery: vi.fn(() => ({ data: { items: [] } })) },
    },
    timer: {
      getDailySummary: { useQuery: vi.fn(() => ({ data: [] })) },
      getActive: { useQuery: vi.fn(() => ({ data: null })) },
    },
    system: {
      readiness: { useQuery: vi.fn(() => ({ data: undefined })) },
    },
  },
}));

const sourceData: WorkQueueSourceData = {
  overdueCards: [
    {
      id: "overdue-1",
      name: "Past due client deliverable",
      url: "https://trello.example/overdue-1",
      boardName: "Client Board",
      listName: "Doing",
      due: "2026-07-08T08:00:00.000Z",
      dateLastActivity: "2026-07-07T08:00:00.000Z",
    },
  ],
  doingCards: [
    {
      id: "doing-1",
      name: "Homepage QA update",
      url: "https://trello.example/doing-1",
      boardName: "Website Board",
      listName: "In Progress",
      due: "2026-07-10T08:00:00.000Z",
      dateLastActivity: "2026-07-08T08:00:00.000Z",
      updatedToday: false,
    },
  ],
  onHoldCards: [
    {
      id: "hold-1",
      name: "Pricing copy decision",
      url: "https://trello.example/hold-1",
      boardName: "Robert",
      listName: "On Hold",
      due: null,
      dateLastActivity: "2026-07-06T08:00:00.000Z",
    },
  ],
};

function renderDashboard(overrides: Partial<React.ComponentProps<typeof WorkQueueDashboard>> = {}) {
  return renderToStaticMarkup(
    React.createElement(WorkQueueDashboard, {
      actionData: sourceData,
      actionsLoading: false,
      activeTimerCardId: null,
      timerBusy: false,
      onNavigate: vi.fn(),
      onOpenPlan: vi.fn(),
      onStartTimer: vi.fn(),
      ...overrides,
    }),
  );
}

describe("WorkQueueDashboard", () => {
  it("renders a focused Now panel, compact next-up list, and collapsible triage lanes", () => {
    const html = renderDashboard();

    expect(html).toContain("Now");
    expect(html).toContain("Past due client deliverable");
    expect(html).toContain("Resolve the overdue blocker");
    expect(html).toContain("Next up (2)");
    expect(html).toContain("Homepage QA update");
    expect(html).toContain("Triage lanes");
    expect(html).toContain("Start timer");
    expect(html).not.toContain("Open Trello");
    expect(html).toContain("Open details for context and secondary actions.");
    expect(html).not.toContain("Queue health");
  });

  it("keeps deeper card actions out of the first render until a card is inspected", () => {
    const html = renderDashboard();

    expect(html).not.toContain("Secondary actions");
    expect(html).not.toContain("Recommended workflow");
    expect(html).not.toContain("State trail");
  });

  it("renders Trello setup as a first-class degraded state", () => {
    const html = renderDashboard({
      actionData: undefined,
      trelloDisabledReason: "Configure Trello credentials before live activity can load.",
    });

    expect(html).toContain("Trello setup needed");
    expect(html).toContain("Configure Trello credentials before live activity can load.");
    expect(html).toContain("Open Settings");
  });

  it("renders loading and unavailable queue states without falling back to a mixed feed", () => {
    const loadingHtml = renderDashboard({ actionData: undefined, actionsLoading: true });
    const errorHtml = renderDashboard({
      actionData: undefined,
      actionsError: { message: "Trello request failed" },
    });

    expect(loadingHtml).toContain("animate-pulse");
    expect(loadingHtml).not.toContain("Next up (0)");
    expect(loadingHtml).not.toContain("0 cards need attention");
    expect(loadingHtml).not.toContain("No more queued items");
    expect(errorHtml).toContain("Work queue unavailable");
    expect(errorHtml).toContain("Trello request failed");
  });

  it("shows the interpreted waiting action and disables execution before its checkpoint", () => {
    const html = renderDashboard({
      actionData: { onHoldCards: sourceData.onHoldCards },
      waitingReasons: [{
        cardId: "hold-1",
        waitingOn: "external_party",
        waitingOnName: "Sarah",
        nextAction: "Schedule a follow-up with Sarah for the signed pricing approval.",
        followUpAt: "2099-07-13T07:00:00.000Z",
        urgency: "high",
        interpretationValue: { summary: "Waiting on Sarah to approve the pricing copy." },
      }],
    });

    expect(html).toContain("Schedule a follow-up with Sarah");
    expect(html).toContain("Waiting on Sarah");
    expect(html).toContain("Waiting</button>");
    expect(html).not.toContain("Start timer");
  });

  it("keeps Sunday visible but requires an explicit emergency start", () => {
    const html = renderDashboard({ protectedDay: true });

    expect(html).toContain("protected day off");
    expect(html).toContain("Start emergency timer");
  });

  it("makes an active timer switch explicit", () => {
    const html = renderDashboard({ activeTimerCardId: "another-card", activeTimerCardName: "Existing work" });

    expect(html).toContain("Switch timer");
    expect(html).not.toContain(">Start timer</button>");
  });
});
