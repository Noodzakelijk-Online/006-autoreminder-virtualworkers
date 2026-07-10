import type { AptlssAssessment } from "./aptlssAssessment";

const CATEGORIES = new Set(["internal_work", "external_follow_up", "robert_decision", "verification", "communication"]);
const APPROVAL_PATTERN = /\b(legal|contract|payment|financial|invoice|purchase|budget|scope approval)\b/i;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, numeric));
}

export function normalizeGeneratedAptlssPlan(
  raw: Record<string, unknown>,
  assessment: AptlssAssessment,
  source: "ai" | "deterministic",
) {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps = rawSteps
    .filter((step): step is Record<string, unknown> => Boolean(step && typeof step === "object"))
    .map((step) => {
      const title = text(step.text || step.title).slice(0, 240);
      const dedupeKey = title.toLowerCase().replace(/\s+/g, " ");
      if (!title || seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      const combined = `${title} ${text(step.completionCriteria)} ${text(step.riskIfSkipped)}`;
      const requiresRobert = Boolean(step.requiresRobert) || APPROVAL_PATTERN.test(combined);
      const requestedCategory = text(step.category, "internal_work");
      const category = requiresRobert ? "robert_decision" : CATEGORIES.has(requestedCategory) ? requestedCategory : "internal_work";
      return {
        number: 0,
        text: title,
        done: Boolean(step.done),
        estimatedMinutes: integer(step.estimatedMinutes, 15, 5, 240),
        category,
        requiresRobert,
        blockedBy: text(step.blockedBy) || null,
        dependsOnCards: Array.isArray(step.dependsOnCards)
          ? Array.from(new Set(step.dependsOnCards.map((item) => text(item)).filter(Boolean))).slice(0, 20)
          : [],
        completionCriteria: text(step.completionCriteria, `Evidence exists that "${title}" is complete.`).slice(0, 600),
        riskIfSkipped: text(step.riskIfSkipped, "The card may remain incomplete or its status may become unreliable.").slice(0, 600),
        recommendedDecision: requiresRobert ? text(step.recommendedDecision) || null : null,
      };
    })
    .filter((step): step is NonNullable<typeof step> => step !== null)
    .slice(0, 12)
    .map((step, index) => ({ ...step, number: index + 1 }));

  if (steps.length < 3) warnings.push("Fewer than three distinct executable steps were generated.");
  while (steps.length < 2) {
    const title = assessment.recommendations[steps.length] ?? (steps.length === 0
      ? "Clarify the concrete deliverable and its acceptance criteria."
      : "Complete the smallest useful work unit and record evidence.");
    steps.push({
      number: steps.length + 1,
      text: title,
      done: false,
      estimatedMinutes: 15,
      category: "internal_work",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: `Evidence exists that "${title}" is complete.`,
      riskIfSkipped: "The plan remains too vague to execute reliably.",
      recommendedDecision: null,
    });
  }
  if (!steps.some((step) => step.category === "verification")) {
    const verificationStep = {
      number: Math.min(12, steps.length + 1),
      text: "Verify the result against the card's completion criteria.",
      done: false,
      estimatedMinutes: 15,
      category: "verification",
      requiresRobert: false,
      blockedBy: null,
      dependsOnCards: [],
      completionCriteria: "Verification evidence is recorded before the card is reported complete.",
      riskIfSkipped: "Incomplete work may be reported as done.",
      recommendedDecision: null,
    };
    if (steps.length >= 12) steps[steps.length - 1] = verificationStep;
    else steps.push(verificationStep);
  }

  const fallbackAction = steps.find((step) => !step.requiresRobert && !step.blockedBy)?.text
    ?? assessment.recommendations[0]
    ?? "Clarify the next executable action.";
  const action = text(raw.nextBestAction || raw.action, fallbackAction).slice(0, 500);
  const rawConfidence = integer(raw.confidenceScore, assessment.confidenceScore, 0, 100);
  const confidenceScore = Math.min(rawConfidence, assessment.confidenceScore + 5);
  if (confidenceScore < rawConfidence) warnings.push("Model confidence was capped by available evidence.");
  if (assessment.confidenceScore < 60) warnings.push("Underlying card evidence is insufficient for autonomous execution.");
  const assessedUrgency = assessment.priorityTier === "CRITICAL" ? "CRITICAL"
    : assessment.priorityTier === "HIGH" ? "HIGH"
      : assessment.priorityTier === "MEDIUM" ? "MEDIUM"
        : "LOW";
  const rawUrgency = text(raw.urgencyLabel).toUpperCase();
  const urgencyRank: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const urgencyLabel = (urgencyRank[assessedUrgency] ?? 1) > (urgencyRank[rawUrgency] ?? 0) ? assessedUrgency : rawUrgency || assessedUrgency;
  const links = Array.from(new Set([
    ...(Array.isArray(raw.links) ? raw.links.map((item) => text(item)).filter(Boolean) : []),
  ])).slice(0, 10);
  const isBlocked = assessment.actionability === "blocked" || Boolean(raw.isBlocked);
  const requiresRobert = assessment.actionability === "decision" || steps.some((step) => step.requiresRobert);

  return {
    ...raw,
    action,
    nextBestAction: action,
    plan: text(raw.plan, `Use the evidence-backed ${assessment.primaryState} assessment to move the card forward safely.`),
    timeline: text(raw.timeline, `${steps.reduce((sum, step) => sum + step.estimatedMinutes, 0)} estimated minutes across ${steps.length} steps.`),
    links,
    steps,
    summary: text(raw.summary, "The defined outcome is completed, verified, and communicated with evidence."),
    urgencyLabel,
    nextCheckpoint: text(raw.nextCheckpoint, assessment.nextAssessmentAt),
    robertDecision: requiresRobert ? text(raw.robertDecision) || steps.find((step) => step.requiresRobert)?.recommendedDecision || null : null,
    isBlocked,
    blockedReason: isBlocked ? text(raw.blockedReason, assessment.stateReason) : null,
    confidenceScore,
    confidenceReason: `${text(raw.confidenceReason, "Plan confidence calibrated against card evidence.")} Evidence calibration: ${assessment.confidenceReason}`,
    escalationCategory: confidenceScore < 60 ? "low_confidence" : raw.escalationCategory ?? null,
    assessment: {
      engineVersion: assessment.engineVersion,
      contextHash: assessment.contextHash,
      primaryState: assessment.primaryState,
      secondarySignals: assessment.secondarySignals,
      actionability: assessment.actionability,
      priorityScore: assessment.priorityScore,
      priorityTier: assessment.priorityTier,
      evidenceConfidence: assessment.confidenceScore,
      uncertainties: assessment.uncertainties,
      recommendations: assessment.recommendations,
      assessedAt: assessment.assessedAt,
      nextAssessmentAt: assessment.nextAssessmentAt,
    },
    generation: { source, normalizedAt: new Date().toISOString(), warnings },
  };
}
