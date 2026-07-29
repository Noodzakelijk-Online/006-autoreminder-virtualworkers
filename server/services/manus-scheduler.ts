import { getDb } from "../db";
import {
  dailyComplianceSnapshots,
  onHoldDailyChecks,
  timeEntries,
  users,
  vaProfiles,
} from "../../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  getWorkerCards,
  getWorkerCommentedCardIdsToday,
  isDoingList,
  isOnHoldList,
} from "./trello-manus";
import { notifyOwner } from "../_core/notification";
import { parseDateKey } from "../utils/date-only";

let schedulerInterval: NodeJS.Timeout | null = null;

export function startManusScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log("[ManusScheduler] Starting Manus background cron scheduler");
  schedulerInterval = setInterval(async () => {
    try {
      await runBackgroundTasks();
    } catch (error) {
      console.error("[ManusScheduler] Error in runBackgroundTasks:", error);
    }
  }, 60 * 1000);
}

export function stopManusScheduler() {
  if (!schedulerInterval) return;
  clearInterval(schedulerInterval);
  schedulerInterval = null;
  console.log("[ManusScheduler] Stopped Manus background cron scheduler");
}

async function runBackgroundTasks() {
  const db = await getDb();
  if (!db) return;

  const activeWorkers = await db.select()
    .from(vaProfiles)
    .where(eq(vaProfiles.status, "active"));

  for (const worker of activeWorkers) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: worker.timezone || "UTC",
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(new Date());
      const currentHour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
      const currentMinute = Number(parts.find(part => part.type === "minute")?.value ?? 0);

      if (currentHour === 0 && currentMinute === 0) {
        await runAutoStopForWorker(worker);
      }
      if (currentHour === 22 && currentMinute === 30) {
        await runComplianceSnapshotForWorker(worker);
      }
    } catch (error) {
      console.error(`[ManusScheduler] Error processing worker ${worker.id}:`, error);
    }
  }
}

async function runAutoStopForWorker(worker: typeof vaProfiles.$inferSelect) {
  console.log(`[ManusScheduler] Running auto-stop for worker ${worker.name}...`);
  const db = await getDb();
  if (!db) return;

  const maxSeconds = 12 * 3600;
  const now = new Date();
  const running = await db.select().from(timeEntries).where(
    and(eq(timeEntries.vaId, worker.userId), isNull(timeEntries.endTime)),
  );

  const stopped: Array<(typeof timeEntries.$inferSelect) & {
    durationSeconds: number;
    wasCapped: boolean;
  }> = [];
  for (const entry of running) {
    const rawSeconds = Math.round((now.getTime() - entry.startTime.getTime()) / 1000);
    const durationSeconds = Math.min(rawSeconds, maxSeconds);
    const durationMinutes = Math.round(durationSeconds / 60);
    const wasCapped = rawSeconds > maxSeconds;

    await db.update(timeEntries)
      .set({ endTime: now, durationSeconds, durationMinutes })
      .where(eq(timeEntries.id, entry.id));
    stopped.push({ ...entry, durationSeconds, wasCapped });
  }

  if (stopped.length === 0) return;
  const founder = await db.select().from(users).where(eq(users.id, worker.founderId)).limit(1);
  if (founder.length === 0) return;

  const lines = stopped.map(entry => {
    const hours = Math.floor(entry.durationSeconds / 3600);
    const minutes = Math.floor((entry.durationSeconds % 3600) / 60);
    const capped = entry.wasCapped ? " (capped at 12h)" : "";
    return `- ${entry.cardName || "Unknown Card"}: ${hours}h ${minutes}m${capped}`;
  });
  await notifyOwner({
    title: `Auto-stopped ${stopped.length} timer(s) for ${worker.name}`,
    content: [
      `The following timers for ${worker.name} were automatically stopped at midnight local time:`,
      "",
      ...lines,
      "",
      stopped.some(entry => entry.wasCapped)
        ? "Entries marked capped were running for more than 12 hours and should be reviewed."
        : "All durations are below the 12-hour safety cap.",
    ].join("\n"),
  });
}

async function runComplianceSnapshotForWorker(worker: typeof vaProfiles.$inferSelect) {
  if (new Date().getDay() === 0) return;
  try {
    await collectComplianceSnapshot(worker, "auto");
  } catch (error) {
    console.error(`[ManusScheduler] Error creating compliance snapshot for ${worker.name}:`, error);
  }
}

export async function collectComplianceSnapshot(
  worker: typeof vaProfiles.$inferSelect,
  source: "auto" | "manual",
) {
  const todayEAT = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log(`[ManusScheduler] Collecting compliance for ${worker.name} on ${todayEAT}`);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_TOKEN;
  if (!apiKey || !apiToken) throw new Error("Trello API credentials not configured");

  const trelloMemberId = worker.trelloMemberId || "me";
  const [allCards, commentedCardIds] = await Promise.all([
    getWorkerCards(apiKey, apiToken, trelloMemberId),
    getWorkerCommentedCardIdsToday(apiKey, apiToken, trelloMemberId),
  ]);
  const doingCards = allCards.filter(card => card.list && isDoingList(card.list.name));
  const onHoldCards = allCards.filter(card => card.list && isOnHoldList(card.list.name));
  const doingUpdated = doingCards.filter(card => commentedCardIds.has(card.id));
  const doingMissed = doingCards.filter(card => !commentedCardIds.has(card.id));

  const snapshotDate = parseDateKey(todayEAT);
  const checkedOnHold = await db.select().from(onHoldDailyChecks).where(and(
    eq(onHoldDailyChecks.vaId, worker.userId),
    eq(onHoldDailyChecks.date, snapshotDate),
    eq(onHoldDailyChecks.checked, true),
  ));
  const checkedOnHoldIds = new Set(checkedOnHold.map(check => check.cardId));
  const onHoldReviewed = onHoldCards.filter(card => checkedOnHoldIds.has(card.id)).length;
  const d1Instances = doingMissed.length;

  const values = {
    vaId: worker.userId,
    founderId: worker.founderId,
    snapshotDate,
    onHoldTotal: onHoldCards.length,
    onHoldReviewed,
    onHoldMissedCards: JSON.stringify(
      onHoldCards
        .filter(card => !checkedOnHoldIds.has(card.id))
        .map(card => ({ id: card.id, name: card.name, url: card.url })),
    ),
    doingTotal: doingCards.length,
    doingUpdated: doingUpdated.length,
    doingMissedCards: JSON.stringify(
      doingMissed.map(card => ({ id: card.id, name: card.name, url: card.url })),
    ),
    d1Instances,
    estimatedPenalty: String(d1Instances * 5),
    source,
  };

  await db.insert(dailyComplianceSnapshots).values(values).onDuplicateKeyUpdate({
    set: values,
  });
  const rows = await db.select().from(dailyComplianceSnapshots).where(and(
    eq(dailyComplianceSnapshots.vaId, worker.userId),
    eq(dailyComplianceSnapshots.snapshotDate, snapshotDate),
  )).limit(1);

  if (!rows[0]) throw new Error("Compliance snapshot was not persisted");
  return rows[0];
}
