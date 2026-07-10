/**
 * Server-side cron jobs.
 *
 * Runs inside the Express process — no external scheduler needed.
 * Registered once at server startup via `startCronJobs()`.
 */
import cron from "node-cron";
import { autoStopAllRunningTimers, upsertComplianceSnapshot, getWeeklyPayLogByWeek, getOnHoldChecksByDate } from "./db";
import { notifyOwner } from "./_core/notification";
import { getJoyceCards, getJoyceCommentedCardIdsToday, isDoingList, isOnHoldList } from "./trello";
import { scanTrelloReplyThreads, REPLY_DEADLINE_MS, VAGUE_CORRECTION_WINDOW_MS } from "./replyMonitor";
import { runUpworkReplyMonitorScan } from "./upworkMonitor";
import { getAllAptlssPlans } from "./aptlssDb";
import { getAllCardStates, getAllPriorityScores } from "./aptlssStepsDb";
import { upsertWeeklyAnalysis } from "./aptlssPoliciesDb";
import { invokeLLM } from "./_core/llm";
import { buildComplianceEvidence } from "./complianceEvidence";
import { runAptlssMaintenance } from "./scheduledAptlssMaintenance";
import {
  upsertReplyThread,
  insertVagueReplyFlag,
  insertUnsignedFlag,
  markReplyMonitorScanFailed,
  markReplyMonitorScanStarted,
  markReplyMonitorScanSucceeded,
} from "./replyMonitorDb";

/**
 * Midnight auto-stop: every day at 00:00 EAT (UTC+3 = 21:00 UTC previous day).
 * Stops any timer that has been running for more than 12 hours, caps the duration,
 * and sends an owner notification so Joyce can correct inflated entries next morning.
 */
async function runMidnightAutoStop() {
  console.log("[CronJob] Running midnight auto-stop timers…");
  try {
    const stopped = await autoStopAllRunningTimers(12 * 3600);

    if (stopped.length === 0) {
      console.log("[CronJob] No running timers found — nothing to stop.");
      return;
    }

    const lines = stopped.map(e => {
      const h = Math.floor(e.durationSeconds / 3600);
      const m = Math.floor((e.durationSeconds % 3600) / 60);
      const flag = e.wasCapped ? " ⚠️ CAPPED at 12h" : "";
      return `• ${e.cardName} — ${h}h ${m}m${flag}`;
    });

    const title = `⏹ Auto-stopped ${stopped.length} timer${stopped.length > 1 ? "s" : ""} at midnight EAT`;
    const content = [
      "The following timers were automatically stopped at midnight EAT:",
      "",
      ...lines,
      "",
      stopped.some(e => e.wasCapped)
        ? "⚠️ Entries marked CAPPED were running for more than 12 hours — please correct the duration in the Time Tracker."
        : "All durations look reasonable. No corrections needed.",
    ].join("\n");

    await notifyOwner({ title, content });
    console.log(`[CronJob] Auto-stopped ${stopped.length} timer(s) and notified owner.`);
  } catch (err) {
    console.error("[CronJob] Midnight auto-stop failed:", err);
  }
}

/**
 * EOD compliance snapshot: every day at 22:30 EAT (UTC+3 = 19:30 UTC).
 * Fetches live Trello state, computes compliance %, and saves the daily snapshot.
 * Skips on Sundays (Joyce's day off).
 */
