type LiveExceptions = {
  overdueCards: Array<{ id: string }>;
  doingCards: Array<{ id: string; updatedToday?: boolean }>;
  onHoldCards: Array<{ id: string }>;
};

type CommandExceptions = {
  criticalToday: unknown[];
  waitingExternal: unknown[];
  onHoldCards: Array<{ onHoldClassification?: string | null }>;
};

export function getOperationalExceptionCounts(live?: LiveExceptions, command?: CommandExceptions) {
  if (live) {
    // Match Work Queue lane precedence so one Trello card is never presented as
    // several separate operational exceptions across the application.
    const overdueIds = new Set(live.overdueCards.map((item) => item.id));
    const doingIds = new Set(
      live.doingCards
        .filter((item) => !item.updatedToday && !overdueIds.has(item.id))
        .map((item) => item.id),
    );
    const onHoldIds = new Set(
      live.onHoldCards
        .filter((item) => !overdueIds.has(item.id) && !doingIds.has(item.id))
        .map((item) => item.id),
    );
    return {
      critical: overdueIds.size,
      waiting: doingIds.size,
      blocked: onHoldIds.size,
      source: "live" as const,
    };
  }
  return {
    critical: command?.criticalToday.length ?? 0,
    waiting: command?.waitingExternal.length ?? 0,
    blocked: command?.onHoldCards.filter((item) => item.onHoldClassification === "needs_escalation").length ?? 0,
    source: "aptlss_fallback" as const,
  };
}
