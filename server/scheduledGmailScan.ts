/**
 * Scheduled Gmail Scan Endpoint
 *
 * POST /api/scheduled/gmail-scan
 *
 * Backward-compatible external import endpoint. Normal unattended ingestion now
 * runs directly inside the server through gmailIngestion.ts.
 *
 * Also handles snooze resurface: expired snoozes are automatically
 * cleared so cards reappear in ActionAlerts.
 *
 * POST /api/scheduled/gmail-resurface
 *
 * Kept for compatibility with external snooze-resurface callers.
 */
import type { Express } from "express";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";
import { upsertEmailTask, resurfaceExpiredSnoozes } from "./db";
import { runTrackedJob } from "./scheduledJobsDb";

interface EmailTaskPayload {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  snippet?: string;
  receivedAt: string; // ISO string
  category: "financial" | "non_financial";
  status?: "pending" | "processed" | "archived";
  deadlineAt?: string; // ISO string, for financial emails
  suggestedNextAction?: string;
  llmSummary?: string;
}

export function registerScheduledGmailScanRoute(app: Express) {
  // External batch import kept for compatibility with owner integrations.
  app.post("/api/scheduled/gmail-scan", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      const body = req.body as { emails?: EmailTaskPayload[] };
      if (!body.emails || !Array.isArray(body.emails)) {
        res.status(400).json({ error: "emails array is required" });
        return;
      }

      const { upserted, errors } = await runTrackedJob({
        jobKey: "gmail_ingestion",
        trigger: "external",
        run: async () => {
          let upserted = 0;
          let errors = 0;
          for (const email of body.emails!) {
            try {
              await upsertEmailTask({
                gmailMessageId: email.gmailMessageId,
                gmailThreadId: email.gmailThreadId,
                subject: email.subject || "(no subject)",
                fromAddress: email.fromAddress || "",
                fromName: email.fromName || "",
                snippet: email.snippet ?? null,
                receivedAt: new Date(email.receivedAt),
                category: email.category || "non_financial",
                status: email.status || "pending",
                deadlineAt: email.deadlineAt ? new Date(email.deadlineAt) : null,
                suggestedNextAction: email.suggestedNextAction ?? null,
                llmSummary: email.llmSummary ?? null,
              } as any);
              upserted++;
            } catch (err) {
              console.error("[GmailScan] Failed to upsert email:", email.gmailMessageId, err);
              errors++;
            }
          }
          return { upserted, errors };
        },
        summarize: (result) => ({ recordsProcessed: result.upserted, detail: `${result.upserted} imported, ${result.errors} rejected` }),
      });

      console.log(`[GmailScan] Upserted ${upserted} emails, ${errors} errors`);
      res.json({ success: true, upserted, errors });
    } catch (err) {
      console.error("[GmailScan] Error:", err);
      res.status(500).json({ error: "Internal server error", details: String(err) });
    }
  });

  // ── Snooze resurface: clear expired snoozes ──────────────────────────────────
  app.post("/api/scheduled/gmail-resurface", async (req, res) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      const resurfaced = await runTrackedJob({
        jobKey: "snooze_resurface",
        trigger: "external",
        run: resurfaceExpiredSnoozes,
        summarize: (count) => ({ recordsProcessed: count, detail: `${count} snoozes resurfaced` }),
      });
      console.log(`[GmailResurface] Resurfaced ${resurfaced} expired snoozes`);
      res.json({ success: true, resurfaced });
    } catch (err) {
      console.error("[GmailResurface] Error:", err);
      res.status(500).json({ error: "Internal server error", details: String(err) });
    }
  });
}