async function runEODComplianceSnapshot() {
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const nowEAT = new Date(Date.now() + eatOffsetMs);
  // Skip Sundays
  if (nowEAT.getDay() === 0) {
    console.log("[CronJob] EOD compliance snapshot skipped — Sunday.");
    return;
  }
  const todayEAT = nowEAT.toISOString().slice(0, 10);
  console.log(`[CronJob] Running EOD compliance snapshot for ${todayEAT}…`);
  try {
    const apiKey = process.env.TrelloAPIKey;
    const apiToken = process.env.TrelloAPIToken;
    if (!apiKey || !apiToken) {
      console.warn("[CronJob] EOD compliance snapshot skipped — Trello credentials not configured.");
      return;
    }
    const [allCards, commentedCardIds, onHoldChecks] = await Promise.all([
      getJoyceCards(apiKey, apiToken),
      getJoyceCommentedCardIdsToday(apiKey, apiToken),
      getOnHoldChecksByDate(todayEAT),
    ]);
    const doingCards = allCards.filter(c => c.list && isDoingList(c.list.name));
    const onHoldCards = allCards.filter(c => c.list && isOnHoldList(c.list.name));
    const checkedOnHoldIds = new Set(onHoldChecks.filter((item) => item.checked).map((item) => item.cardId));
    const evidence = buildComplianceEvidence({ doingCards, onHoldCards, commentedCardIds, reviewedOnHoldIds: checkedOnHoldIds });
    const { doingUpdated, doingMissed, onHoldReviewed, onHoldMissed, compliancePct } = evidence;
    const onHoldReviewedCount = onHoldReviewed.length;
    const d1Instances = evidence.potentialD1Instances;
    const estimatedPenalty = evidence.estimatedReviewImpact;
    await upsertComplianceSnapshot({
      snapshotDate: todayEAT,
      onHoldTotal: onHoldCards.length,
      onHoldReviewed: onHoldReviewedCount,
      onHoldMissedCards: onHoldMissed.map(c => ({ id: c.id, name: c.name, url: c.url })),
      doingTotal: doingCards.length,
      doingUpdated: doingUpdated.length,
      doingMissedCards: doingMissed.map(c => ({ id: c.id, name: c.name, url: c.url })),
      d1Instances,
      estimatedPenalty,
      source: "auto",
      weeklyPayLogId: null,
    });
    const summary = `${compliancePct}% compliance — ${doingUpdated.length}/${doingCards.length} DOING updated, ${onHoldReviewedCount}/${onHoldCards.length} ON-HOLD reviewed${d1Instances > 0 ? `, ${d1Instances} potential D1 exception${d1Instances > 1 ? 's' : ''} (review impact: $${estimatedPenalty})` : ''}`;
    console.log(`[CronJob] EOD compliance snapshot saved: ${summary}`);

    if (d1Instances > 0) {
      await notifyOwner({
        title: `⚠️ ${d1Instances} potential D1 exception${d1Instances > 1 ? 's' : ''} need review — ${todayEAT}`,
        content: [
          `Daily compliance snapshot for ${todayEAT}:`,
          `• ${summary}`,
          "",
          "Missed DOING cards:",
          ...doingMissed.map(c => `• ${c.name} — ${c.url}`),
          "",
          "No pay adjustment was made automatically. Review the evidence in Time & Pay.",
        ].join("\n"),
      });
    }
  } catch (err) {
    console.error("[CronJob] EOD compliance snapshot failed:", err);
  }
}

/**
 * Friday weekly pay summary: every Friday at 18:00 UTC (21:00 EAT).
 * Sends an owner notification with the full week's pay breakdown.
 */
