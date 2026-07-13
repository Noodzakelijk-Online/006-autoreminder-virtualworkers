import { getPolicyBoolean } from "./aptlssPoliciesDb";
import { getCardState, getCardStepProgress } from "./aptlssStepsDb";
import { fetchCardContext } from "./trelloCardContext";

export async function getDoneGateStatus(cardId: string) {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  if (!apiKey || !apiToken) return { ready: false, missing: ["Trello credentials not configured"] };

  const [ctx, progress, state, requireSummary, requireChecklist, requireNoUnanswered] = await Promise.all([
    fetchCardContext(cardId, apiKey, apiToken),
    getCardStepProgress(cardId),
    getCardState(cardId),
    getPolicyBoolean("done_gate_require_summary", true),
    getPolicyBoolean("done_gate_require_checklist_complete", true),
    getPolicyBoolean("done_gate_require_no_unanswered", true),
  ]);
  const missing: string[] = [];

  if (requireChecklist && progress.total > 0 && progress.completed < progress.total) {
    missing.push(`${progress.total - progress.completed} APTLSS checklist item(s) not yet complete`);
  }
  if (progress.openRobert > 0) missing.push(`${progress.openRobert} Robert decision(s) still open`);
  if (requireSummary && !state?.hasFinalSummary) missing.push("No final summary comment posted on the card");
  if (ctx.attachments.length === 0) missing.push("No attachments or proof of completion linked");
  if (progress.openBlocked > 0) missing.push(`${progress.openBlocked} step(s) still blocked by other cards`);
  if (requireNoUnanswered && state?.hasUnansweredQuestion) missing.push("Latest comment contains an unanswered question");

  return {
    ready: missing.length === 0,
    missing,
    cardState: state?.state ?? null,
    progress,
    policies: { requireSummary, requireChecklist, requireNoUnanswered },
  };
}
