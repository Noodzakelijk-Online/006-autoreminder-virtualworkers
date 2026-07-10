type LiveExceptions = {
  overdueCards: unknown[];
  doingCards: Array<{ updatedToday?: boolean }>;
  onHoldCards: unknown[];
};

type CommandExceptions = {
  criticalToday: unknown[];
  waitingExternal: unknown[];
  onHoldCards: Array<{ onHoldClassification?: string | null }>;
};

export function getOperationalExceptionCounts(live?: LiveExceptions, command?: CommandExceptions) {
  if (live) {
    return {
      critical: live.overdueCards.length,
      waiting: live.doingCards.filter((item) => !item.updatedToday).length,
      blocked: live.onHoldCards.length,
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
