export type QualityStep = {
  number?: number;
  text: string;
  estimatedMinutes: number;
  category: string;
  requiresRobert: boolean;
  blockedBy?: string | null;
  dependsOnCards?: string[];
  completionCriteria?: string | null;
  riskIfSkipped?: string | null;
};

export type PlanQualityIssue = {
  code: string;
  severity: "warning" | "error";
  message: string;
  stepNumber?: number;
};

export type AptlssPlanQuality = {
  score: number;
  passed: boolean;
  hardGateFailed: boolean;
  dimensions: {
    executability: number;
    specificity: number;
    verification: number;
    estimation: number;
    dependencyHygiene: number;
    approvalSafety: number;
  };
  issues: PlanQualityIssue[];
  repairRecommendations: string[];
};

const VAGUE_ACTION = /^(work on|handle|manage|review|follow up|continue|complete task|do this|check|fix|update)$/i;
const APPROVAL_PATTERN = /\b(legal|contract|payment|financial|invoice|purchase|budget|scope approval|publish|send final)\b/i;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function meaningfulText(value: string | null | undefined, minimum: number) {
  return Boolean(value?.trim() && value.trim().length >= minimum);
}

export function evaluateAptlssPlanQuality({ action, steps }: { action: string; steps: QualityStep[] }): AptlssPlanQuality {
  const issues: PlanQualityIssue[] = [];
  const openExecutable = steps.filter((step) => !step.requiresRobert && !step.blockedBy && step.category !== "verification");
  const hasVerification = steps.some((step) => step.category === "verification");
  const approvalLeaks = steps.filter((step) => APPROVAL_PATTERN.test(`${step.text} ${step.riskIfSkipped ?? ""}`) && !step.requiresRobert);
  const duplicateTitles = steps.length - new Set(steps.map((step) => step.text.trim().toLowerCase().replace(/\s+/g, " "))).size;
  const vagueSteps = steps.filter((step) => !meaningfulText(step.text, 8) || VAGUE_ACTION.test(step.text.trim()));
  const weakCriteria = steps.filter((step) => !meaningfulText(step.completionCriteria, 16));
  const missingRisk = steps.filter((step) => !meaningfulText(step.riskIfSkipped, 12));
  const invalidEstimates = steps.filter((step) => !Number.isFinite(step.estimatedMinutes) || step.estimatedMinutes < 5 || step.estimatedMinutes > 240);
  const invalidDependencies = steps.filter((step) => (step.dependsOnCards ?? []).some((dependency) => !dependency.trim()));

  if (!action.trim()) issues.push({ code: "missing_next_action", severity: "error", message: "The plan has no next action." });
  else if (VAGUE_ACTION.test(action.trim())) issues.push({ code: "vague_next_action", severity: "error", message: "The next action is not specific enough to execute." });
  if (!openExecutable.length) issues.push({ code: "no_executable_step", severity: "error", message: "No unblocked internal step can be started now." });
  if (!hasVerification) issues.push({ code: "missing_verification", severity: "error", message: "The plan has no verification gate." });
  for (const step of approvalLeaks) issues.push({ code: "approval_boundary", severity: "error", message: "Approval-sensitive work is not gated behind Robert.", stepNumber: step.number });
  if (duplicateTitles) issues.push({ code: "duplicate_steps", severity: "warning", message: `${duplicateTitles} duplicate step(s) reduce plan precision.` });
  for (const step of vagueSteps) issues.push({ code: "vague_step", severity: "warning", message: "Step text is too vague to execute reliably.", stepNumber: step.number });
  for (const step of weakCriteria) issues.push({ code: "weak_completion_criteria", severity: "warning", message: "Completion criteria are missing or not observable.", stepNumber: step.number });
  for (const step of missingRisk) issues.push({ code: "missing_skip_risk", severity: "warning", message: "The consequence of skipping this step is unclear.", stepNumber: step.number });
  for (const step of invalidEstimates) issues.push({ code: "invalid_estimate", severity: "error", message: "Estimate must be between 5 and 240 minutes.", stepNumber: step.number });
  for (const step of invalidDependencies) issues.push({ code: "invalid_dependency", severity: "error", message: "A dependency reference is empty.", stepNumber: step.number });

  const dimensions = {
    executability: clamp((action.trim() ? 10 : 0) + (openExecutable.length ? 10 : 0), 0, 20),
    specificity: clamp(20 - vagueSteps.length * 5 - duplicateTitles * 4, 0, 20),
    verification: hasVerification ? clamp(15 - weakCriteria.filter((step) => step.category === "verification").length * 5, 0, 15) : 0,
    estimation: clamp(15 - invalidEstimates.length * 5, 0, 15),
    dependencyHygiene: clamp(15 - invalidDependencies.length * 5 - steps.filter((step) => step.blockedBy && !(step.dependsOnCards ?? []).length).length * 2, 0, 15),
    approvalSafety: clamp(15 - approvalLeaks.length * 15, 0, 15),
  };
  const score = clamp(Object.values(dimensions).reduce((sum, value) => sum + value, 0) - Math.min(10, missingRisk.length * 2));
  const hardGateFailed = issues.some((issue) => issue.severity === "error");
  const repairRecommendations = Array.from(new Set(issues.map((issue) => {
    if (issue.code === "missing_next_action" || issue.code === "vague_next_action") return "Rewrite the next action as one observable verb-object outcome.";
    if (issue.code === "no_executable_step") return "Add one unblocked internal step that Joyce can begin immediately.";
    if (issue.code === "missing_verification") return "Add a final verification step with observable acceptance evidence.";
    if (issue.code === "approval_boundary") return "Move approval-sensitive work into a Robert decision step.";
    if (issue.code.includes("estimate")) return "Split or re-estimate steps into 5-240 minute work units.";
    if (issue.code.includes("dependency")) return "Replace vague dependencies with valid card IDs.";
    return "Make each step specific, measurable, and evidence-producing.";
  })));

  return {
    score,
    passed: score >= 75 && !hardGateFailed,
    hardGateFailed,
    dimensions,
    issues,
    repairRecommendations,
  };
}
