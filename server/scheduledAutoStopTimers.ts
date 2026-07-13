/**
 * Scheduled timer safety endpoint.
 *
 * POST /api/scheduled/auto-stop-timers
 * Stops every running timer at midnight EAT and caps entries at 12 hours.
 */
import type { Express } from "express";
import { notifyOwner } from "./_core/notification";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";
import { autoStopManagedTimers } from "./timerService";
import { runTrackedJob } from "./scheduledJobsDb";

export function registerScheduledAutoStopTimersRoute(app: Express) {
  app.post("/api/scheduled/auto-stop-timers", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      const stopped = await runTrackedJob({
        jobKey: "timer_auto_stop",
        trigger: "external",
        run: async () => {
          const entries = await autoStopManagedTimers(12 * 3600);
          if (entries.length === 0) return entries;

          const lines = entries.map((entry) => {
            const hours = Math.floor(entry.durationSeconds / 3600);
            const minutes = Math.floor((entry.durationSeconds % 3600) / 60);
            const flag = entry.wasCapped ? " CAPPED at 12h" : "";
            return `- ${entry.cardName}: ${hours}h ${minutes}m${flag}`;
          });
          await notifyOwner({
            title: `Auto-stopped ${entries.length} timer${entries.length > 1 ? "s" : ""} at midnight`,
            content: [
              "The following timers were automatically stopped at midnight EAT:",
              "",
              ...lines,
              "",
              entries.some((entry) => entry.wasCapped)
                ? "Entries marked CAPPED ran for more than 12 hours. Correct them in Time Tracker."
                : "All recorded durations are within the 12-hour safety limit.",
            ].join("\n"),
          });
          return entries;
        },
        summarize: (entries) => ({
          recordsProcessed: entries.length,
          detail: entries.length ? `${entries.length} timers auto-stopped` : "No running timers found",
        }),
      });

      res.json({
        success: true,
        stopped: stopped.length,
        entries: stopped,
        message: stopped.length ? undefined : "No running timers found",
      });
    } catch (error) {
      console.error("[ScheduledAutoStopTimers] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
