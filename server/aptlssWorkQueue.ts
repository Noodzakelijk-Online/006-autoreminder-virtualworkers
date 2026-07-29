type RobertStep = {
  title: string;
  recommendedDecision?: string | null;
};

export function selectWorkQueueNextAction(input: {
  planAction?: string | null;
  primaryState?: string | null;
  actionability?: string | null;
  recommendations?: string[] | null;
  openRobertStep?: RobertStep | null;
}) {
  const planAction = input.planAction?.trim() || null;
  const recommendation = input.recommendations?.find((item) => item.trim())?.trim() || null;
  const state = input.primaryState?.toUpperCase() ?? "";
  const actionability = input.actionability?.toLowerCase() ?? "";

  if (state === "WAITING_FOR_ROBERT" && input.openRobertStep) {
    const decision = input.openRobertStep.recommendedDecision?.trim() || input.openRobertStep.title.trim();
    return `Prepare Robert decision: ${decision}`;
  }

  const assessmentMustLead = ["decision", "waiting", "blocked", "repair"].includes(actionability)
    || /^(?:define|identify) the next concrete deliverable\b/i.test(planAction ?? "");
  if (assessmentMustLead && recommendation) return recommendation;
  return planAction ?? recommendation;
}
