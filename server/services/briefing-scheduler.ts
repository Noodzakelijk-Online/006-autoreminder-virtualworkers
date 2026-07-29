import { getDb } from '../db';
import { vaProfiles, users } from '../../drizzle/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { sendMorningBriefing, sendEODReport } from './email';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startBriefingScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log('[Scheduler] Starting automated daily briefing and EOD report scheduler');

  // Run every minute to check if any worker needs their briefing/report sent
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndSendReports();
    } catch (error) {
      console.error('[Scheduler] Error in checkAndSendReports:', error);
    }
  }, 60 * 1000);
}

export function stopBriefingScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped automated scheduler');
  }
}

async function checkAndSendReports() {
  const db = await getDb();
  if (!db) return;

  // We need current time in various timezones.
  // The simplest approach is to check each worker's profile, calculate their local time, and see if it matches their start/end hour.
  // However, we only have workStartHour and workEndHour right now.
  // We'll trigger morning briefing at `workStartHour : 00` (local time for the worker)
  // We'll trigger EOD report at `workEndHour : 00` (local time for the worker)

  const activeWorkers = await db.select()
    .from(vaProfiles)
    .where(eq(vaProfiles.status, 'active'));

  for (const worker of activeWorkers) {
    try {
      // Get worker's current local time
      const workerTimezone = worker.timezone || 'UTC';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: workerTimezone,
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23', // 0-23
      });

      const parts = formatter.formatToParts(new Date());
      const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

      // Only run exactly on the hour/minute (minute === 0)
      if (currentMinute === 0) {
        // Find the founder
        const founder = await db.select().from(users).where(eq(users.id, worker.founderId)).limit(1);
        if (!founder || founder.length === 0) continue;

        const founderOpenId = founder[0].openId;

        if (currentHour === worker.workStartHour) {
          console.log(`[Scheduler] Triggering Morning Briefing for ${worker.name} (${workerTimezone})`);
          await sendMorningBriefing(founderOpenId, worker.id).catch(err => {
            console.error(`[Scheduler] Failed to send morning briefing for ${worker.name}:`, err);
          });
        }

        if (currentHour === worker.workEndHour) {
          console.log(`[Scheduler] Triggering EOD Report for ${worker.name} (${workerTimezone})`);
          await sendEODReport(founderOpenId, worker.id).catch(err => {
            console.error(`[Scheduler] Failed to send EOD report for ${worker.name}:`, err);
          });
        }
      }
    } catch (err) {
      console.error(`[Scheduler] Error processing worker ${worker.id}:`, err);
    }
  }
}
