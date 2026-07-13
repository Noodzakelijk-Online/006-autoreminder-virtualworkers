/**
 * Server-side cron jobs.
 *
 * Runs inside the Express process — no external scheduler needed.
 * Registered once at server startup via `startCronJobs()`.
 */
import cron from "node-cron";
import { getWeeklyPayLogByWeek } from "./db";
import { notifyOwner } from "./_core/notification";
import { scanTrelloReplyThreads } from "./replyMonitor";
import { runUpworkReplyMonitorScan } from "./upworkMonitor";
import { factCheckComplianceHistory } from "./complianceHistoryFactCheck";
import { runAptlssMaintenance } from "./scheduledAptlssMaintenance";
import {
  upsertReplyThread,
  insertVagueReplyFlag,
  insertUnsignedFlag,
  markReplyMonitorScanFailed,
  markReplyMonitorScanStarted,
  markReplyMonitorScanSucceeded,
  resolveSystemGeneratedUnsignedFlags,
} from "./replyMonitorDb";
import { runTrackedJob, type JobTrigger } from "./scheduledJobsDb";
import { broadcast } from "./sse";
import { autoStopManagedTimers } from "./timerService";
import { runWeeklyAnalysis as runSharedWeeklyAnalysis } from "./weeklyAnalysisService";

/**
 * Midnight auto-stop: every day at 00:00 EAT (UTC+3 = 21:00 UTC previous day).
 * Stops any timer that has been running for more than 12 hours, caps the duration,
 * and sends an owner notification so Joyce can correct inflated entries next morning.
 */
async function runMidnightAutoStop() {
  console.log("[CronJob] Running midnight auto-stop timers…");
  try {
    const stopped = await autoStopManagedTimers(12 * 3600);

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
    throw err;
  }
}

/**
 * EOD compliance snapshot: every day at 22:30 EAT (UTC+3 = 19:30 UTC).
 * Fetches live Trello state, computes compliance %, and saves the daily snapshot.
 * Skips on Sundays (Joyce's day off).
 */
export type EodComplianceResult = {
  status: "completed" | "skipped";
  dateKey: string;
  detail: string;
  recordsProcessed: number;
};

export async function runEODComplianceSnapshot(now = new Date()): Promise<EodComplianceResult> {
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const nowEAT = new Date(now.getTime() + eatOffsetMs);
  const todayEAT = nowEAT.toISOString().slice(0, 10);
  // Skip Sundays
  if (nowEAT.getDay() === 0) {
    console.log("[CronJob] EOD compliance snapshot skipped — Sunday.");
    return {
      status: "skipped",
      dateKey: todayEAT,
      detail: "Sunday is Joyce's protected day; no compliance snapshot is required.",
      recordsProcessed: 0,
    };
  }
  console.log(`[CronJob] Running EOD compliance snapshot for ${todayEAT}…`);
  try {
    const checked = await factCheckComplianceHistory({ dateKeys: [todayEAT], source: "auto_verified", now });
    const result = checked.results[0];
    const d1Instances = result.doingTotal - result.doingUpdated;
    const estimatedPenalty = d1Instances * 5;
    const summary = `${result.compliancePct}% verified compliance — ${result.doingUpdated}/${result.doingTotal} DOING updated, ${result.onHoldReviewed}/${result.onHoldTotal} ON-HOLD reviewed${d1Instances > 0 ? `, ${d1Instances} potential D1 exception${d1Instances > 1 ? 's' : ''} (review impact: $${estimatedPenalty})` : ''}`;
    console.log(`[CronJob] EOD compliance snapshot saved: ${summary}`);

    if (d1Instances > 0) {
      await notifyOwner({
        title: `⚠️ ${d1Instances} potential D1 exception${d1Instances > 1 ? 's' : ''} need review — ${todayEAT}`,
        content: [
          `Daily compliance snapshot for ${todayEAT}:`,
          `• ${summary}`,
          "",
          "Missed DOING cards:",
          ...result.doingMissedCards.map(c => `• ${c.name} — ${c.url}`),
          "",
          "No pay adjustment was made automatically. Review the evidence in Time & Pay.",
        ].join("\n"),
      });
    }
    return {
      status: "completed",
      dateKey: todayEAT,
      detail: summary,
      recordsProcessed: result.evidenceCount,
    };
  } catch (err) {
    console.error("[CronJob] EOD compliance snapshot failed:", err);
    throw err;
  }
}

