/**
 * Scheduled Auto-Stop Timers Endpoint
 *
 * POST /api/scheduled/auto-stop-timers
 *
 * Called by the Manus scheduled task agent at midnight EAT (21:00 UTC).
 * Stops any timer that has been running for more than 12 hours, capping
 * the duration at 12h and flagging it so Joyce can correct it the next morning.
 * Sends an owner notification listing the auto-stopped entries.
 *
 * Auth: uses the scheduled-task session cookie (role = "user").
 */
import type { Express } from "express";
import { autoStopAllRunningTimers } from "./db";
import { notifyOwner } from "./_core/notification";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";

export function registerScheduledAutoStopTimersRoute(app: Express) {
  app.post("/api/scheduled/auto-stop-timers", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      const stopped = await autoStopAllRunningTimers(12 * 3600);

      if (stopped.length === 0) {
        res.json({ success: true, stopped: 0, message: "No running timers found" });
        return;
      }

      // Build notification content
      const lines = stopped.map(e => {
        const h = Math.floor(e.durationSeconds / 3600);
        const m = Math.floor((e.durationSeconds % 3600) / 60);
        const flag = e.wasCapped ? " ⚠️ CAPPED at 12h" : "";
        return `• ${e.cardName} — ${h}h ${m}m${flag}`;
      });

      const title = `⏹ Auto-stopped ${stopped.length} timer${stopped.length > 1 ? "s" : ""} at midnight`;
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

      res.json({ success: true, stopped: stopped.length, entries: stopped });
    } catch (err) {
      console.error("[ScheduledAutoStopTimers] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
