import type { Application, Request, Response } from "express";
import { assertScheduledTaskAuthorized } from "./_core/scheduledAuth";
import { runWeeklyAnalysis } from "./weeklyAnalysisService";

export function registerScheduledWeeklyAnalysisRoute(app: Application): void {
  app.post("/api/scheduled/weekly-analysis", async (req: Request, res: Response) => {
    if (!assertScheduledTaskAuthorized(req, res)) return;

    try {
      res.json(await runWeeklyAnalysis("external", { force: false, notify: true }));
    } catch (error) {
      console.error("[WeeklyAnalysis] Failed:", error);
      res.status(500).json({
        error: "Weekly analysis failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