export function runEodComplianceJob(trigger: JobTrigger = "manual") {
  return runTrackedJob({
    jobKey: "eod_compliance",
    trigger,
    run: () => runEODComplianceSnapshot(),
    summarize: (result) => ({
      recordsProcessed: result.recordsProcessed,
      detail: result.detail,
    }),
  });
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
    throw err;
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
    broadcast("scan-complete");
    console.warn("[ReplyMonitor] Trello API credentials not configured — skipping scan.");
    return;
  }

  console.log("[ReplyMonitor] Starting Trello reply-thread scan…");
  try {
    await resolveSystemGeneratedUnsignedFlags();
    const threads = await scanTrelloReplyThreads(apiKey, apiToken);
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
    broadcast("scan-complete");
    console.log(`[ReplyMonitor] Scan complete. ${threads.length} Trello threads scanned, ${newOverdueCards.length} newly overdue, ${newVagueFlags.length} new vague flags, ${newUnsignedMessages.length} new unsigned flags.`);
  } catch (err) {
    console.error("[ReplyMonitor] Scan failed:", err);
    await markReplyMonitorScanFailed(err).catch((statusError) => {
      console.error("[ReplyMonitor] Failed to persist scan failure:", statusError);
    });
    broadcast("scan-complete");
    throw err;
  }
}

/** Record ordinary cron jobs that do not own their own single-flight ledger. */
function launchTrackedCron<T>(jobKey: string, run: () => Promise<T>, summarize?: (result: T) => { recordsProcessed?: number; detail?: string }) {
  void runTrackedJob({ jobKey, trigger: "cron", run, summarize }).catch((error) => {
    console.error(`[CronJob] ${jobKey} failed:`, error instanceof Error ? error.message : String(error));
  });
}

export function startCronJobs() {
  // Hourly evidence sweep. The shared maintenance runner coalesces overlaps
  // with manual or externally scheduled runs and performs no Trello writes.
  cron.schedule("7 * * * *", () => {
    void runAptlssMaintenance("scheduled", "cron").catch((error) => {
      console.error("[CronJob] aptlss_maintenance failed:", error instanceof Error ? error.message : String(error));
    });
  }, { timezone: "UTC" });
  console.log("[CronJob] Continuous APTLSS assessment scheduled (hourly at :07 UTC).");

  // 21:00 UTC = 00:00 EAT (UTC+3)
  // cron format: second minute hour day month weekday
  cron.schedule("0 21 * * *", () => launchTrackedCron("timer_auto_stop", runMidnightAutoStop), {
    timezone: "UTC",
  });
  console.log("[CronJob] Midnight auto-stop timer scheduled (21:00 UTC = 00:00 EAT).");

  // 20:05 UTC = 23:05 EAT — verify after the 23:00 daily update deadline.
  cron.schedule("5 20 * * *", () => {
    void runEodComplianceJob("cron").catch((error) => {
      console.error("[CronJob] eod_compliance failed:", error instanceof Error ? error.message : String(error));
    });
  }, {
    timezone: "UTC",
  });
  console.log("[CronJob] EOD compliance fact-check scheduled (20:05 UTC = 23:05 EAT).");

  // 18:00 UTC = 21:00 EAT — Friday weekly pay summary notification
  cron.schedule("0 18 * * 5", () => launchTrackedCron("weekly_pay_summary", runFridayWeeklyPaySummary), {
    timezone: "UTC",
  });
  console.log("[CronJob] Friday weekly pay summary scheduled (18:00 UTC = 21:00 EAT every Friday).");

  // Every 15 minutes so the 12-hour SLA and 30-minute freshness check agree.
  cron.schedule("*/15 * * * *", () => launchTrackedCron("reply_monitor", () => runReplyMonitorScan({ sendNotifications: true })), {
    timezone: "UTC",
  });
  console.log("[CronJob] Reply monitor scheduled every 15 minutes.");

  // 19:00 UTC = 22:00 EAT — Sunday weekly analysis
  cron.schedule("0 19 * * 0", () => {
    void runSharedWeeklyAnalysis("cron", { force: false, notify: true }).catch((error) => {
      console.error("[CronJob] weekly_analysis failed:", error instanceof Error ? error.message : String(error));
    });
  }, {
    timezone: "UTC",
  });
  console.log("[CronJob] Weekly analysis scheduled (19:00 UTC every Sunday = 22:00 EAT).");
}
