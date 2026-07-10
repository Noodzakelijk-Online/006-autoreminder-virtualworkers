/**
 * Scheduled Daily Summary Endpoint
 *
 * POST /api/scheduled/daily-summary
 *
 * Called by the Manus scheduled task agent at 22:30 Kenyan time (19:30 UTC).
 * The agent fetches live Trello state, composes a summary of pending actions,
 * and POSTs it here. This handler then sends an owner notification via the
 * built-in notification API.
 *
 * Auth: uses the scheduled-task session cookie (role = "user").
 */
import type { Express } from "express";
import { notifyOwner } from "./_core/notification";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";

export function registerScheduledDailySummaryRoute(app: Express) {
  app.post("/api/scheduled/daily-summary", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      const { title, content } = req.body as { title?: string; content?: string };

      if (!title || !content) {
        res.status(400).json({ error: "title and content are required" });
        return;
      }

      const sent = await notifyOwner({ title, content });
      res.json({ success: true, notified: sent });
    } catch (err) {
      console.error("[ScheduledDailySummary] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