async function runFridayWeeklyPaySummary() {
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const nowEAT = new Date(Date.now() + eatOffsetMs);
  // Only run on Fridays
  if (nowEAT.getDay() !== 5) return;
  const todayEAT = nowEAT.toISOString().slice(0, 10);
  console.log(`[CronJob] Running Friday weekly pay summary for week ending ${todayEAT}…`);
  try {
    // Get the Monday of the current week
    const eatDate = new Date(nowEAT);
    const dayOfWeek = eatDate.getDay(); // 5 = Friday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(eatDate);
    monday.setDate(eatDate.getDate() + mondayOffset);
    const weekStart = monday.toISOString().slice(0, 10);
    const payLog = await getWeeklyPayLogByWeek(weekStart);
    const base = 90;
    const merits = payLog ? (
      Number(payLog.meritM1) + Number(payLog.meritM2) + Number(payLog.meritM3) + Number(payLog.meritStreak)
    ) : 0;
    const demerits = payLog ? (
      Number(payLog.demeritD1) + Number(payLog.demeritD2) + Number(payLog.demeritD3) +
      Number(payLog.demeritD4) + Number(payLog.demeritD5) + Number(payLog.demeritD6) +
      Number(payLog.demeritD7) + Number(payLog.demeritD8) + Number(payLog.demeritD9) +
      Number(payLog.demeritD10) + Number(payLog.demeritD11)
    ) : 0;
    const meritAmt = payLog ? (
      Number(payLog.meritM1) * 5 + Number(payLog.meritM2) * 7.5 +
      Number(payLog.meritM3) * 1 + Number(payLog.meritStreak) * 10
    ) : 0;
    const demeritAmt = payLog ? (
      Number(payLog.demeritD1) * 5 + Number(payLog.demeritD2) * 10 +
      Number(payLog.demeritD3) * 5 + Number(payLog.demeritD4) * 5 +
      Number(payLog.demeritD5) * 10 + Number(payLog.demeritD6) * 5 +
      Number(payLog.demeritD7) * 5 + Number(payLog.demeritD8) * 10 +
      Number(payLog.demeritD9) * 15 + Number(payLog.demeritD10) * 15 +
      Number(payLog.demeritD11) * 15
    ) : 0;
    const projected = Math.max(0, base - demeritAmt + meritAmt);
    const lines: string[] = [
      `Weekly Pay Summary — week of ${weekStart}`,
      "",
      `• Base pay:        $${base.toFixed(2)}`,
      `• Merits (+):      +$${meritAmt.toFixed(2)} (${merits} total)`,
      `• Demerits (−):    −$${demeritAmt.toFixed(2)} (${demerits} total)`,
      "",
      `• Projected pay:   $${projected.toFixed(2)}`,
    ];
    if (payLog?.notes) {
      lines.push("", `Notes: ${payLog.notes}`);
    }
    if (!payLog) {
      lines.push("", "⚠️ No pay log entry found for this week — the pay calculator may not have been used yet.");
    }
    await notifyOwner({
      title: `💰 Weekly Pay Summary — ${todayEAT}`,
      content: lines.join("\n"),
    });
    console.log(`[CronJob] Friday weekly pay summary sent. Projected: $${projected.toFixed(2)}`);
  } catch (err) {
    console.error("[CronJob] Friday weekly pay summary failed:", err);
  }
}

/**
 * Reply Monitor scan: every 15 minutes.
 * 1. Scans all active Trello cards for unanswered comment threads (12h rule).
 * 2. Detects vague replies from Joyce and flags them.
 * 3. Persists vague and unsigned exceptions for manual review.
 * 4. Sends owner notification for new overdue threads and new flags.
 */
let replyMonitorScanInFlight: Promise<void> | null = null;

export function runReplyMonitorScan(options: { sendNotifications?: boolean } = {}): Promise<void> {
  if (replyMonitorScanInFlight) return replyMonitorScanInFlight;
  replyMonitorScanInFlight = executeReplyMonitorScan(options).finally(() => {
    replyMonitorScanInFlight = null;
  });
  return replyMonitorScanInFlight;
}

