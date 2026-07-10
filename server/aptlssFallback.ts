import type { TrelloCardContext } from "./aptlssEngine";

type AptlssFallbackPlan = {
  action: string;
  plan: string;
  timeline: string;
  links: string[];
  steps: Array<{
    number: number;
    text: string;
    done: boolean;
    estimatedMinutes: number;
    category: string;
    requiresRobert: boolean;
    blockedBy: string | null;
    dependsOnCards: string[];
    completionCriteria: string;
    riskIfSkipped: string;
    recommendedDecision: string | null;
  }>;
  summary: string;
  urgencyLabel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  nextCheckpoint: string;
  robertDecision: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  confidenceScore: number;
  confidenceReason: string;
  nextBestAction: string;
  escalationCategory:
    | null
    | "money_decision"
    | "legal_approval"
    | "scope_change"
    | "worker_performance"
    | "deadline_risk"
    | "contradiction"
    | "low_confidence";
};

function containsAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function isOverdue(due: string | null | undefined) {
  return Boolean(due && new Date(due).getTime() < Date.now());
}

function urgencyFor(ctx: TrelloCardContext): AptlssFallbackPlan["urgencyLabel"] {
  const haystack = `${ctx.name} ${ctx.desc} ${ctx.listName} ${ctx.labels.map((label) => label.name).join(" ")}`;
  if (isOverdue(ctx.due) || containsAny(haystack, [/urgent/i, /critical/i, /asap/i, /blocked/i])) return "CRITICAL";
  if (ctx.due || containsAny(haystack, [/client/i, /deadline/i, /today/i, /high/i])) return "HIGH";
  if (containsAny(haystack, [/admin/i, /later/i, /low/i])) return "LOW";
  return "MEDIUM";
}

function robertDecisionFor(ctx: TrelloCardContext) {
  const haystack = `${ctx.name} ${ctx.desc} ${ctx.labels.map((label) => label.name).join(" ")}`;
  if (containsAny(haystack, [/price/i, /pricing/i, /budget/i, /payment/i, /invoice/i, /money/i])) {
    return "Confirm the pricing, budget, or payment decision before committing externally.";
  }
  if (containsAny(haystack, [/legal/i, /contract/i, /terms/i, /approval/i, /approve/i])) {
    return "Confirm the approval or legal position before proceeding.";
  }
  if (!ctx.desc?.trim()) {
    return "Confirm the success criteria because the card does not contain enough detail.";
  }
  return null;
}

export function buildDeterministicAptlssPlan(
  ctx: TrelloCardContext,
  reason = "AI planner unavailable",
): AptlssFallbackPlan {
  const cardName = ctx.name?.trim() || "this Trello card";
  const hasDescription = Boolean(ctx.desc?.trim());
  const robertDecision = robertDecisionFor(ctx);
  const urgencyLabel = urgencyFor(ctx);
  const lowConfidence = !hasDescription || Boolean(robertDecision);
  const firstAction = hasDescription
    ? `Define the next concrete deliverable for "${cardName}" from the current Trello context.`
    : `Ask for the missing success criteria for "${cardName}" before doing execution work.`;
  const dueText = ctx.due ? ` Due: ${new Date(ctx.due).toISOString().slice(0, 10)}.` : "";
  const descriptionSource = hasDescription ? "description, comments, checklist, and attachments" : "card title, list, labels, comments, and attachments";

  const steps: AptlssFallbackPlan["steps"] = [
    {
      number: 1,
      text: hasDescription
        ? `Extract acceptance criteria for "${cardName}" from Trello.`
        : `Request clear acceptance criteria for "${cardName}".`,
      done: false,
      estimatedMinutes: hasDescription ? 15 : 10,
      category: hasDescription ? "internal_work" : "robert_decision",
      requiresRobert: !hasDescription,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "A short success checklist exists before execution continues.",
      riskIfSkipped: "Joyce may spend time on work that does not match Robert's expected outcome.",
      recommendedDecision: !hasDescription ? "Ask Robert for a one-sentence definition of done before starting." : null,
    },
    {
      number: 2,
      text: `Identify the next deliverable and blockers for "${cardName}".`,
      done: false,
      estimatedMinutes: 15,
      category: "internal_work",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "Next deliverable, known blocker, and owner are written down.",
      riskIfSkipped: "The card can appear active while the real blocker remains hidden.",
      recommendedDecision: null,
    },
    {
      number: 3,
      text: `Complete the smallest useful progress step for "${cardName}".`,
      done: false,
      estimatedMinutes: urgencyLabel === "CRITICAL" ? 45 : 30,
      category: "internal_work",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "The card has a visible deliverable, draft, test result, or status update.",
      riskIfSkipped: "The card stays stale without evidence of progress.",
      recommendedDecision: null,
    },
    {
      number: 4,
      text: `Verify "${cardName}" against the acceptance criteria.`,
      done: false,
      estimatedMinutes: 15,
      category: "verification",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "A quick QA note or checklist result confirms what was verified.",
      riskIfSkipped: "Incomplete or incorrect work may be reported as finished.",
      recommendedDecision: null,
    },
    {
      number: 5,
      text: `Post or prepare the next status update for "${cardName}".`,
      done: false,
      estimatedMinutes: 10,
      category: "communication",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "The next action, blocker, or completion status is ready to communicate.",
      riskIfSkipped: "Robert and external stakeholders may not know the real card state.",
      recommendedDecision: null,
    },
  ];

  if (robertDecision) {
    steps.splice(1, 0, {
      number: 2,
      text: `Get Robert decision for "${cardName}".`,
      done: false,
      estimatedMinutes: 10,
      category: "robert_decision",
      requiresRobert: true,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "Robert's decision is captured before external commitment.",
      riskIfSkipped: "Joyce may make a decision outside the allowed approval boundary.",
      recommendedDecision: robertDecision,
    });
  }

  const normalizedSteps = steps.map((step, index) => ({ ...step, number: index + 1 }));
  const links = [ctx.url, ...ctx.attachments.map((attachment) => attachment.url)].filter(Boolean).slice(0, 5);

  return {
    action: firstAction,
    plan: `Use the current Trello ${descriptionSource} to move "${cardName}" forward in the ${ctx.listName || "current"} list.${dueText} This deterministic plan was generated because ${reason}.`,
    timeline: `${normalizedSteps.reduce((total, step) => total + step.estimatedMinutes, 0)} minutes across ${normalizedSteps.length} guarded steps.`,
    links,
    steps: normalizedSteps,
    summary: `"${cardName}" has a clear next action, visible progress, and an auditable status update.`,
    urgencyLabel,
    nextCheckpoint: urgencyLabel === "CRITICAL" ? "Check again after the next work block." : "Check again before the end-of-day update.",
    robertDecision,
    isBlocked: Boolean(robertDecision && !hasDescription),
    blockedReason: robertDecision && !hasDescription ? "Card needs Robert clarification before execution." : null,
    confidenceScore: lowConfidence ? 58 : 72,
    confidenceReason: lowConfidence
      ? "Generated without AI from limited Trello context; Robert review or clearer card detail is recommended."
      : "Generated without AI from available Trello context; enough card detail exists for a guarded execution path.",
    nextBestAction: firstAction,
    escalationCategory: !hasDescription ? "low_confidence" : robertDecision ? "scope_change" : null,
  };
}
