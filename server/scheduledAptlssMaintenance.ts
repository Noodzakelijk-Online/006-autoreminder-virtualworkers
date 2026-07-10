/**
 * Scheduled APTLSS Maintenance endpoint.
 *
 * Called by the AGENT cron once per hour. Silently:
 *   1. Refreshes card states and priority scores for all cards with APTLSS plans
 *   2. Detects stalled cards (no activity in 48h) and marks them
 *   3. Detects unanswered questions in latest comments
 *   4. Expires old plans (> 24h) so next open triggers a fresh generation
 *   5. [GAP C] Auto-records worker performance signals for Joyce (aggregated from card states)
 *   6. [GAP B] Auto-generates follow-up drafts for WAITING_FOR_EXTERNAL_PARTY cards (level >= 3)
 *   7. [GAP I] Notifies Robert after weekly analysis is generated
 *   8. [GAP J] Detects possible duplicate cards by name similarity
 */
import type { Application, Request, Response } from "express";
import { getAllAptlssPlans } from "./aptlssDb";
import { fetchCardContext } from "./trelloCardContext";
import {
  computeAndSaveCardState,
  computeAndSavePriorityScore,
} from "./aptlssEngine";
import {
  upsertCardState,
  getNeedsRepairCards,
  getAllRobertDecisionSteps,
} from "./aptlssStepsDb";
import {
  upsertWorkerPerformance,
  upsertFollowUpDraft,
  getAutopilotLevel,
  getPolicyValue,
  getPendingFollowUpDrafts,
} from "./aptlssPoliciesDb";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { recordSyncAttempt } from "./aptlssAuditDb";
import { generateDailyPlan, getEatDateKey } from "./dailyPlan";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";

/** Simple fuzzy name similarity: returns 0–1 (1 = identical) */
function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  // Jaccard similarity on word sets
  const wordsA = new Set(na.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(nb.split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = Array.from(wordsA).filter(w => wordsB.has(w)).length;
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB))).size;
  return intersection / union;
}

/** Get ISO week key (e.g. "2026-W21") for the current date */
function getCurrentWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export type AptlssMaintenanceResult = {
  success: true;
  total: number;
  refreshed: number;
  failed: number;
  followUpDraftsGenerated: number;
  duplicatesDetected: number;
  noNextActionCount: number;
  dailyPlanGenerated: boolean;
  robertQueueCount: number;
  timestamp: string;
};