async function executeReplyMonitorScan({ sendNotifications = false }: { sendNotifications?: boolean }): Promise<void> {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  await markReplyMonitorScanStarted();
  if (!apiKey || !apiToken) {
    await markReplyMonitorScanFailed(new Error("Trello API credentials are not configured."));
    console.warn("[ReplyMonitor] Trello API credentials not configured — skipping scan.");
    return;
  }

  console.log("[ReplyMonitor] Starting Trello reply-thread scan…");
  try {
    const threads = await scanTrelloReplyThreads(apiKey, apiToken);
    const now = Date.now();
    const newOverdueCards: string[] = [];
    const newVagueFlags: Array<{ cardName: string; cardUrl: string; text: string }> = [];
    const newUnsignedMessages: Array<{ cardName: string; cardUrl: string; text: string }> = [];

    for (const thread of threads) {
      const status: "pending" | "replied" | "overdue" = thread.needsReply
        ? (thread.isOverdue ? "overdue" : "pending")
        : "replied";

      await upsertReplyThread({
        source: "trello",
        cardId: thread.cardId,
        cardName: thread.cardName,
        cardUrl: thread.cardUrl,
        boardName: thread.boardName,
        listName: thread.listName,
        lastNonJoyceMsgAt: thread.lastNonJoyceMsgAt ?? null,
        lastNonJoyceAuthor: thread.lastNonJoyceAuthor,
        lastNonJoyceText: thread.lastNonJoyceText,
        lastJoyceReplyAt: thread.lastJoyceReplyAt,
        status,
        demerited: false,
      });

      if (status === "overdue") {
        newOverdueCards.push(`• ${thread.cardName} — ${thread.cardUrl} (last reply: ${thread.lastNonJoyceAuthor})`);
      }

      for (const vague of thread.vagueReplies) {
        const insertedId = await insertVagueReplyFlag({
          source: "trello",
          cardId: thread.cardId,
          cardName: thread.cardName,
          cardUrl: thread.cardUrl,
          actionId: vague.actionId,
          messageText: vague.text,
          flaggedAt: vague.date,
        });
        if (insertedId) {
          newVagueFlags.push({ cardName: thread.cardName, cardUrl: thread.cardUrl, text: vague.text });
        }
      }

      for (const unsigned of thread.unsignedMessages) {
        const insertedId = await insertUnsignedFlag({
          source: "trello",
          cardId: thread.cardId,
          cardName: thread.cardName,
          cardUrl: thread.cardUrl,
          actionId: unsigned.actionId,
          messageText: unsigned.text,
          flaggedAt: unsigned.date,
        });
        if (insertedId) {
          newUnsignedMessages.push({ cardName: thread.cardName, cardUrl: thread.cardUrl, text: unsigned.text });
        }
      }
    }

    if (sendNotifications && newOverdueCards.length > 0) {
      await notifyOwner({
        title: `⏰ ${newOverdueCards.length} overdue Trello repl${newOverdueCards.length > 1 ? 'ies' : 'y'} — 12h deadline exceeded`,
        content: [
          "Joyce has not replied to the following Trello card threads within 12 hours:",
          "",
          ...newOverdueCards,
        ].join("\n"),
      }).catch(() => {});
    }

    if (sendNotifications && newVagueFlags.length > 0) {
      await notifyOwner({
        title: `⚠️ ${newVagueFlags.length} vague repl${newVagueFlags.length > 1 ? 'ies' : 'y'} flagged for review`,
        content: [
          "Joyce posted vague/deferral replies that do not address the situation:",
          "",
          ...newVagueFlags.map((f) => `• "${f.text.slice(0, 100)}" — ${f.cardUrl}`),
          "",
          "Review and correct each reply. No pay adjustment is made automatically.",
        ].join("\n"),
      }).catch(() => {});
    }


    // ─── Upwork scan (self-contained — persists threads and review flags) ─────────
    const upworkToken = process.env.UPWORK_API_TOKEN;
    if (upworkToken) {
      try {
        console.log("[ReplyMonitor] Starting Upwork reply-thread scan…");
        const upworkResult = await runUpworkReplyMonitorScan();
        if (sendNotifications && upworkResult.tokenExpired) {
          await notifyOwner({
            title: "⚠️ Upwork token expired — please re-login",
            content: "The Upwork API token has expired. Please log into Upwork in the browser and update the UPWORK_API_TOKEN secret to resume monitoring.",
          }).catch(() => {});
        } else if (upworkResult.overdue > 0) {
          newOverdueCards.push(`• [Upwork] ${upworkResult.overdue} room${upworkResult.overdue > 1 ? 's' : ''} overdue`);
        }
        console.log(`[ReplyMonitor] Upwork scan complete: ${upworkResult.scanned} rooms, ${upworkResult.overdue} overdue, ${upworkResult.vagueFlags} vague flags.`);
      } catch (upworkErr) {
        throw new Error(`Upwork scan failed: ${upworkErr instanceof Error ? upworkErr.message : String(upworkErr)}`);
      }
    } else {
      console.log("[ReplyMonitor] UPWORK_API_TOKEN not set — skipping Upwork scan.");
    }

    if (sendNotifications && newUnsignedMessages.length > 0) {
      await notifyOwner({
        title: `✍️ ${newUnsignedMessages.length} unsigned message${newUnsignedMessages.length > 1 ? 's' : ''} detected for review`,
        content: [
          "The following messages were sent without a signature (~ Angel or ~ Joyce):",
          "",
          ...newUnsignedMessages.map((f) => `• "${f.text.slice(0, 100)}" — ${f.cardUrl}`),
          "",
          "Add a signed follow-up and review the exception. No pay adjustment is made automatically.",
        ].join("\n"),
      }).catch(() => {});
    }

    await markReplyMonitorScanSucceeded(threads.length);
    console.log(`[ReplyMonitor] Scan complete. ${threads.length} Trello threads scanned, ${newOverdueCards.length} newly overdue, ${newVagueFlags.length} new vague flags, ${newUnsignedMessages.length} new unsigned flags.`);
  } catch (err) {
    console.error("[ReplyMonitor] Scan failed:", err);
    await markReplyMonitorScanFailed(err).catch((statusError) => {
      console.error("[ReplyMonitor] Failed to persist scan failure:", statusError);
    });
  }
}

