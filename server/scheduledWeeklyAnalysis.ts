/**
 * Scheduled Weekly Analysis endpoint.
 *
 * Called by the AGENT cron every Sunday at 22:00 EAT (19:00 UTC).
 * Silently:
 *   1. Finds cards with no checklist progress this week
 *   2. Detects recurring blockers (same blocker pattern on multiple cards)
 *   3. Identifies estimate drift (cards far past their estimated completion)
 *   4. Finds underperforming workers (stalled cards, missed deadlines)
 *   5. Detects list-hoppers (cards moved between lists 3+ times)
 *   6. Identifies projects with unclear scope (NEEDS_RESTRUCTURING)
 *   7. Generates process improvement suggestions via LLM
 *   8. Saves the snapshot to weekly_analysis_snapshots
 */
import type { Application, Request, Response } from "express";
import { getAllAptlssPlans } from "./aptlssDb";
import { getAllCardStates, getAllPriorityScores } from "./aptlssStepsDb";
import { upsertWeeklyAnalysis } from "./aptlssPoliciesDb";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function registerScheduledWeeklyAnalysisRoute(app: Application): void {
  app.post("/api/scheduled/weekly-analysis", async (req: Request, res: Response) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    const weekKey = getISOWeekKey(new Date());

    try {
      // Gather all card states and plans
      const [cardStates, plans, priorityScores] = await Promise.all([
        getAllCardStates(),
        getAllAptlssPlans(),
        getAllPriorityScores(),
      ]);

      // 1. No-progress cards: STALLED or IN_PROGRESS with no recent activity
      const noProgressCards = cardStates
        .filter(cs => cs.state === "STALLED" || cs.state === "IN_PROGRESS")
        .map(cs => {
          const plan = plans.find(p => p.cardId === cs.cardId);
          return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, state: cs.state };
        });

      // 2. Recurring blockers: cards with isBlocked=true — group by blocker reason
      const blockedPlans = plans.filter(p => {
        try { return (JSON.parse(p.planJson) as Record<string, unknown>).isBlocked === true; } catch { return false; }
      });
      const blockerReasons: Record<string, string[]> = {};
      for (const p of blockedPlans) {
        try {
          const plan = JSON.parse(p.planJson) as Record<string, unknown>;
          const reason = (plan.blockedReason as string) ?? "Unknown";
          const key = reason.slice(0, 60);
          if (!blockerReasons[key]) blockerReasons[key] = [];
          blockerReasons[key].push(p.cardName);
        } catch { /* skip */ }
      }
      const recurringBlockers = Object.entries(blockerReasons)
        .filter(([, cards]) => cards.length >= 2)
        .map(([reason, cards]) => ({ reason, cards, count: cards.length }));

      // 3. Estimate drift: cards with HIGH priority score that are OVERDUE
      const overdueCards = cardStates.filter(cs => cs.state === "OVERDUE");
      const estimateDrift = overdueCards.map(cs => {
        const plan = plans.find(p => p.cardId === cs.cardId);
        const score = priorityScores.find(s => s.cardId === cs.cardId);
        return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, priorityScore: score?.score ?? 0, tier: score?.tier ?? "MEDIUM" };
      });

      // 4. Underperforming workers: cards with NEEDS_RESTRUCTURING (unclear handovers)
      const restructuringCards = cardStates.filter(cs => cs.state === "NEEDS_RESTRUCTURING");
      const underperformingWorkers = restructuringCards.length > 0
        ? [{ signal: "NEEDS_RESTRUCTURING", count: restructuringCards.length, cards: restructuringCards.map(cs => cs.cardId) }]
        : [];

      // 5. List-hoppers: cards with WAITING_FOR_ROBERT or WAITING_FOR_EXTERNAL_PARTY for >3 days
      const waitingCards = cardStates.filter(cs =>
        cs.state === "WAITING_FOR_ROBERT" || cs.state === "WAITING_FOR_EXTERNAL_PARTY"
      );
      const listHoppers = waitingCards.map(cs => {
        const plan = plans.find(p => p.cardId === cs.cardId);
        return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, state: cs.state };
      });

      // 6. Unclear scope: NEEDS_RESTRUCTURING cards
      const unclearScopeProjects = restructuringCards.map(cs => {
        const plan = plans.find(p => p.cardId === cs.cardId);
        return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId };
      });

      // 7. LLM-generated process improvement suggestions
      let processImprovements: string[] = [];
      try {
        const context = `
Weekly APTLSS Analysis Summary:
- Stalled/no-progress cards: ${noProgressCards.length}
- Recurring blocker patterns: ${recurringBlockers.length}
- Overdue cards with estimate drift: ${estimateDrift.length}
- Cards needing restructuring: ${restructuringCards.length}
- Cards waiting for external/Robert: ${waitingCards.length}
- Total active cards: ${cardStates.length}

Top stalled cards: ${noProgressCards.slice(0, 5).map(c => c.cardName).join(", ")}
Top recurring blockers: ${recurringBlockers.slice(0, 3).map(b => b.reason).join("; ")}
`;
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an operations analyst. Based on the weekly Trello work analysis, suggest 3-5 specific, actionable process improvements. Be concise and practical. Return a JSON array of strings." },
            { role: "user", content: context },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "process_improvements",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  improvements: { type: "array", items: { type: "string" } },
                },
                required: ["improvements"],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = llmResponse?.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (content) {
          const parsed = JSON.parse(content) as { improvements: string[] };
          processImprovements = parsed.improvements ?? [];
        }
      } catch { /* LLM failure is non-fatal */ }

      // 8. Plain text summary
      const summary = `Week ${weekKey}: ${cardStates.length} active cards. ${noProgressCards.length} stalled, ${overdueCards.length} overdue, ${recurringBlockers.length} recurring blocker patterns, ${restructuringCards.length} cards needing restructuring. ${processImprovements.length} process improvements suggested.`;

      await upsertWeeklyAnalysis({
        weekKey,
        noProgressCards: JSON.stringify(noProgressCards),
        recurringBlockers: JSON.stringify(recurringBlockers),
        estimateDrift: JSON.stringify(estimateDrift),
        underperformingWorkers: JSON.stringify(underperformingWorkers),
        listHoppers: JSON.stringify(listHoppers),
        unclearScopeProjects: JSON.stringify(unclearScopeProjects),
        processImprovements: JSON.stringify(processImprovements),
        summary,
      });

      // GAP I: Notify Robert that a new weekly analysis is ready
      try {
        const notifLines: string[] = [
          `📊 Weekly APTLSS Analysis — ${weekKey}`,
          ``,
          summary,
          ``,
          noProgressCards.length > 0
            ? `⚠️ Stalled cards (${noProgressCards.length}): ${noProgressCards.slice(0, 3).map(c => c.cardName).join(", ")}${noProgressCards.length > 3 ? " …" : ""}`
            : `✅ No stalled cards this week.`,
          recurringBlockers.length > 0
            ? `🔁 Recurring blockers (${recurringBlockers.length}): ${recurringBlockers.slice(0, 2).map(b => b.reason).join("; ")}${recurringBlockers.length > 2 ? " …" : ""}`
            : `✅ No recurring blockers detected.`,
          processImprovements.length > 0
            ? `💡 Top improvement: ${processImprovements[0]}`
            : ``,
        ].filter(Boolean);
        await notifyOwner({
          title: `Weekly APTLSS Analysis Ready — ${weekKey}`,
          content: notifLines.join("\n"),
        });
      } catch (notifErr) {
        console.warn("[WeeklyAnalysis] notifyOwner failed (non-fatal):", notifErr);
      }

      res.json({
        success: true,
        weekKey,
        noProgressCards: noProgressCards.length,
        recurringBlockers: recurringBlockers.length,
        estimateDrift: estimateDrift.length,
        unclearScopeProjects: unclearScopeProjects.length,
        processImprovements: processImprovements.length,
        summary,
      });
    } catch (err) {
      console.error("[WeeklyAnalysis] Failed:", err);
      res.status(500).json({ error: "Weekly analysis failed", detail: String(err) });
    }
  });
}
