import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/** Keeps the always-mounted workspace synchronized with server and cross-tab changes. */
export function useOperationalEvents() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const events = new EventSource("/api/sse/trello");
    const onTrelloChange = () => {
      void utils.trello.actionAlerts.invalidate();
      void utils.aptlss.getWorkQueueContext.invalidate();
      void utils.aptlss.getActiveWaitingReasons.invalidate();
    };
    const onTimerChange = () => {
      void utils.timer.getActive.invalidate();
      void utils.timer.getDailySummary.invalidate();
      void utils.timer.getWeeklyTotal.invalidate();
      void utils.timer.getWeeklyBreakdown.invalidate();
      void utils.timer.getDailyEvidence.invalidate();
      void utils.timer.getWeeklyEvidence.invalidate();
      void utils.compliance.getHistory.invalidate();
    };
    const onPayChange = () => {
      void utils.payment.getAllCycles.invalidate();
      void utils.payment.getCurrentCycle.invalidate();
      void utils.payLog.getAll.invalidate();
      void utils.payLog.getByWeek.invalidate();
    };
    const onReplyScan = () => {
      void utils.system.navigationCounts.invalidate();
      void utils.replyMonitor.getPendingThreads.invalidate();
      void utils.replyMonitor.getActiveVagueFlags.invalidate();
      void utils.replyMonitor.getActiveUnsignedFlags.invalidate();
      void utils.replyMonitor.getAllThreads.invalidate();
      void utils.replyMonitor.getAllVagueFlags.invalidate();
      void utils.replyMonitor.getAllUnsignedFlags.invalidate();
      void utils.replyMonitor.getStatus.invalidate();
    };
    const onAptlssChange = () => {
      void utils.system.navigationCounts.invalidate();
      void utils.aptlss.getWorkQueueContext.invalidate();
      void utils.aptlss.getActiveWaitingReasons.invalidate();
      void utils.aptlss.getDecisionQueue.invalidate();
      void utils.aptlss.getCommandCenter.invalidate();
      void utils.aptlss.getDecisionHistory.invalidate();
      void utils.aptlss.getDailyPlan.invalidate();
      void utils.aptlss.getLatestWeeklyAnalysis.invalidate();
      void utils.aptlss.getWeeklyAnalysisHistory.invalidate();
    };
    const onGmailChange = () => {
      void utils.system.navigationCounts.invalidate();
      void utils.emailInbox.getPending.invalidate();
      void utils.emailInbox.getAll.invalidate();
      void utils.settings.getGmailIngestion.invalidate();
    };
    const onComplianceChange = () => {
      void utils.compliance.getHistory.invalidate();
      void utils.compliance.getClarifications.invalidate();
      void utils.compliance.getCommunicationEvidence.invalidate();
    };
    const onJobsChange = () => {
      void utils.system.scheduledJobFreshness.invalidate();
    };

    events.addEventListener("trello-invalidate", onTrelloChange);
    events.addEventListener("timer-invalidate", onTimerChange);
    events.addEventListener("pay-invalidate", onPayChange);
    events.addEventListener("scan-complete", onReplyScan);
    events.addEventListener("aptlss-invalidate", onAptlssChange);
    events.addEventListener("gmail-invalidate", onGmailChange);
    events.addEventListener("compliance-invalidate", onComplianceChange);
    events.addEventListener("jobs-invalidate", onJobsChange);
    return () => events.close();
  }, [utils]);
}