/**
 * Weekly analysis: every Sunday at 19:00 UTC (22:00 EAT).
 * Finds stalled cards, recurring blockers, estimate drift, list-hoppers, unclear scope.
 * Generates LLM process improvement suggestions and saves snapshot to DB.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function runWeeklyAnalysis() {
  console.log("[CronJob] Running weekly APTLSS analysis…");
  try {
    const weekKey = getISOWeekKey(new Date());
    const [cardStates, plans, priorityScores] = await Promise.all([
      getAllCardStates(),
      getAllAptlssPlans(),
      getAllPriorityScores(),
    ]);
    const noProgressCards = cardStates
      .filter(cs => cs.state === "STALLED" || cs.state === "IN_PROGRESS")
      .map(cs => { const plan = plans.find(p => p.cardId === cs.cardId); return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, state: cs.state }; });
    const blockedPlans = plans.filter(p => { try { return (JSON.parse(p.planJson) as Record<string, unknown>).isBlocked === true; } catch { return false; } });
    const blockerReasons: Record<string, string[]> = {};
    for (const p of blockedPlans) {
      try { const plan = JSON.parse(p.planJson) as Record<string, unknown>; const reason = (plan.blockedReason as string) ?? "Unknown"; const key = reason.slice(0, 60); if (!blockerReasons[key]) blockerReasons[key] = []; blockerReasons[key].push(p.cardName); } catch { /* skip */ }
    }
    const recurringBlockers = Object.entries(blockerReasons).filter(([, cards]) => cards.length >= 2).map(([reason, cards]) => ({ reason, cards, count: cards.length }));
    const overdueCards = cardStates.filter(cs => cs.state === "OVERDUE");
    const estimateDrift = overdueCards.map(cs => { const plan = plans.find(p => p.cardId === cs.cardId); const score = priorityScores.find(s => s.cardId === cs.cardId); return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, priorityScore: score?.score ?? 0, tier: score?.tier ?? "MEDIUM" }; });
    const restructuringCards = cardStates.filter(cs => cs.state === "NEEDS_RESTRUCTURING");
    const underperformingWorkers = restructuringCards.length > 0 ? [{ signal: "NEEDS_RESTRUCTURING", count: restructuringCards.length, cards: restructuringCards.map(cs => cs.cardId) }] : [];
    const waitingCards = cardStates.filter(cs => cs.state === "WAITING_FOR_ROBERT" || cs.state === "WAITING_FOR_EXTERNAL_PARTY");
    const listHoppers = waitingCards.map(cs => { const plan = plans.find(p => p.cardId === cs.cardId); return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId, state: cs.state }; });
    const unclearScopeProjects = restructuringCards.map(cs => { const plan = plans.find(p => p.cardId === cs.cardId); return { cardId: cs.cardId, cardName: plan?.cardName ?? cs.cardId }; });
    let processImprovements: string[] = [];
    try {
      const context = `Weekly APTLSS Analysis:\n- Stalled: ${noProgressCards.length}\n- Recurring blockers: ${recurringBlockers.length}\n- Overdue: ${estimateDrift.length}\n- Needs restructuring: ${restructuringCards.length}\n- Waiting: ${waitingCards.length}\n- Total: ${cardStates.length}`;
      const llmResponse = await invokeLLM({ messages: [{ role: "system", content: "You are an operations analyst. Based on the weekly Trello work analysis, suggest 3-5 specific, actionable process improvements. Return a JSON object with an \"improvements\" array of strings." }, { role: "user", content: context }], response_format: { type: "json_schema", json_schema: { name: "process_improvements", strict: true, schema: { type: "object", properties: { improvements: { type: "array", items: { type: "string" } } }, required: ["improvements"], additionalProperties: false } } } });
      const rawContent = llmResponse?.choices?.[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : null;
      if (content) { const parsed = JSON.parse(content) as { improvements: string[] }; processImprovements = parsed.improvements ?? []; }
    } catch { /* LLM failure is non-fatal */ }
    const summary = `Week ${weekKey}: ${cardStates.length} active cards. ${noProgressCards.length} stalled, ${overdueCards.length} overdue, ${recurringBlockers.length} recurring blocker patterns, ${restructuringCards.length} needing restructuring.`;
    await upsertWeeklyAnalysis({ weekKey, noProgressCards: JSON.stringify(noProgressCards), recurringBlockers: JSON.stringify(recurringBlockers), estimateDrift: JSON.stringify(estimateDrift), underperformingWorkers: JSON.stringify(underperformingWorkers), listHoppers: JSON.stringify(listHoppers), unclearScopeProjects: JSON.stringify(unclearScopeProjects), processImprovements: JSON.stringify(processImprovements), summary });
    await notifyOwner({ title: `📊 Weekly APTLSS Analysis — ${weekKey}`, content: summary + (processImprovements.length > 0 ? `\n\nProcess improvements:\n${processImprovements.map(i => `• ${i}`).join("\n")}` : "") });
    console.log(`[CronJob] Weekly analysis complete: ${summary}`);
  } catch (err) {
    console.error("[CronJob] Weekly analysis failed:", err);
  }
}

