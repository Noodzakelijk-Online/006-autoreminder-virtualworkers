type ApprovalStepInput = {
  title?: string | null;
  completionCriteria?: string | null;
  category?: string | null;
  requiresRobert?: unknown;
  recommendedDecision?: string | null;
};

const EXPLICIT_DECISION_PATTERN = /\b(?:ask|request|await|obtain|get|secure|confirm|approve|approval|decide|decision|choose|sign[- ]?off|authori[sz](?:e|ation))\b.{0,100}\b(?:robert|legal|contract|payment|financial|invoice|purchase|budget|scope|pricing?|permission|consent|position)\b|\brobert\b.{0,100}\b(?:approve|approval|decide|decision|confirm|choose|sign[- ]?off|authori[sz](?:e|ation))\b/i;

function explicitBoolean(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function stepRequiresRobertApproval(
  step: ApprovalStepInput,
  options: { trustExplicit?: boolean; trustCategory?: boolean; explicitFalseWins?: boolean } = {},
) {
  if (step.recommendedDecision?.trim()) return true;
  if ((options.trustCategory ?? true) && step.category === "robert_decision") return true;

  const explicit = explicitBoolean(step.requiresRobert);
  if (options.explicitFalseWins && explicit === false) return false;

  const decisionText = `${step.title ?? ""} ${step.completionCriteria ?? ""}`.trim();
  if (EXPLICIT_DECISION_PATTERN.test(decisionText)) return true;

  if ((options.trustExplicit ?? true) && explicit !== null) return explicit;
  return false;
}

export function inferNonRobertStepCategory(title: string) {
  if (/\b(follow[ -]?up|reply|contact|reminder)\b/i.test(title)) return "external_follow_up";
  if (/\b(post|status update|comment|communicat|send update)\b/i.test(title)) return "communication";
  if (/\b(verify|verification|acceptance criteria|quality|qa|test|review)\b/i.test(title)) return "verification";
  return "internal_work";
}
