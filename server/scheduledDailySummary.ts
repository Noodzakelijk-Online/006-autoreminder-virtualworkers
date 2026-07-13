/**
 * Scheduled daily summary endpoint.
 *
 * POST /api/scheduled/daily-summary
 * Accepts a prepared summary from the external scheduler and records delivery.
 */
import type { Express } from "express";
import { notifyOwner } from "./_core/notification";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";
import { runTrackedJob } from "./scheduledJobsDb";

export function registerScheduledDailySummaryRoute(app: Express) {
  app.post("/api/scheduled/daily-summary", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    const { title, content } = req.body as { title?: string; content?: string };
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: "title and content are required" });
      return;
    }

    try {
      const sent = await runTrackedJob({
        jobKey: "daily_summary",
        trigger: "external",
        run: () => notifyOwner({ title: title.trim(), content: content.trim() }),
        summarize: (notified) => ({
          recordsProcessed: notified ? 1 : 0,
          detail: notified ? "Owner notification sent" : "Notification provider did not confirm delivery",
        }),
      });
      res.json({ success: true, notified: sent });
    } catch (error) {
      console.error("[ScheduledDailySummary] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