export async function runAptlssMaintenance(source: "scheduled" | "manual" = "scheduled"): Promise<AptlssMaintenanceResult> {
    const apiKey = process.env.TrelloAPIKey;
    const apiToken = process.env.TrelloAPIToken;
    if (!apiKey || !apiToken) {
      throw new Error("Trello credentials not configured");
    }

    const plans = await getAllAptlssPlans();
    let refreshed = 0;
    let failed = 0;
    const cardStateResults: { cardId: string; cardName: string; state: string }[] = [];

    // ── 1. Refresh all card states and priority scores ────────────────────────
    for (const plan of plans) {
      try {
        const ctx = await fetchCardContext(plan.cardId, apiKey, apiToken);
        const state = await computeAndSaveCardState(ctx);
        await computeAndSavePriorityScore(ctx, state);
        cardStateResults.push({ cardId: plan.cardId, cardName: plan.cardName, state });
        refreshed++;
      } catch {
        failed++;
      }
    }

    // ── 2. [GAP C] Auto-record worker performance signals for Joyce ───────────
    try {
      const weekKey = getCurrentWeekKey();
      const stalledCount = cardStateResults.filter(r => r.state === "STALLED").length;
      const overdueCount = cardStateResults.filter(r => r.state === "OVERDUE").length;
      const repairCards = await getNeedsRepairCards();
      const reworkCount = repairCards.length;
      // Escalations: cards with BLOCKED or WAITING states that have been stuck
      const blockedCount = cardStateResults.filter(r =>
        r.state === "BLOCKED_BY_OTHER_CARD" || r.state === "WAITING_FOR_ROBERT"
      ).length;
      await upsertWorkerPerformance({
        workerId: "joyce",
        workerName: "Joyce",
        weekKey,
        stalledCardsCount: stalledCount,
        missedDeadlines: overdueCount,
        reworkCount,
        robertEscalationsCount: blockedCount,
        avgResponseTimeMinutes: 0, // updated when response times are tracked
        checklistItemsCompleted: 0, // updated from syncCheckItem events
        unclearHandovers: 0,
        notes: `Auto-recorded by maintenance job. Refreshed ${refreshed}/${plans.length} cards.`,
        calculatedAt: new Date(),
      });
    } catch (e) {
      console.error("[APTLSS Maintenance] Worker signal recording failed (non-fatal):", e);
    }

    // ── 3. [GAP B+3] Auto-generate follow-up drafts for WAITING cards (with timing enforcement) ─
    let followUpDraftsGenerated = 0;
    try {
      const autopilotLevel = await getAutopilotLevel();
      const followUpHoursStr = await getPolicyValue("follow_up_hours_routine", "24");
      const followUpHoursThreshold = Number(followUpHoursStr) || 24;
      if (autopilotLevel >= 3) {
        const waitingCards = cardStateResults.filter(r => r.state === "WAITING_FOR_EXTERNAL_PARTY");
        const pendingDrafts = await getPendingFollowUpDrafts();
        const pendingCardIds = new Set(pendingDrafts.map(d => d.cardId));
        for (const card of waitingCards) {
          if (pendingCardIds.has(card.cardId)) continue; // already has a pending draft
          try {
            const ctx = await fetchCardContext(card.cardId, apiKey, apiToken);
            // GAP 3: enforce the configured idle-hours threshold before generating a draft
            const hoursSinceLastActivity = (Date.now() - ctx.lastActivityMs) / (1000 * 60 * 60);
            if (hoursSinceLastActivity < followUpHoursThreshold) continue;
            const urgencyType = hoursSinceLastActivity >= followUpHoursThreshold * 3
              ? "urgent"
              : hoursSinceLastActivity >= followUpHoursThreshold * 2
              ? "formal_reminder"
              : "routine";
            const followUpLLM = await invokeLLM({
              messages: [
                { role: "system", content: "You are Joyce, a virtual assistant. Write a concise, professional follow-up message for a task waiting for an external party. Return JSON with fields: draftMessage (string), reason (string)." },
                { role: "user", content: `Card: ${ctx.name}\nDescription: ${ctx.desc?.slice(0, 800) ?? ""}` },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "follow_up_draft",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: { draftMessage: { type: "string" }, reason: { type: "string" } },
                    required: ["draftMessage", "reason"],
                    additionalProperties: false,
                  },
                },
              },
            });
            const raw = followUpLLM?.choices?.[0]?.message?.content;
            if (typeof raw === "string") {
              const data = JSON.parse(raw) as { draftMessage: string; reason: string };
              await upsertFollowUpDraft({
                cardId: card.cardId,
                cardName: card.cardName,
                draftMessage: data.draftMessage,
                reason: data.reason,
                hoursSinceLastReply: Math.round(hoursSinceLastActivity),
                urgencyType,
                status: "pending",
              });
              followUpDraftsGenerated++;
            }
          } catch (e) {
            console.error(`[APTLSS Maintenance] Follow-up draft for ${card.cardId} failed:`, e);
          }
        }
      }
    } catch (e) {
      console.error("[APTLSS Maintenance] Follow-up draft batch failed (non-fatal):", e);
    }

    // ── 4. [GAP J] Detect possible duplicate cards by name similarity ─────────
    let duplicatesDetected = 0;
    try {
      const activeCards = cardStateResults.filter(r =>
        r.state !== "DONE" && r.state !== "CANCELLED"
      );
      const SIMILARITY_THRESHOLD = 0.8;
      const flaggedPairs: { a: string; b: string; similarity: number }[] = [];
      for (let i = 0; i < activeCards.length; i++) {
        for (let j = i + 1; j < activeCards.length; j++) {
          const sim = nameSimilarity(activeCards[i].cardName, activeCards[j].cardName);
          if (sim >= SIMILARITY_THRESHOLD) {
            flaggedPairs.push({ a: activeCards[i].cardId, b: activeCards[j].cardId, similarity: sim });
          }
        }
      }
      if (flaggedPairs.length > 0) {
        duplicatesDetected = flaggedPairs.length;
        // Flag both cards in each pair as NEEDS_RESTRUCTURING with a duplicate reason
        for (const pair of flaggedPairs) {
          const cardA = activeCards.find(c => c.cardId === pair.a);
          const cardB = activeCards.find(c => c.cardId === pair.b);
          if (cardA && cardB) {
            // Update card state for both cards to NEEDS_RESTRUCTURING
            await upsertCardState({
              cardId: pair.a,
              cardName: cardA.cardName,
              state: "NEEDS_RESTRUCTURING",
              stateReason: `Possible duplicate of "${cardB.cardName}" (${Math.round(pair.similarity * 100)}% name similarity). Verify and merge or rename.`,
              boardName: "",
              listName: "",
              hasUnansweredQuestion: false,
              hasFinalSummary: false,
              calculatedAt: new Date(),
            });
            await upsertCardState({
              cardId: pair.b,
              cardName: cardB.cardName,
              state: "NEEDS_RESTRUCTURING",
              stateReason: `Possible duplicate of "${cardA.cardName}" (${Math.round(pair.similarity * 100)}% name similarity). Verify and merge or rename.`,
              boardName: "",
              listName: "",
              hasUnansweredQuestion: false,
              hasFinalSummary: false,
              calculatedAt: new Date(),
            });
          }
        }
        // Notify Robert about duplicates
        try {
          const pairSummary = flaggedPairs.slice(0, 5).map(p => {
            const a = activeCards.find(c => c.cardId === p.a)?.cardName ?? p.a;
            const b = activeCards.find(c => c.cardId === p.b)?.cardName ?? p.b;
            return `• "${a}" ↔ "${b}" (${Math.round(p.similarity * 100)}% match)`;
          }).join("\n");
          await notifyOwner({
            title: `⚠️ ${flaggedPairs.length} Possible Duplicate Card(s) Detected`,
            content: `APTLSS maintenance detected cards with very similar names that may be duplicates:\n\n${pairSummary}\n\nPlease review and merge or rename as needed.`,
          });
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      console.error("[APTLSS Maintenance] Duplicate detection failed (non-fatal):", e);
    }

    // ── 5. [GAP 4] Detect cards without a next best action ──────────────────────
    let noNextActionCount = 0;
    try {
      const allPlansForCheck = await getAllAptlssPlans();
      for (const p of allPlansForCheck) {
        try {
          const plan = JSON.parse(p.planJson) as Record<string, unknown>;
          const nextBestAction = (plan.nextBestAction as string | undefined) ?? (plan.action as string | undefined) ?? "";
          if (!nextBestAction.trim()) {
            // Mark as NEEDS_RESTRUCTURING so it surfaces in the repair queue
            await upsertCardState({
              cardId: p.cardId,
              cardName: p.cardName,
              state: "NEEDS_RESTRUCTURING",
              stateReason: "Card has no next best action defined. Regenerate the APTLSS plan to fix.",
              boardName: p.boardName,
              listName: p.listName,
              hasUnansweredQuestion: false,
              hasFinalSummary: false,
              calculatedAt: new Date(),
            });
            noNextActionCount++;
          }
        } catch { /* ignore parse errors */ }
      }
    } catch (e) {
      console.error("[APTLSS Maintenance] No-next-action detection failed (non-fatal):", e);
    }

    // ── 6. [GAP 5] Auto-generate daily plan (autopilot level >= 2) ────────────
    let dailyPlanGenerated = false;
    try {
      const autopilotLvl = await getAutopilotLevel();
      if (autopilotLvl >= 2) {
        await generateDailyPlan(getEatDateKey(), "auto");
        dailyPlanGenerated = true;
      }
    } catch (e) {
      console.error("[APTLSS Maintenance] Daily plan generation failed (non-fatal):", e);
    }

    // ── 7. [GAP 6] Refresh Robert's decision queue count ─────────────────────
    let robertQueueCount = 0;
    try {
      const robertSteps = await getAllRobertDecisionSteps();
      robertQueueCount = robertSteps.length;
    } catch (e) {
      console.error("[APTLSS Maintenance] Robert queue count failed (non-fatal):", e);
    }

    // ── 8. Record sync attempt in admin_sync_log so Admin Monitor shows real data ──
    try {
      await recordSyncAttempt({
        syncType: source === "manual" ? "manual_maintenance" : "maintenance_job",
        success: failed === 0,
        cardsProcessed: plans.length,
        actionsTaken: refreshed,
        cardsSkippedLowConfidence: 0,
        errorMessage: failed > 0 ? `${failed} card(s) failed to refresh` : null,
      });
    } catch (e) {
      console.error('[APTLSS Maintenance] recordSyncAttempt failed (non-fatal):', e);
    }
    return {
      success: true,
      total: plans.length,
      refreshed,
      failed,
      followUpDraftsGenerated,
      duplicatesDetected,
      noNextActionCount,
      dailyPlanGenerated,
      robertQueueCount,
      timestamp: new Date().toISOString(),
    };
}

export function registerScheduledAptlssMaintenanceRoute(app: Application): void {
  app.post("/api/scheduled/aptlss-maintenance", async (req: Request, res: Response) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      res.json(await runAptlssMaintenance("scheduled"));
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "APTLSS maintenance failed",
      });
    }
  });
}