export function startCronJobs() {
  // Hourly evidence sweep. The shared maintenance runner coalesces overlaps
  // with manual or externally scheduled runs and performs no Trello writes.
  cron.schedule("15 * * * *", () => {
    void runAptlssMaintenance("scheduled").catch((error) => {
      console.error("[CronJob] Continuous APTLSS assessment failed:", error);
    });
  }, { timezone: "UTC" });
  console.log("[CronJob] Continuous APTLSS assessment scheduled (hourly at :15 UTC).");

  // 21:00 UTC = 00:00 EAT (UTC+3)
  // cron format: second minute hour day month weekday
  cron.schedule("0 21 * * *", runMidnightAutoStop, {
    timezone: "UTC",
  });
  console.log("[CronJob] Midnight auto-stop timer scheduled (21:00 UTC = 00:00 EAT).");

  // 19:30 UTC = 22:30 EAT — EOD compliance snapshot
  cron.schedule("30 19 * * *", runEODComplianceSnapshot, {
    timezone: "UTC",
  });
  console.log("[CronJob] EOD compliance snapshot scheduled (19:30 UTC = 22:30 EAT).");

  // 18:00 UTC = 21:00 EAT — Friday weekly pay summary notification
  cron.schedule("0 18 * * 5", runFridayWeeklyPaySummary, {
    timezone: "UTC",
  });
  console.log("[CronJob] Friday weekly pay summary scheduled (18:00 UTC = 21:00 EAT every Friday).");

  // Every 12 hours — Trello reply-thread monitor (08:00 UTC + 20:00 UTC)
  cron.schedule("0 8,20 * * *", () => runReplyMonitorScan({ sendNotifications: true }), {
    timezone: "UTC",
  });
  console.log("[CronJob] Reply monitor scheduled (every 12 hours: 08:00 UTC + 20:00 UTC).");

  // 19:00 UTC = 22:00 EAT — Sunday weekly analysis
  cron.schedule("0 19 * * 0", runWeeklyAnalysis, {
    timezone: "UTC",
  });
  console.log("[CronJob] Weekly analysis scheduled (19:00 UTC every Sunday = 22:00 EAT).");
}
