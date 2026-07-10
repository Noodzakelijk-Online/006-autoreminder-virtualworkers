import { getDb } from '../db';
import {
  vaProfiles,
  users,
  timeEntries,
  dailyComplianceSnapshots,
  weeklyPayLog,
  onHoldDailyChecks
} from '../../drizzle/schema';
import { eq, and, isNull, gte, lte, isNotNull, sql } from 'drizzle-orm';
import { getWorkerCards, getWorkerCommentedCardIdsToday, isDoingList, isOnHoldList } from './trello-manus';
import { notifyOwner } from '../_core/notification';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startManusScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log('[ManusScheduler] Starting Manus background cron scheduler');

  // Run every 1 minute
  schedulerInterval = setInterval(async () => {
    try {
      await runBackgroundTasks();
    } catch (error) {
      console.error('[ManusScheduler] Error in runBackgroundTasks:', error);
    }
  }, 60 * 1000);
}

export function stopManusScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ManusScheduler] Stopped Manus background cron scheduler');
  }
}

async function runBackgroundTasks() {
  const db = await getDb();
  if (!db) return;

  const activeWorkers = await db.select()
    .from(vaProfiles)
    .where(eq(vaProfiles.status, 'active'));

  for (const worker of activeWorkers) {
    try {
      const workerTimezone = worker.timezone || 'UTC';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: workerTimezone,
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      });

      const parts = formatter.formatToParts(new Date());
      const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

      // Midnight auto-stop EAT/local time (00:00)
      if (currentHour === 0 && currentMinute === 0) {
        await runAutoStopForWorker(worker);
      }

      // EOD compliance snapshot EAT/local time (22:30)
      if (currentHour === 22 && currentMinute === 30) {
        await runComplianceSnapshotForWorker(worker);
      }
    } catch (err) {
      console.error(`[ManusScheduler] Error processing worker ${worker.id}:`, err);
    }
  }
}

async function runAutoStopForWorker(worker: any) {
  console.log(`[ManusScheduler] Running auto-stop for worker ${worker.name}...`);
  const db = await getDb();
  if (!db) return;

  const maxSeconds = 12 * 3600; // 12 hours
  const now = new Date();

  // Find running timers for this worker
  const running = await db.select().from(timeEntries).where(
    and(eq(timeEntries.vaId, worker.userId), isNull(timeEntries.endTime))
  );

  const stopped = [];
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
  if (!founder || founder.length === 0) return;

  const lines = stopped.map(e => {
    const h = Math.floor((e.durationSeconds || 0) / 3600);
    const m = Math.floor(((e.durationSeconds || 0) % 3600) / 60);
    const flag = e.wasCapped ? " ⚠️ CAPPED at 12h" : "";
    return `• ${e.cardName || 'Unknown Card'} — ${h}h ${m}m${flag}`;
  });

  const title = `⏹ Auto-stopped ${stopped.length} timer(s) for ${worker.name}`;
  const content = [
    `The following timers for worker ${worker.name} were automatically stopped at midnight local time:`,
    "",
    ...lines,
    "",
    stopped.some(e => e.wasCapped)
      ? "⚠️ Entries marked CAPPED were running for more than 12 hours — please correct the duration in the Time Tracker."
      : "All durations look reasonable. No corrections needed.",
  ].join("\n");

  await notifyOwner({ title, content });
}

async function runComplianceSnapshotForWorker(worker: any) {
  const now = new Date();
  // Skip Sundays (worker.workDays is typically a string list like "1,2,3,4,5", 0=Sunday)
  if (now.getDay() === 0) return;

  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const todayEAT = new Date(Date.now() + eatOffsetMs).toISOString().slice(0, 10);

  console.log(`[ManusScheduler] Running EOD compliance snapshot for ${worker.name} on ${todayEAT}...`);

  const db = await getDb();
  if (!db) return;

  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_TOKEN;
  if (!apiKey || !apiToken) return;

  try {
    const trelloMemberId = worker.trelloMemberId || 'me';
    const [allCards, commentedCardIds] = await Promise.all([
      getWorkerCards(apiKey, apiToken, trelloMemberId),
      getWorkerCommentedCardIdsToday(apiKey, apiToken, trelloMemberId),
    ]);

    const doingCards = allCards.filter(c => c.list && isDoingList(c.list.name));
    const onHoldCards = allCards.filter(c => c.list && isOnHoldList(c.list.name));
    const doingUpdated = doingCards.filter(c => commentedCardIds.has(c.id));
    const doingMissed = doingCards.filter(c => !commentedCardIds.has(c.id));

    // ON-HOLD checked today
    const checkedOnHold = await db.select().from(onHoldDailyChecks).where(
      and(
        eq(onHoldDailyChecks.vaId, worker.userId),
        eq(onHoldDailyChecks.date, todayEAT),
        eq(onHoldDailyChecks.checked, true)
      )
    );
    const checkedOnHoldIds = new Set(checkedOnHold.map(c => c.cardId));

    const onHoldReviewedCount = onHoldCards.filter(c => checkedOnHoldIds.has(c.id)).length;
    const d1Instances = doingMissed.length;
    const estimatedPenalty = d1Instances * 5; // $5 demerit

    await db.insert(dailyComplianceSnapshots).values({
      vaId: worker.userId,
      founderId: worker.founderId,
      snapshotDate: todayEAT,
      onHoldTotal: onHoldCards.length,
      onHoldReviewed: onHoldReviewedCount,
      onHoldMissedCards: JSON.stringify(onHoldCards.filter(c => !checkedOnHoldIds.has(c.id)).map(c => ({ id: c.id, name: c.name, url: c.url }))),
      doingTotal: doingCards.length,
      doingUpdated: doingUpdated.length,
      doingMissedCards: JSON.stringify(doingMissed.map(c => ({ id: c.id, name: c.name, url: c.url }))),
      d1Instances,
      estimatedPenalty: String(estimatedPenalty),
      source: "auto",
    });

    console.log(`[ManusScheduler] Compliance snapshot saved successfully for ${worker.name}.`);
  } catch (error) {
    console.error(`[ManusScheduler] Error creating compliance snapshot for ${worker.name}:`, error);
  }
}
