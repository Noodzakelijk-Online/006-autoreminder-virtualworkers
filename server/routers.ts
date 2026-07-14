import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { ownerProcedure as protectedProcedure, router } from "./_core/trpc";
import { runAptlssMaintenance } from "./scheduledAptlssMaintenance";
import { runTrackedJob } from "./scheduledJobsDb";
import { factCheckComplianceHistory } from "./complianceHistoryFactCheck";
import {
  ComplianceClarificationError,
  getComplianceClarifications,
  getComplianceCommunicationEvidenceByDate,
  resolveComplianceClarification,
} from "./complianceCommunicationDb";
import { replyMonitorRouter } from "./replyMonitorRouter";
import { powerUpRouter } from "./powerUpRouter";
import { APTLSS_ASSESSMENT_VERSION, APTLSS_NEAR_CERTAINTY_TARGET } from "./aptlssAssessment";
import { getAssessmentHistory, getLatestAssessment, getLatestAssessments } from "./aptlssAssessmentDb";
import { queueCardReassessment, reassessCardById } from "./aptlssReassessment";
import { APTLSS_CARD_STATES } from "./aptlssStateValues";
import {
  getAllEmailTasks,
  getPendingEmailTasks,
  updateEmailTaskStatus,
  archiveAllEmailTasks,
  getPendingEmailCount,
  upsertEmailTask,
  snoozeCard,
  cancelCardSnooze,
  getActiveSnoozes,
  getActiveSnoozedCardIds,
  getCardSnooze,
  resurfaceExpiredSnoozes,
} from "./db";
import { getJoyceCards, getJoyceRecentActions, getJoyceCommentedCardIdsToday, getRegisteredWebhooks, getJoyceBoards, getListCategory, getTrelloCacheStatus, isDoingList, isOnHoldList, moveCardToDoing } from "./trello";
import { postJoyceCardComment, postSystemCardComment } from "./trelloCommentService";
import { getAptlssPlan, getAllAptlssPlans } from "./aptlssDb";
import {
  draftDailyHandoff,
  generateDailyPlan as buildDailyPlan,
  getEatDateKey,
  getSavedDailyPlan,
  replanRemainingDay as buildRemainingDayReplan,
  toLegacyDailySchedule,
  updateDailyPlan as persistDailyPlan,
  type DailyPlanPayload,
} from "./dailyPlan";
import {
  logAuditAction,
  getCardAuditLog,
  getRecentAuditLog,
  getRecentSyncLog,
  getLastSuccessfulSync,
  getSyncStats24h,
} from "./aptlssAuditDb";
import {
  getOpenStepsForCard,
  getAllRobertDecisionSteps,
  completeStepByCheckItemId,
  completeStepsByIds,
  uncompleteStepByCheckItemId,
  resolveRobertStep,
  getCardStepProgress,
  getCardState,
  getAllCardStates,
  getPriorityScore,
  getAllPriorityScores,
  getNeedsRepairCards,
  getReadyForDoneCards,
  getAllAptlssSteps,
} from "./aptlssStepsDb";
import {
  DecisionOutcomeError,
  getDecisionHistory,
  recordDecisionOutcome,
} from "./decisionOutcomesDb";
import {
  AssessmentFeedbackError,
  getAssessmentCalibration,
  getAssessmentReviewQueue,
  recordAssessmentFeedback,
} from "./aptlssFeedbackDb";
import { interpretWaitingReasonFreeform } from "./aptlssWaitingReasonService";
import {
  WaitingReasonError,
  getActiveWaitingReason,
  getActiveWaitingReasons,
  getWaitingReasonHistory,
  recordAptlssWaitingReason,
  resolveAptlssWaitingReason,
  toAptlssWaitingSignal,
} from "./aptlssWaitingReasonDb";
import { invokeLLM } from "./_core/llm";
import { generateAptlssPlanForCard } from "./aptlssPlanService";
import { getDoneGateStatus } from "./aptlssDoneGate";
import { selectWorkQueueNextAction } from "./aptlssWorkQueue";
import { getLatestJobRuns, getRecentJobRuns } from "./scheduledJobsDb";
import { createGmailOauthAuthorizationUrl, requestOrigin } from "./gmailOauth";
import {
  disconnectGmail,
  getGmailIntegrationStatus,
  rescheduleGmailIngestion,
} from "./gmailIngestion";
import { runWorkspaceIngestion } from "./workspaceIngestion";
import {
  clearGmailOauthConnection,
  getGmailOauthClientCredentials,
  getGmailOauthConnection,
  saveGmailOauthClientCredentials,
  setGmailIngestionSettings,
} from "./gmailIngestionSettings";
import {
  deleteManagedTimeEntry,
  startManagedTimer,
  stopManagedTimer,
  updateManagedTimeEntry,
} from "./timerService";
import { broadcast } from "./sse";
import {
  dateKeySchema,
  mondayDateKeySchema,
  payWeekRangeSchema,
  sundayDateKeySchema,
  timerStartInputSchema,
  trelloCardIdSchema,
  weekDateRangeSchema,
} from "./validation";
import {
  getAllPolicies,
  getPolicyValue,
  upsertPolicy,
  setPolicyEnabled,
  getPendingFollowUpDrafts,
  getAllFollowUpDrafts,
  markFollowUpDraftSent,
  dismissFollowUpDraft,
  getFollowUpDraftById,
  getAllWorkerPerformance,
  getLatestWeeklyAnalysis,
  getRecentWeeklyAnalyses,
  upsertWorkerPerformance,
  getAutopilotLevel,
  getOperationalPolicySnapshot,
} from "./aptlssPoliciesDb";
import {
  getAllPaymentCycles,
  getCurrentPaymentCycle,
  initializeCurrentPaymentCycle,
  markCycleAsPaid,
  getWeeklyPayLogs,
  getWeeklyPayLogByWeek,
  upsertWeeklyPayLog,
  getTriageStateByDate,
  upsertTriageState,
  getSundayChecklist,
  upsertSundayChecklist,
  recordStreakDay,
  getUpdateStreak,
  getOnHoldChecksByDate,
  markOnHoldCardChecked,
  getActiveTimer,
  getTimeEntriesForCard,
  getDailyTimeSummary,
  getTrackedSecondsInRange,
  getTimeEntriesForCardOnDate,
  getWeeklyBreakdown,
  getDailyGoalHours,
  setDailyGoalHours,
  getTrelloCommentToken,
  setTrelloCommentToken,
  upsertComplianceSnapshot,
  getComplianceHistory,
  getComplianceEvidenceByDate,
  getComplianceRollingAvg,
  getComplianceAvgForWeek,
  getScheduleSettings,
  setScheduleSettings,
  getRecentTriageReports,
  getReplyMonitorBadgeEnabled,
  setReplyMonitorBadgeEnabled,
} from "./db";
import {
  deleteOperatingHoliday,
  getOperatingDay,
  getOperatingProfile,
  listOperatingHolidays,
  upsertOperatingHoliday,
  upsertOperatingProfile,
} from "./operatingCalendar";
import {
  deleteProjectContext,
  listProjectContexts,
  upsertProjectContext,
} from "./projectContextDb";
import {
  getActiveTaskDependencies,
  resolveTaskDependency,
  upsertTaskDependency,
} from "./taskDependenciesDb";
import { getOutstandingCommunicationEvidence } from "./communicationEvidenceDb";
import { getRecentHandoffs, getRecentOperatorNotifications } from "./operatorRecordsDb";
import { getDailyTimeEvidence, getWeeklyTimeEvidence } from "./timeEvidence";

export const appRouter = router({
  system: systemRouter,
  powerup: powerUpRouter,

  operations: router({
    getCalendar: protectedProcedure
      .input(z.object({ dateKey: dateKeySchema.optional() }).optional())
      .query(async ({ input }) => {
        const dateKey = input?.dateKey ?? getEatDateKey();
        const [profile, holidays, day] = await Promise.all([
          getOperatingProfile(),
          listOperatingHolidays(),
          getOperatingDay(dateKey),
        ]);
        return { profile, holidays, day };
      }),
    updateCalendar: protectedProcedure
      .input(z.object({
        profileKey: z.string().trim().min(1).max(64).default("joyce"),
        timezone: z.string().trim().min(1).max(64),
        workStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        workEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        breaks: z.array(z.object({
          name: z.string().trim().min(1).max(128),
          startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          durationMinutes: z.number().int().min(5).max(240),
        })).max(12),
        weeklyHoursMin: z.number().int().min(0).max(168),
        weeklyHoursMax: z.number().int().min(0).max(168),
      }).refine((value) => value.weeklyHoursMax >= value.weeklyHoursMin, {
        message: "Maximum weekly hours must be greater than or equal to minimum weekly hours",
        path: ["weeklyHoursMax"],
      }))
      .mutation(({ input }) => upsertOperatingProfile(input)),
    upsertHoliday: protectedProcedure
      .input(z.object({
        dateKey: dateKeySchema,
        name: z.string().trim().min(1).max(256),
        kind: z.enum(["holiday", "leave", "exceptional_workday"]),
        source: z.enum(["manual", "calendar", "policy"]).default("manual"),
        notes: z.string().trim().max(4_000).nullable().optional(),
        active: z.boolean().default(true),
      }))
      .mutation(({ input }) => upsertOperatingHoliday(input)),
    deleteHoliday: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteOperatingHoliday(input.id);
        return { success: true };
      }),
    listProjects: protectedProcedure.query(() => listProjectContexts()),
    upsertProject: protectedProcedure
      .input(z.object({
        projectKey: z.string().trim().min(1).max(128),
        name: z.string().trim().min(1).max(512),
        clientName: z.string().trim().max(512).nullable().optional(),
        priority: z.enum(["standard", "priority", "vip"]),
        boardIds: z.array(z.string().trim().min(1).max(128)).max(100),
        contactEmail: z.string().email().max(320).nullable().optional(),
        notes: z.string().trim().max(10_000).nullable().optional(),
        active: z.boolean().default(true),
      }))
      .mutation(({ input }) => upsertProjectContext(input)),
    deleteProject: protectedProcedure
      .input(z.object({ projectKey: z.string().trim().min(1).max(128) }))
      .mutation(async ({ input }) => {
        await deleteProjectContext(input.projectKey);
        return { success: true };
      }),
    listDependencies: protectedProcedure
      .input(z.object({ cardIds: z.array(trelloCardIdSchema).max(250).optional() }).optional())
      .query(({ input }) => getActiveTaskDependencies(input?.cardIds)),
    upsertDependency: protectedProcedure
      .input(z.object({
        cardId: trelloCardIdSchema,
        dependsOnCardId: trelloCardIdSchema,
        dependencyType: z.enum(["finish_to_start", "start_to_start", "finish_to_finish"]).default("finish_to_start"),
        source: z.enum(["manual", "aptlss", "trello"]).default("manual"),
        evidence: z.record(z.string(), z.unknown()).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertTaskDependency(input);
        return { success: true };
      }),
    resolveDependency: protectedProcedure
      .input(z.object({ cardId: trelloCardIdSchema, dependsOnCardId: trelloCardIdSchema }))
      .mutation(async ({ input }) => {
        await resolveTaskDependency(input.cardId, input.dependsOnCardId);
        return { success: true };
      }),
    communicationExceptions: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional())
      .query(({ input }) => getOutstandingCommunicationEvidence(input?.limit)),
    notifications: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(250).default(50) }).optional())
      .query(({ input }) => getRecentOperatorNotifications(input?.limit)),
    handoffs: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
      .query(({ input }) => getRecentHandoffs(input?.limit)),
  }),

  // ─── Trello ──────────────────────────────────────────────────────────────────
  trello: router({
    weeklyHours: protectedProcedure.query(async () => {
      // Use local time entries with EAT (UTC+3) week bounds: Monday 00:00 to Sunday 23:59.
      const eatNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const dayOfWeek = eatNow.getUTCDay(); // 0=Sun
      const monday = new Date(eatNow);
      monday.setUTCDate(eatNow.getUTCDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const startDate = monday.toISOString().slice(0, 10);
      const endDate = sunday.toISOString().slice(0, 10);
      const trackedSeconds = await getTrackedSecondsInRange(startDate, endDate);
      const trackedHours = Math.round((trackedSeconds / 3600) * 10) / 10;
      return {
        totalHours: trackedHours,
        targetMin: 50,
        targetMax: 55,
        weekStart: monday.toISOString(),
        weekEnd: sunday.toISOString(),
      };
    }),

    recentUpdates: protectedProcedure.query(async () => {
      const apiKey = process.env.TrelloAPIKey;
      const apiToken = process.env.TrelloAPIToken;
      if (!apiKey || !apiToken) throw new Error("Trello API credentials not configured");
      // Fetch cards and actions in parallel — cards already have boardName attached
      const [cards, actions] = await Promise.all([
        getJoyceCards(apiKey, apiToken),
        getJoyceRecentActions(apiKey, apiToken, 15),
      ]);
      // Build cardId → boardName lookup
      const cardBoardMap = new Map<string, string>();
      for (const card of cards) {
        if (card.id && card.boardName) cardBoardMap.set(card.id, card.boardName);
      }
      return actions.map(action => ({
        id: action.id,
        type: action.type,
        date: action.date,
        cardName: action.data.card?.name || "Unknown Card",
        cardUrl: action.data.card?.id ? `https://trello.com/c/${action.data.card.id}` : "#",
        text: action.data.text,
        memberName: action.memberCreator.fullName,
        listBefore: action.data.listBefore?.name,
        listAfter: action.data.listAfter?.name,
        boardName: action.data.card?.id ? (cardBoardMap.get(action.data.card.id) ?? null) : null,
      }));
    }),
    // ── Action Alerts (live Trello state — no manual checkboxes) ─────────────
    actionAlerts: protectedProcedure
      .query(async () => {
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) throw new Error("Trello API credentials not configured");
        // ── SINGLE fetch: get all cards ONCE, then filter in-memory ─────────
        // Previously called getJoyceCards 6 times in parallel (= 18+ API calls).
        // Now: 1 cards call + N board-list calls (cached) + 1 comments call = ~4 total.
        const joycePersonalToken = await getTrelloCommentToken();
        const [allCards, commentedCardIds] = await Promise.all([
          getJoyceCards(apiKey, apiToken),
          getJoyceCommentedCardIdsToday(apiKey, apiToken, joycePersonalToken),
        ]);
        // EAT date for due-today comparison
        const eatOffsetMs = 3 * 60 * 60 * 1000;
        const todayEAT = new Date(Date.now() + eatOffsetMs).toISOString().slice(0, 10);
        const now = Date.now();
        // In-memory filters (no extra API calls)
        const noDueCards = allCards.filter(c => c.due === null || c.due === undefined);
        const doingCards = allCards
          .filter(c => c.list && isDoingList(c.list.name))
          .sort((a, b) => {
            if (!a.due && !b.due) return 0;
            if (!a.due) return 1;
            if (!b.due) return -1;
            return new Date(a.due).getTime() - new Date(b.due).getTime();
          });
        const onHoldCards = allCards.filter(c => c.list && isOnHoldList(c.list.name));
        const dueTodayCards = allCards.filter(c => {
          if (!c.due) return false;
          const dueDateEAT = new Date(new Date(c.due).getTime() + eatOffsetMs).toISOString().slice(0, 10);
          return dueDateEAT === todayEAT;
        });
        const overdueCards = allCards.filter(c => {
          if (!c.due) return false;
          return new Date(c.due).getTime() < now;
        });
        return {
          freshness: getTrelloCacheStatus(),
          // Alert 1: cards with no due date — resolved when Trello shows a due date
          noDueDateCards: noDueCards.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            listName: c.list?.name ?? "Unknown",
            boardName: c.boardName ?? "Unknown Board",
          })),
          // Alert 2: DOING cards — resolved when Joyce has commented on the card today
          doingCards: doingCards.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            due: c.due,
            listName: c.list?.name ?? "Unknown",
            boardName: c.boardName ?? "Unknown Board",
            updatedToday: commentedCardIds.has(c.id),
            dateLastActivity: c.dateLastActivity ?? null,
          })),
          // Morning Briefing: all cards due today (across all lists), categorised by list type
          dueTodayCards: dueTodayCards.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            due: c.due,
            listName: c.list?.name ?? "Unknown",
            boardName: c.boardName ?? "Unknown Board",
            listCategory: getListCategory(c.list?.name ?? ""),
          })),
          // Overdue cards: past their due date, not in DONE list
          overdueCards: overdueCards.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            due: c.due,
            listName: c.list?.name ?? "Unknown",
            boardName: c.boardName ?? "Unknown Board",
            listCategory: getListCategory(c.list?.name ?? ""),
          })),
          // Alert 3: ON-HOLD cards — resolved when card is no longer in ON-HOLD list
          onHoldCards: onHoldCards.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            due: c.due,
            listName: c.list?.name ?? "Unknown",
            boardName: c.boardName ?? "Unknown Board",
            dateLastActivity: c.dateLastActivity,
          })),
        };
      }),

    // ── Webhook Health Check ─────────────────────────────────────────────────
    webhooks: protectedProcedure.query(async () => {
      const apiKey = process.env.TrelloAPIKey;
      const apiToken = process.env.TrelloAPIToken;
      if (!apiKey || !apiToken) return [];
      // Fetch webhooks and boards in parallel to map idModel → board name
      const [webhooks, boards] = await Promise.all([
        getRegisteredWebhooks(apiKey, apiToken),
        getJoyceBoards(apiKey, apiToken),
      ]);
      const boardMap = new Map(boards.map(b => [b.id, b.name]));
      return webhooks.map(wh => ({
        ...wh,
        boardName: boardMap.get(wh.idModel) ?? null,
      }));
    }),

    // ── Post a comment on a card ─────────────────────────────────────────
    postComment: protectedProcedure
      .input(z.object({
        cardId: z.string().min(1),
        text: z.string().min(1).max(16384),
      }))
      .mutation(async ({ input }) => {
        const result = await postJoyceCardComment(input.cardId, input.text);
        return {
          success: true,
          actionId: result.id,
          date: result.date,
          usingCustomToken: result.attribution === "joyce_token",
          attribution: result.attribution,
        };
      }),

    // ── Get / set Trello comment token ─────────────────────────────────
    getCommentToken: protectedProcedure.query(async () => {
      const token = await getTrelloCommentToken();
      // Return only whether it's set and a masked preview — never the full token
      if (!token) return { isSet: false, preview: null };
      const masked = token.slice(0, 4) + '••••••••••••••••••••••••' + token.slice(-4);
      return { isSet: true, preview: masked };
    }),
    setCommentToken: protectedProcedure
      .input(z.object({ token: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await setTrelloCommentToken(input.token);
        return { success: true };
      }),
  }),
  // ─── Payment Cycles ──────────────────────────────────────────────────────────
  payment: router({
    getAllCycles: protectedProcedure.query(async () => {
      return await getAllPaymentCycles();
    }),

    getCurrentCycle: protectedProcedure.query(async () => {
      return await getCurrentPaymentCycle();
    }),

    initializeCurrent: protectedProcedure.mutation(async () => {
      const cycle = await initializeCurrentPaymentCycle();
      broadcast("pay-invalidate");
      return cycle;
    }),

    markPaid: protectedProcedure
      .input(z.object({ cycleId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await markCycleAsPaid(input.cycleId, ctx.user.openId);
        broadcast("pay-invalidate");
        return { success: true };
      }),
  }),

  // ─── Weekly Pay Log ──────────────────────────────────────────────────────────
  payLog: router({
    getAll: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }))
      .query(async ({ input }) => {
        return await getWeeklyPayLogs(input.limit ?? 10);
      }),

    getByWeek: protectedProcedure
      .input(z.object({ weekStart: mondayDateKeySchema }))
      .query(async ({ input }) => {
        return await getWeeklyPayLogByWeek(input.weekStart);
      }),

    upsert: protectedProcedure
      .input(payWeekRangeSchema.and(z.object({
        paymentCycleId: z.number().int().positive().optional(),
        meritM1: z.number().min(0).max(1_000).default(0),
        meritM2: z.number().min(0).max(1_000).default(0),
        meritM3: z.number().min(0).max(1_000).default(0),
        meritStreak: z.number().min(0).max(1_000).default(0),
        demeritD1: z.number().min(0).max(1_000).default(0),
        demeritD2: z.number().min(0).max(1_000).default(0),
        demeritD3: z.number().min(0).max(1_000).default(0),
        demeritD4: z.number().min(0).max(1_000).default(0),
        demeritD5: z.number().min(0).max(1_000).default(0),
        demeritD6: z.number().min(0).max(1_000).default(0),
        demeritD7: z.number().min(0).max(1_000).default(0),
        demeritD8: z.number().min(0).max(1_000).default(0),
        demeritD9: z.number().min(0).max(1_000).default(0),
        demeritD10: z.number().min(0).max(1_000).default(0),
        demeritD11: z.number().min(0).max(1_000).default(0),
        notes: z.string().max(10_000).optional(),
      })))
      .mutation(async ({ input }) => {
        const result = await upsertWeeklyPayLog(input);
        broadcast("pay-invalidate");
        return result;
      }),
  }),

  // ─── Daily Triage State ──────────────────────────────────────────────────────
  triage: router({
    getByDate: protectedProcedure
      .input(z.object({ date: dateKeySchema }))
      .query(async ({ input }) => {
        return await getTriageStateByDate(input.date);
      }),

    upsert: protectedProcedure
      .input(z.object({
        triageDate: dateKeySchema,
        step1Done: z.boolean().optional(),
        step2Done: z.boolean().optional(),
        step3Done: z.boolean().optional(),
        step4Done: z.boolean().optional(),
        step5Done: z.boolean().optional(),
        focusTasks: z.string().nullable().optional(),
        eveningStep1Done: z.boolean().optional(),
        eveningStep2Done: z.boolean().optional(),
        eveningStep3Done: z.boolean().optional(),
        eveningStep4Done: z.boolean().optional(),
        eodReport: z.string().nullable().optional(),
        currentView: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await upsertTriageState(input);
      }),

    /** Get the last 7 triage records that have an EOD report, newest first. */
    getRecent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getRecentTriageReports(input.limit ?? 7);
      }),
  }),

  // ─── ON-HOLD Per-Card Daily Checks ─────────────────────────────────────────
  onHoldChecks: router({
    /** Get all ON-HOLD check records for today. */
    getByDate: protectedProcedure
      .input(z.object({ date: dateKeySchema }))
      .query(async ({ input }) => {
        return await getOnHoldChecksByDate(input.date);
      }),
    /** Mark a specific ON-HOLD card as checked (or unchecked) for today. */
    markChecked: protectedProcedure
      .input(z.object({
        cardId: z.string(),
        cardName: z.string(),
        cardUrl: z.string(),
        date: dateKeySchema,
        checked: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        return await markOnHoldCardChecked(
          input.cardId,
          input.cardName,
          input.cardUrl,
          input.date,
          input.checked
        );
      }),
  }),
  // ─── Daily Update Streak ─────────────────────────────────────────────────
  streak: router({
    /** Get the current and longest streak for daily DOING card updates. */
    get: protectedProcedure.query(async () => {
      return await getUpdateStreak();
    }),

    /** Record that Joyce completed all DOING card updates before 23:00 today. */
    record: protectedProcedure
      .input(z.object({
        streakDate: dateKeySchema,
        completedBeforeDeadline: z.boolean(),
        doingCardCount: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await recordStreakDay(
          input.streakDate,
          input.completedBeforeDeadline,
          input.doingCardCount
        );
      }),
  }),

  // ─── Sunday Checklist ──────────────────────────────────────────────────────────────────────────────────
  sunday: router({
    getByDate: protectedProcedure
      .input(z.object({ date: sundayDateKeySchema }))
      .query(async ({ input }) => {
        return await getSundayChecklist(input.date);
      }),
    upsert: protectedProcedure
      .input(z.object({
        sundayDate: sundayDateKeySchema,
        trelloArchived: z.boolean().optional(),
        trelloLabels: z.boolean().optional(),
        trelloDeadlines: z.boolean().optional(),
        trelloTimers: z.boolean().optional(),
        emailInbox: z.boolean().optional(),
        whatsappCleared: z.boolean().optional(),
        upworkArchived: z.boolean().optional(),
        downloadsCleared: z.boolean().optional(),
        desktopCleared: z.boolean().optional(),
        browserTabsClosed: z.boolean().optional(),
        weekReviewed: z.boolean().optional(),
        nextWeekPlanned: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { sundayDate, ...fields } = input;
        return await upsertSundayChecklist(sundayDate, fields);
      }),
  }),

  // ─── Time Tracker ─────────────────────────────────────────────────────────────────────────────
  timer: router({
    /** Start a timer for a Trello card and atomically stop any other active timer. */
    start: protectedProcedure
      .input(timerStartInputSchema)
      .mutation(async ({ input }) => {
        return startManagedTimer(input);
      }),

    /** Stop the running timer for a card. Returns the completed entry or null if none was running. */
    stop: protectedProcedure
      .input(z.object({ cardId: trelloCardIdSchema }))
      .mutation(async ({ input }) => {
        return stopManagedTimer(input.cardId);
      }),

    /** Get the currently running timer entry (if any). */
    getActive: protectedProcedure.query(async () => {
      return await getActiveTimer();
    }),

    /** Get completed time entries for a specific card. */
    getByCard: protectedProcedure
      .input(z.object({ cardId: trelloCardIdSchema, limit: z.number().int().min(1).max(500).optional() }))
      .query(async ({ input }) => {
        return await getTimeEntriesForCard(input.cardId, input.limit ?? 20);
      }),

    /** Get daily time summary grouped by card for a given date (YYYY-MM-DD in EAT). */
    getDailySummary: protectedProcedure
      .input(z.object({ date: dateKeySchema }))
      .query(async ({ input }) => {
        return await getDailyTimeSummary(input.date);
      }),

    /** Source-backed daily timer allocation, target, and overtime in EAT. */
    getDailyEvidence: protectedProcedure
      .input(z.object({ date: dateKeySchema }))
      .query(async ({ input }) => getDailyTimeEvidence(input.date)),

    /** Get total tracked seconds in a date range (for weekly hours). */
    getWeeklyTotal: protectedProcedure
      .input(weekDateRangeSchema)
      .query(async ({ input }) => {
        const totalSeconds = await getTrackedSecondsInRange(input.startDate, input.endDate);
        return {
          totalSeconds,
          totalMinutes: Math.floor(totalSeconds / 60),
          totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
        };
      }),

    /** Delete a specific time entry by ID. */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteManagedTimeEntry(input.id);
      }),
    /** Update a time entry's duration (correction for overnight/accidental timers). */
    updateEntry: protectedProcedure
      .input(z.object({
        id: z.number(),
        durationSeconds: z.number().int().min(0).max(86400), // max 24h
      }))
      .mutation(async ({ input }) => {
        return updateManagedTimeEntry(input.id, input.durationSeconds);
      }),
    /** Get individual time entries for a card on a specific date (for the edit dialog). */
    getEntriesForCard: protectedProcedure
      .input(z.object({ cardId: trelloCardIdSchema, date: dateKeySchema }))
      .query(async ({ input }) => {
        return await getTimeEntriesForCardOnDate(input.cardId, input.date);
      }),
    /** Get tracked seconds per day for Mon–Sun week (for the weekly bar chart). */
    getWeeklyBreakdown: protectedProcedure
      .input(weekDateRangeSchema)
      .query(async ({ input }) => {
        return await getWeeklyBreakdown(input.startDate, input.endDate);
      }),
    /** One query for weekly totals, daily allocation, and contractual overtime. */
    getWeeklyEvidence: protectedProcedure
      .input(weekDateRangeSchema)
      .query(async ({ input }) => getWeeklyTimeEvidence(input.startDate, input.endDate)),
  }),

  // ─── Compliance Snapshots ───────────────────────────────────────────────────────────────────────────────────
  compliance: router({
    /** Get the last N compliance snapshots (newest first). */
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getComplianceHistory(input.limit ?? 30);
      }),

    /** Get the exact per-card evidence behind one verified history row. */
    getEvidence: protectedProcedure
      .input(z.object({ dateKey: dateKeySchema }))
      .query(async ({ input }) => getComplianceEvidenceByDate(input.dateKey)),

    /** Get the message and email facts behind one daily score. */
    getCommunicationEvidence: protectedProcedure
      .input(z.object({ dateKey: dateKeySchema }))
      .query(async ({ input }) => getComplianceCommunicationEvidenceByDate(input.dateKey)),

    /** Immediate Joyce updates required because source evidence was inconclusive. */
    getClarifications: protectedProcedure
      .input(z.object({ status: z.enum(["open", "resolved", "all"]).default("open"), limit: z.number().int().min(1).max(500).default(100) }).optional())
      .query(async ({ input }) => getComplianceClarifications(input?.status ?? "open", input?.limit ?? 100)),

    resolveClarification: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        resolution: z.enum(["completed", "not_completed", "not_required"]),
        response: z.string().trim().min(10).max(4_000),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await resolveComplianceClarification(input);
          broadcast("compliance-invalidate");
          return result;
        } catch (error) {
          if (error instanceof ComplianceClarificationError) {
            throw new TRPCError({
              code: error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "ALREADY_RESOLVED" ? "CONFLICT" : "BAD_REQUEST",
              message: error.message,
            });
          }
          throw error;
        }
      }),

    /** Get average compliance % for a specific week. */
    getWeekAvg: protectedProcedure
      .input(z.object({ weekStart: mondayDateKeySchema }))
      .query(async ({ input }) => {
        const avg = await getComplianceAvgForWeek(input.weekStart);
        return { avg };
      }),

    /** Get 7-day rolling average compliance %. */
    getRollingAvg: protectedProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        const avg = await getComplianceRollingAvg(input.days ?? 7);
        return { avg };
      }),

    /** Build and record today's compliance snapshot from live Trello data (manual trigger). */
    recordNow: protectedProcedure
      .mutation(async () => {
        const now = new Date();
        const todayEAT = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const checked = await factCheckComplianceHistory({ dateKeys: [todayEAT], source: "manual_verified", now });
        const result = checked.results[0];
        return {
          success: true,
          compliancePct: result.compliancePct,
          d1Instances: result.doingTotal - result.doingUpdated,
          doingTotal: result.doingTotal,
          onHoldTotal: result.onHoldTotal,
          evidenceCount: result.evidenceCount,
        };
      }),

    /** Replay Trello history and replace every daily aggregate with source-backed facts. */
    factCheckHistory: protectedProcedure
      .input(z.object({
        startDate: dateKeySchema.optional(),
        endDate: dateKeySchema.optional(),
      }).optional())
      .mutation(async ({ input }) => {
        return factCheckComplianceHistory({
          startDate: input?.startDate,
          endDate: input?.endDate,
          source: "fact_check",
        });
      }),

    /** Owner-only manual compliance snapshot correction. Scheduled jobs call the DB helper directly. */
    upsert: protectedProcedure
      .input(z.object({
        snapshotDate: dateKeySchema,
        onHoldTotal: z.number(),
        onHoldReviewed: z.number(),
        onHoldMissedCards: z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
        doingTotal: z.number(),
        doingUpdated: z.number(),
        doingMissedCards: z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
        d1Instances: z.number(),
        estimatedPenalty: z.number(),
        source: z.string().optional(),
        weeklyPayLogId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertComplianceSnapshot(input);
        return { success: true };
      }),
  }),

  /** App-wide settings (daily goal, etc.) */
  settings: router({
    /** Get the daily goal in hours (default 9). */
    getDailyGoal: protectedProcedure.query(async () => {
      const hours = await getDailyGoalHours();
      return { hours };
    }),
    /** Set the daily goal in hours (1–24). Owner-only. */
    setDailyGoal: protectedProcedure
      .input(z.object({ hours: z.number().min(1).max(24) }))
      .mutation(async ({ input }) => {
        await setDailyGoalHours(input.hours);
        return { success: true, hours: input.hours };
      }),

    /** Get the daily schedule settings (start/end time + breaks). */
    getSchedule: protectedProcedure.query(async () => {
      return await getScheduleSettings();
    }),

    /** Save the daily schedule settings. Owner-only. */
    setSchedule: protectedProcedure
      .input(z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        breaks: z.array(z.object({
          name: z.string().min(1).max(64),
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          durationMinutes: z.number().int().min(1).max(480),
        })),
      }))
      .mutation(async ({ input }) => {
        await setScheduleSettings(input);
        return { success: true };
      }),

    /** Get whether the Reply Monitor sidebar badge is enabled. */
    getReplyMonitorBadge: protectedProcedure.query(async () => {
      const enabled = await getReplyMonitorBadgeEnabled();
      return { enabled };
    }),

    /** Toggle the Reply Monitor sidebar badge on/off. Owner-only. */
    setReplyMonitorBadge: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        await setReplyMonitorBadgeEnabled(input.enabled);
        return { success: true, enabled: input.enabled };
      }),

    /** Gmail connection, internal interval, runtime state, and latest durable run. */
    getGmailIngestion: protectedProcedure.query(async ({ ctx }) => {
      return await getGmailIntegrationStatus(requestOrigin(ctx.req));
    }),

    /** Store the Google OAuth client encrypted with the server secret. */
    saveGmailOauthClient: protectedProcedure
      .input(z.object({
        clientId: z.string().trim().min(10).max(512),
        clientSecret: z.string().trim().min(6).max(2_048),
      }))
      .mutation(async ({ input }) => {
        const currentClient = await getGmailOauthClientCredentials();
        if (currentClient?.source === "environment") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google OAuth client settings are managed by the server environment" });
        }
        await saveGmailOauthClientCredentials(input.clientId, input.clientSecret);
        const connection = await getGmailOauthConnection();
        if (connection?.source === "database") await clearGmailOauthConnection();
        await rescheduleGmailIngestion();
        broadcast("gmail-invalidate");
        return { success: true, reconnectRequired: Boolean(connection) };
      }),

    /** Start the owner-approved Google OAuth flow in the current app origin. */
    beginGmailOauth: protectedProcedure.mutation(async ({ ctx }) => {
      return await createGmailOauthAuthorizationUrl(requestOrigin(ctx.req));
    }),

    disconnectGmail: protectedProcedure.mutation(async () => {
      await disconnectGmail();
      broadcast("gmail-invalidate");
      return { success: true };
    }),

    /** Persist the selected internal ingestion interval and reschedule immediately. */
    setGmailIngestion: protectedProcedure
      .input(z.object({
        enabled: z.boolean(),
        intervalMinutes: z.union([
          z.literal(5), z.literal(15), z.literal(30), z.literal(60),
          z.literal(120), z.literal(240), z.literal(720), z.literal(1_440),
        ]),
      }))
      .mutation(async ({ input }) => {
        if (input.enabled) {
          const [client, connection] = await Promise.all([
            getGmailOauthClientCredentials(),
            getGmailOauthConnection(),
          ]);
          if (!client || !connection) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure the Google OAuth client and connect Gmail before enabling automatic ingestion" });
          }
        }
        const settings = await setGmailIngestionSettings(input);
        await rescheduleGmailIngestion();
        broadcast("gmail-invalidate");
        return { success: true, settings };
      }),

    runGmailIngestion: protectedProcedure.mutation(async () => {
      return await runWorkspaceIngestion("manual");
    }),
  }),
  replyMonitor: replyMonitorRouter,
  // ─── Email Inbox ──────────────────────────────────────────────────────────────
  emailInbox: router({
    /** Get all email tasks (includes archived). */
    getAll: protectedProcedure.query(async () => {
      return await getAllEmailTasks();
    }),
    /** Get pending (non-archived) email tasks. */
    getPending: protectedProcedure.query(async () => {
      return await getPendingEmailTasks();
    }),
    /** Count of pending (non-archived) email tasks. */
    getPendingCount: protectedProcedure.query(async () => {
      const count = await getPendingEmailCount();
      return { count };
    }),
    /** Update email task status. */
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        status: z.enum(["pending", "processed", "archived"]),
        trelloCardId: z.string().optional(),
        trelloCardName: z.string().optional(),
        trelloCardUrl: z.string().optional(),
        suggestedNextAction: z.string().optional(),
        llmSummary: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, status, ...extra } = input;
        await updateEmailTaskStatus(id, status, extra);
        broadcast("gmail-invalidate");
        return { success: true };
      }),
    /** Archive all non-archived email tasks (inbox zero). */
    archiveAll: protectedProcedure.mutation(async () => {
      const count = await archiveAllEmailTasks();
      broadcast("gmail-invalidate");
      return { success: true, archived: count };
    }),
    /** Compatibility import for owner agents; the internal scheduler is the primary path. */
    upsertBatch: protectedProcedure
      .input(z.array(z.object({
        gmailMessageId: z.string(),
        gmailThreadId: z.string(),
        subject: z.string().default("(no subject)"),
        fromAddress: z.string().default(""),
        fromName: z.string().default(""),
        snippet: z.string().optional(),
        receivedAt: z.date(),
        category: z.enum(["financial", "non_financial"]).default("non_financial"),
        status: z.enum(["pending", "processed", "archived"]).default("pending"),
        deadlineAt: z.date().optional(),
        trelloCardId: z.string().optional(),
        trelloCardName: z.string().optional(),
        trelloCardUrl: z.string().optional(),
        suggestedNextAction: z.string().optional(),
        llmSummary: z.string().optional(),
      })))
      .mutation(async ({ input }) => {
        const upserted = await runTrackedJob({
          jobKey: "gmail_ingestion",
          trigger: "manual",
          run: async () => {
            let count = 0;
            for (const task of input) {
              await upsertEmailTask(task as any);
              count++;
            }
            return count;
          },
          summarize: (count) => ({
            recordsProcessed: count,
            detail: `${count} email tasks imported by the owner agent`,
          }),
        });
        broadcast("gmail-invalidate");
        return { success: true, upserted };
      }),
  }),
  // ─── Card Snoozes ─────────────────────────────────────────────────────────────
  cardSnooze: router({
    /** Snooze a card until a given date. */
    snooze: protectedProcedure
      .input(z.object({
        cardId: z.string(),
        cardName: z.string(),
        cardUrl: z.string(),
        boardName: z.string().default(""),
        listName: z.string().default(""),
        snoozedUntil: z.date(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await snoozeCard(input as any);
        return { success: true };
      }),
    /** Cancel (wake up) an active snooze for a card. */
    cancel: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .mutation(async ({ input }) => {
        await cancelCardSnooze(input.cardId);
        return { success: true };
      }),
    /** Get all active snooze records. */
    getActive: protectedProcedure.query(async () => {
      return await getActiveSnoozes();
    }),
    /** Get the active snooze for a specific card. */
    getForCard: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        return await getCardSnooze(input.cardId);
      }),
    /** Get set of snoozed card IDs (for filtering in ActionAlerts). */
    getSnoozedIds: protectedProcedure.query(async () => {
      const ids = await getActiveSnoozedCardIds();
      return { cardIds: Array.from(ids) };
    }),
    /** Resurface expired snoozes (called by cron). */
    resurfaceExpired: protectedProcedure.mutation(async () => {
      const count = await resurfaceExpiredSnoozes();
      return { success: true, resurfaced: count };
    }),
  }),
  // ─── APTLSS Plans ─────────────────────────────────────────────────────────────
  aptlss: router({
    /**
     * Generate (or return cached) APTLSS plan for a Trello card.
     * Enhanced v2: writes checklist to Trello, runs state machine + priority scoring,
     * persists steps with full metadata, confidence scoring, NBA, time estimates.
     */
    generate: protectedProcedure
      .input(z.object({
        cardId: z.string().min(1),
        cardName: z.string().default(""),
        cardUrl: z.string().default(""),
        boardName: z.string().default(""),
        listName: z.string().default(""),
        forceRefresh: z.boolean().default(false),
        syncChecklist: z.boolean().default(false),
      }))
      .mutation(({ input }) => generateAptlssPlanForCard(input)),

    /** Get cached APTLSS plan for a card (null if none). */
    getCached: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        const cached = await getAptlssPlan(input.cardId);
        if (!cached) return null;
        const [steps, progress, state, priority, assessment] = await Promise.all([
          getOpenStepsForCard(input.cardId),
          getCardStepProgress(input.cardId),
          getCardState(input.cardId),
          getPriorityScore(input.cardId),
          getLatestAssessment(input.cardId),
        ]);
        return {
          plan: JSON.parse(cached.planJson),
          generatedAt: cached.generatedAt,
          cardName: cached.cardName,
          boardName: cached.boardName,
          listName: cached.listName,
          steps,
          progress,
          cardState: state?.state ?? null,
          cardStateReason: state?.stateReason ?? null,
          priorityScore: priority?.score ?? null,
          priorityTier: priority?.tier ?? null,
          assessment,
        };
      }),

    /** Latest evidence-calibrated assessment for a card. */
    getAssessment: protectedProcedure
      .input(z.object({ cardId: z.string().min(1) }))
      .query(({ input }) => getLatestAssessment(input.cardId)),

    /** Material assessment changes for audit and calibration review. */
    getAssessmentHistory: protectedProcedure
      .input(z.object({ cardId: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }))
      .query(({ input }) => getAssessmentHistory(input.cardId, input.limit ?? 20)),

    /** Active VA-supplied waiting evidence for one card. */
    getWaitingReason: protectedProcedure
      .input(z.object({ cardId: z.string().min(1) }))
      .query(({ input }) => getActiveWaitingReason(input.cardId)),

    /** All active waiting reasons, loaded once for the Work Intake queue. */
    getActiveWaitingReasons: protectedProcedure.query(() => getActiveWaitingReasons()),

    /** Version history preserves every superseded or resolved waiting explanation. */
    getWaitingReasonHistory: protectedProcedure
      .input(z.object({ cardId: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }))
      .query(({ input }) => getWaitingReasonHistory(input.cardId, input.limit ?? 20)),

    /** Interpret and persist exact free-form waiting evidence. No Trello write occurs. */
    recordWaitingReason: protectedProcedure
      .input(z.object({
        cardId: z.string().min(1).max(64),
        cardName: z.string().max(512).default(""),
        cardUrl: z.string().max(1_024).default(""),
        boardName: z.string().max(256).default(""),
        listName: z.string().max(256).default(""),
        due: z.string().nullable().optional(),
        reason: z.string().trim().min(8, "Describe who or what is blocking the card and what is missing.").max(4_000),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const interpretation = await interpretWaitingReasonFreeform(input.reason, {
            cardId: input.cardId,
            cardName: input.cardName,
            boardName: input.boardName,
            listName: input.listName,
            due: input.due,
          });
          const record = await recordAptlssWaitingReason({
            cardId: input.cardId,
            cardName: input.cardName,
            cardUrl: input.cardUrl,
            boardName: input.boardName,
            listName: input.listName,
            interpretation,
            recordedBy: ctx.user.openId,
          });
          let assessment = null;
          try {
            assessment = await reassessCardById(input.cardId, "manual");
          } catch (error) {
            console.warn(`[APTLSS] Waiting reason saved; immediate reassessment deferred for ${input.cardId}:`, error instanceof Error ? error.message : String(error));
          }
          broadcast("aptlss-invalidate");
          return { record, interpretation, assessment, trelloSideEffect: false as const };
        } catch (error) {
          if (error instanceof WaitingReasonError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),

    /** Resolve internal waiting evidence when the blocker is gone. No Trello write occurs. */
    resolveWaitingReason: protectedProcedure
      .input(z.object({ cardId: z.string().min(1).max(64) }))
      .mutation(async ({ input }) => {
        try {
          const result = await resolveAptlssWaitingReason(input.cardId);
          try {
            await reassessCardById(input.cardId, "manual");
          } catch (error) {
            console.warn(`[APTLSS] Waiting reason resolved; immediate reassessment deferred for ${input.cardId}:`, error instanceof Error ? error.message : String(error));
          }
          broadcast("aptlss-invalidate");
          return { ...result, trelloSideEffect: false as const };
        } catch (error) {
          if (error instanceof WaitingReasonError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),

    /** Human validation of an immutable assessment snapshot for calibration. */
    recordAssessmentFeedback: protectedProcedure
      .input(z.object({
        assessmentId: z.number().int().positive(),
        verdict: z.enum(["accurate", "partial", "inaccurate"]),
        correctedState: z.enum(APTLSS_CARD_STATES).optional(),
        note: z.string().trim().max(2_000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await recordAssessmentFeedback({ ...input, createdBy: ctx.user.openId });
        } catch (error) {
          if (error instanceof AssessmentFeedbackError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),

    /** Aggregate measured accuracy and confidence calibration. */
    getAssessmentCalibration: protectedProcedure.query(() => {
      return getAssessmentCalibration(5_000, APTLSS_ASSESSMENT_VERSION);
    }),

    getAssessmentReviewQueue: protectedProcedure.query(() => {
      return getAssessmentReviewQueue(8, APTLSS_ASSESSMENT_VERSION);
    }),

    /** Current cross-card intelligence ordered by intervention urgency. */
    getAssessmentOverview: protectedProcedure.query(() => getLatestAssessments()),

    /** One normalized intelligence payload for Work Queue ranking and inspection. */
    getWorkQueueContext: protectedProcedure.query(async () => {
      const [plans, states, scores, assessments, steps] = await Promise.all([
        getAllAptlssPlans(),
        getAllCardStates(),
        getAllPriorityScores(),
        getLatestAssessments(),
        getAllAptlssSteps(),
      ]);
      const planMap = new Map(plans.map((plan) => [plan.cardId, plan]));
      const stateMap = new Map(states.map((state) => [state.cardId, state]));
      const scoreMap = new Map(scores.map((score) => [score.cardId, score]));
      const assessmentMap = new Map(assessments.map((assessment) => [assessment.cardId, assessment]));
      const stepsByCard = new Map<string, typeof steps>();
      for (const step of steps) {
        const list = stepsByCard.get(step.cardId) ?? [];
        list.push(step);
        stepsByCard.set(step.cardId, list);
      }
      const cardIds = new Set([
        ...plans.map((plan) => plan.cardId),
        ...states.map((state) => state.cardId),
        ...scores.map((score) => score.cardId),
        ...assessments.map((assessment) => assessment.cardId),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        cards: Array.from(cardIds).map((cardId) => {
          const plan = planMap.get(cardId);
          const state = stateMap.get(cardId);
          const score = scoreMap.get(cardId);
          const assessment = assessmentMap.get(cardId);
          let planValue: Record<string, unknown> = {};
          try { planValue = JSON.parse(plan?.planJson ?? "{}"); } catch { planValue = {}; }
          const cardSteps = stepsByCard.get(cardId) ?? [];
          const openRobertStep = cardSteps.find((step) => step.requiresRobert && step.status !== "complete") ?? null;
          const recommendations = assessment?.recommendationsValue ?? [];
          const planAction = String(planValue.nextBestAction ?? planValue.action ?? "").trim() || null;
          return {
            cardId,
            cardName: plan?.cardName ?? assessment?.cardName ?? state?.cardName ?? score?.cardName ?? cardId,
            cardUrl: plan?.cardUrl ?? `https://trello.com/c/${cardId}`,
            boardName: plan?.boardName ?? state?.boardName ?? "",
            listName: plan?.listName ?? state?.listName ?? "",
            nextBestAction: selectWorkQueueNextAction({
              planAction,
              primaryState: assessment?.primaryState ?? state?.state ?? null,
              actionability: assessment?.actionability ?? null,
              recommendations,
              openRobertStep,
            }),
            planSummary: String(planValue.summary ?? "").trim() || null,
            primaryState: assessment?.primaryState ?? state?.state ?? null,
            stateReason: assessment?.stateReason ?? state?.stateReason ?? null,
            actionability: assessment?.actionability ?? null,
            priorityScore: assessment?.priorityScore ?? score?.score ?? 0,
            priorityTier: assessment?.priorityTier ?? score?.tier ?? "MEDIUM",
            confidenceScore: assessment?.confidenceScore ?? null,
            confidenceReason: assessment?.confidenceReason ?? null,
            confidenceProfile: assessment?.intelligenceValue.confidenceProfile ?? null,
            assessedAt: assessment?.assessedAt ?? state?.calculatedAt ?? null,
            recommendations,
            uncertainties: assessment?.uncertaintiesValue ?? [],
            evidence: assessment?.evidenceValue ?? [],
            steps: cardSteps.map((step) => ({
              id: step.id,
              stepNumber: step.stepNumber,
              title: step.title,
              status: step.status,
              category: step.category,
              requiresRobert: step.requiresRobert,
              completionCriteria: step.completionCriteria,
              riskIfSkipped: step.riskIfSkipped,
            })),
          };
        }),
      };
    }),

    /** Get all stored APTLSS plans (admin/debug). */
    getAll: protectedProcedure.query(async () => {
      return await getAllAptlssPlans();
    }),

    /** Get all open steps requiring Robert decision (Decision Queue). */
    getRobertDecisionQueue: protectedProcedure.query(async () => {
      return await getAllRobertDecisionSteps();
    }),

    /** Resolve a Robert decision step (marks as complete). */
    resolveRobertStep: protectedProcedure
      .input(z.object({ stepId: z.number() }))
      .mutation(async ({ input }) => {
        await resolveRobertStep(input.stepId);
        broadcast("aptlss-invalidate");
        return { success: true };
      }),

    /** Record Robert's stated outcome and close the linked APTLSS decision step. */
    recordDecisionOutcome: protectedProcedure
      .input(z.object({
        stepId: z.number().int().positive(),
        outcome: z.string().trim().min(1).max(2_000),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await recordDecisionOutcome({
            stepId: input.stepId,
            outcome: input.outcome,
            resolvedBy: ctx.user.openId,
          });
          queueCardReassessment(result.cardId);
          broadcast("aptlss-invalidate");
          return result;
        } catch (error) {
          if (error instanceof DecisionOutcomeError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),

    /** Return the most recently recorded Robert decision outcomes. */
    getDecisionHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(async ({ input }) => {
        return getDecisionHistory(input?.limit ?? 30);
      }),

    /** Complete internal APTLSS steps for a planned block. Does not post to Trello. */
    completeSteps: protectedProcedure
      .input(z.object({ stepIds: z.array(z.number().int().positive()).max(50) }))
      .mutation(async ({ input }) => {
        const completed = await completeStepsByIds(input.stepIds);
        broadcast("aptlss-invalidate");
        return { success: true, completed };
      }),

    /** Get step progress for a card. */
    getProgress: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        return await getCardStepProgress(input.cardId);
      }),

    /** Get card state for a card. */
    getCardState: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        return await getCardState(input.cardId);
      }),

    /** Get all card states enriched with evidence-calibrated assessment confidence. */
    getAllCardStates: protectedProcedure.query(async () => {
      const [states, assessments] = await Promise.all([getAllCardStates(), getLatestAssessments()]);
      const assessmentMap = new Map(assessments.map((assessment) => [assessment.cardId, assessment]));
      return states.map((state) => {
        const assessment = assessmentMap.get(state.cardId);
        return {
          ...state,
          confidenceScore: assessment?.confidenceScore ?? null,
          confidenceReason: assessment?.confidenceReason ?? null,
          confidenceBand: assessment?.confidenceBand ?? null,
          actionability: assessment?.actionability ?? null,
          secondarySignals: assessment?.secondarySignalsValue ?? [],
          lastEvaluatedAt: assessment?.lastEvaluatedAt ?? null,
          nextAssessmentAt: assessment?.nextAssessmentAt ?? null,
          engineVersion: assessment?.engineVersion ?? null,
        };
      });
    }),

    /** Get priority score for a card. */
    getPriorityScore: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(async ({ input }) => {
        return await getPriorityScore(input.cardId);
      }),

    /** Get all priority scores ordered by score desc. */
    getAllPriorityScores: protectedProcedure.query(async () => {
      return await getAllPriorityScores();
    }),
    /** Get all steps that require Robert's decision (not yet complete). */
    getDecisionQueue: protectedProcedure.query(async () => {
      const [allPlans, allSteps, allScores] = await Promise.all([
        getAllAptlssPlans(),
        getAllRobertDecisionSteps(),
        getAllPriorityScores(),
      ]);
      const scoreMap = new Map(allScores.map(s => [s.cardId, s]));
      const planMap = new Map(allPlans.map(p => [p.cardId, p]));
      const items = allSteps
        .filter(s => s.status !== 'complete')
        .map(s => {
          const plan = planMap.get(s.cardId);
          const score = scoreMap.get(s.cardId);
          let recommendedDecision: string | null = s.recommendedDecision ?? null;
          try {
            const planData = JSON.parse(plan?.planJson ?? '{}') as Record<string, unknown>;
            const steps = (planData.steps as Array<{ text?: string; title?: string; recommendedDecision?: string }> | undefined) ?? [];
            const matchingStep = steps.find(st => (st.text ?? st.title) === s.title);
            recommendedDecision = recommendedDecision ?? matchingStep?.recommendedDecision ?? null;
          } catch { /* ignore */ }
          return {
            cardId: s.cardId,
            cardName: plan?.cardName ?? s.cardId,
            cardUrl: plan?.cardUrl ?? `https://trello.com/c/${s.cardId}`,
            boardName: plan?.boardName ?? "",
            listName: plan?.listName ?? "",
            stepId: s.id,
            stepIndex: s.stepNumber,
            stepTitle: s.title,
            tier: score?.tier ?? 'MEDIUM',
            recommendedDecision,
          };
        })
        .sort((a, b) => {
          const tierOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, BLOCKED: 4 };
          return (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2);
        });
      return { items };
    }),

    /** Owner-only manual checkItem sync. Trello webhooks use the signed /api/trello/webhook endpoint. */
    syncCheckItem: protectedProcedure
      .input(z.object({
        trelloCheckItemId: z.string(),
        state: z.enum(["complete", "incomplete"]),
      }))
      .mutation(async ({ input }) => {
        if (input.state === "complete") {
          await completeStepByCheckItemId(input.trelloCheckItemId);
        } else {
          await uncompleteStepByCheckItemId(input.trelloCheckItemId);
        }
        return { success: true };
      }),

    /** Load the persisted daily operator plan without regenerating. */
    getDailyPlan: protectedProcedure
      .input(z.object({ dateKey: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const dateKey = input?.dateKey ?? getEatDateKey();
        return {
          dateKey,
          plan: await getSavedDailyPlan(dateKey),
        };
      }),

    /** Generate and persist a versioned daily operator plan. */
    generateDailyPlan: protectedProcedure
      .input(z.object({
        dateKey: z.string().optional(),
        force: z.boolean().default(false),
        constraints: z.record(z.string(), z.unknown()).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const autopilotLvl = await getAutopilotLevel();
        if (autopilotLvl < 2) throw new Error(`Autopilot level ${autopilotLvl} is too low to generate daily plans. Set level >= 2 in Settings > Operational Policies.`);
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) throw new Error("Trello API credentials not configured");

        const dateKey = input?.dateKey ?? getEatDateKey();
        if (!input?.force) {
          const existing = await getSavedDailyPlan(dateKey);
          if (existing) return existing;
        }
        return await buildDailyPlan(dateKey, "manual");
      }),

    /** Persist cockpit edits such as block status, notes, and ordering. */
    updateDailyPlan: protectedProcedure
      .input(z.object({ dateKey: z.string(), scheduleJson: z.any() }))
      .mutation(async ({ input }) => {
        return await persistDailyPlan(input.dateKey, input.scheduleJson as DailyPlanPayload);
      }),

    /** Replan only unfinished future blocks while preserving completed/active work. */
    replanRemainingDay: protectedProcedure
      .input(z.object({
        dateKey: z.string(),
        now: z.string().optional(),
        completedBlockIds: z.array(z.string()).default([]),
        activeBlockId: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return await buildRemainingDayReplan(input.dateKey, input.completedBlockIds, input.activeBlockId ?? null);
      }),

    /** Draft an end-of-day handoff from the persisted plan and tracked timers. */
    draftDailyHandoff: protectedProcedure
      .input(z.object({ dateKey: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        return await draftDailyHandoff(input?.dateKey ?? getEatDateKey());
      }),

    /** Generate a cross-card daily schedule using all APTLSS plans + priority scores. */
    planMyDay: protectedProcedure
      .mutation(async () => {
        // Autopilot Level Enforcement (Item 17): planMyDay requires level >= 2
        const autopilotLvl = await getAutopilotLevel();
        if (autopilotLvl < 2) throw new Error(`Autopilot level ${autopilotLvl} is too low to generate daily plans. Set level ≥ 2 in Settings → Operational Policies.`);
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) throw new Error("Trello API credentials not configured");
        const payload = await buildDailyPlan(getEatDateKey(), "manual");
        return toLegacyDailySchedule(payload);
      }),

    /** Done quality gate check for a card. */
    doneGateCheck: protectedProcedure
      .input(z.object({ cardId: z.string() }))
      .query(({ input }) => getDoneGateStatus(input.cardId)),

    /** Get all cards in NEEDS_RESTRUCTURING state (vague/no-checklist/no-description). */
    getRepairQueue: protectedProcedure.query(async () => {
      return await getNeedsRepairCards();
    }),

    /** Get all cards in READY_FOR_DONE state (all checklist items complete, not yet moved to Done). */
    getReadyForDone: protectedProcedure.query(async () => {
      return await getReadyForDoneCards();
    }),

    /**
     * Get a consolidated risks-and-exceptions summary for Robert's minimum-oversight dashboard.
     * Returns:
     *   - pendingDecisions: steps requiring Robert's input (grouped by card)
     *   - stalledCards: cards in STALLED state
     *   - blockedCards: cards in BLOCKED state
     *   - waitingCards: cards in WAITING_FOR_JOYCE state
     *   - repairCards: cards in NEEDS_RESTRUCTURING state
     *   - escalations: cards whose planJson has a non-null escalationCategory
     */
    getRisksAndExceptions: protectedProcedure.query(async () => {
      const [allPlans, allSteps, allScores, allStates, allAssessments, policy] = await Promise.all([
        getAllAptlssPlans(),
        getAllRobertDecisionSteps(),
        getAllPriorityScores(),
        getAllCardStates(),
        getLatestAssessments(),
        getOperationalPolicySnapshot(),
      ]);
      const scoreMap = new Map(allScores.map(s => [s.cardId, s]));
      const planMap = new Map(allPlans.map(p => [p.cardId, p]));
      const assessmentMap = new Map(allAssessments.map(assessment => [assessment.cardId, assessment]));

      // Pending Robert decisions (open steps)
      const pendingDecisions = allSteps
        .filter(s => s.status !== 'complete')
        .map(s => {
          const plan = planMap.get(s.cardId);
          const score = scoreMap.get(s.cardId);
          let recommendedDecision: string | null = s.recommendedDecision ?? null;
          try {
            const planData = JSON.parse(plan?.planJson ?? '{}') as Record<string, unknown>;
            const steps = (planData.steps as Array<{ text?: string; title?: string; recommendedDecision?: string }> | undefined) ?? [];
            const matchingStep = steps.find(st => (st.text ?? st.title) === s.title);
            recommendedDecision = recommendedDecision ?? matchingStep?.recommendedDecision ?? null;
          } catch { /* ignore */ }
          return {
            cardId: s.cardId,
            cardName: plan?.cardName ?? s.cardId,
            cardUrl: plan?.cardUrl ?? `https://trello.com/c/${s.cardId}`,
            boardName: plan?.boardName ?? null,
            stepTitle: s.title,
            tier: score?.tier ?? 'MEDIUM',
            recommendedDecision,
          };
        })
        .sort((a, b) => {
          const tierOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, BLOCKED: 4 };
          return (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2);
        });

      // Helper: build Trello card URL from cardId (card_states has no cardUrl column)
      const cardUrl = (cardId: string) => planMap.get(cardId)?.cardUrl ?? `https://trello.com/c/${cardId}`;

      // Cards by state
      const stalledCards = allStates.filter(s => s.state === 'STALLED').map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        tier: scoreMap.get(s.cardId)?.tier ?? 'MEDIUM',
      }));
      const blockedCards = allStates.filter(s => s.state === 'BLOCKED_BY_OTHER_CARD').map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        daysSinceProgress: s.daysSinceProgress,
        tier: scoreMap.get(s.cardId)?.tier ?? 'MEDIUM',
      }));
      const waitingCards = allStates.filter(s => s.state === 'WAITING_FOR_JOYCE').map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        tier: scoreMap.get(s.cardId)?.tier ?? 'MEDIUM',
      }));
      const repairCards = allStates.filter(s => s.state === 'NEEDS_RESTRUCTURING').map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        tier: scoreMap.get(s.cardId)?.tier ?? 'MEDIUM',
      }));

      // Deadline risks: OVERDUE cards or HIGH/CRITICAL priority cards that are stalled/blocked
      const deadlineRisks = allStates.filter(s => {
        if (s.state === 'OVERDUE') return true;
        // Also include HIGH/CRITICAL priority cards that are stalled or blocked
        const tier = scoreMap.get(s.cardId)?.tier;
        if ((tier === 'CRITICAL' || tier === 'HIGH') && (s.state === 'STALLED' || s.state === 'BLOCKED_BY_OTHER_CARD')) return true;
        return false;
      }).map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        tier: scoreMap.get(s.cardId)?.tier ?? 'HIGH',
        isOverdue: s.state === 'OVERDUE',
      }));
      // Cards ready for final approval (READY_FOR_DONE with requiresRobert step)
      const readyForApproval = allStates.filter(s => s.state === 'READY_FOR_DONE').map(s => ({
        cardId: s.cardId, cardName: s.cardName, cardUrl: cardUrl(s.cardId),
        boardName: s.boardName, stateReason: s.stateReason,
        tier: scoreMap.get(s.cardId)?.tier ?? 'MEDIUM',
      }));
      // Cards progressing normally (not in any exception state)
      const exceptionCardIds = new Set([
        ...pendingDecisions.map(c => c.cardId),
        ...stalledCards.map(c => c.cardId),
        ...blockedCards.map(c => c.cardId),
        ...waitingCards.map(c => c.cardId),
        ...repairCards.map(c => c.cardId),
        ...deadlineRisks.map(c => c.cardId),
        ...readyForApproval.map(c => c.cardId),
      ]);
      const normalCount = allStates.filter(s =>
        !exceptionCardIds.has(s.cardId) &&
        s.state !== 'DONE_CONFIRMED' &&
        s.state !== 'NEEDS_ARCHIVE'
      ).length;
      const externalCount = allStates.filter(s => s.state === 'WAITING_FOR_EXTERNAL_PARTY').length;
      // Escalations from planJson.escalationCategory
      const planEscalations = allPlans
        .filter(p => {
          try {
            const plan = JSON.parse(p.planJson) as Record<string, unknown>;
            return plan.escalationCategory && plan.escalationCategory !== null;
          } catch { return false; }
        })
        .map(p => {
          let escalationCategory: string | null = null;
          let robertDecision: string | null = null;
          let confidenceScore: number | null = null;
          let confidenceReason: string | null = null;
          try {
            const plan = JSON.parse(p.planJson) as Record<string, unknown>;
            escalationCategory = (plan.escalationCategory as string) ?? null;
            robertDecision = (plan.robertDecision as string) ?? null;
            confidenceScore = assessmentMap.get(p.cardId)?.confidenceScore ?? null;
            confidenceReason = assessmentMap.get(p.cardId)?.confidenceReason ?? null;
          } catch { /* ignore */ }
          return {
            cardId: p.cardId,
            cardName: p.cardName,
            cardUrl: p.cardUrl,
            boardName: p.boardName,
            escalationCategory,
            robertDecision,
            confidenceScore,
            confidenceReason,
            tier: scoreMap.get(p.cardId)?.tier ?? 'MEDIUM',
          };
        });
      const existingEscalationIds = new Set(planEscalations.map((item) => item.cardId));
      const blockedEscalations = blockedCards
        .filter((card) => policy.blockedEscalationEnabled && card.daysSinceProgress >= policy.escalateBlockedDays && !existingEscalationIds.has(card.cardId))
        .map((card) => ({
          ...card,
          escalationCategory: "blocked_too_long",
          robertDecision: `Review blocker after ${card.daysSinceProgress} day(s) without progress.`,
          confidenceScore: assessmentMap.get(card.cardId)?.confidenceScore ?? null,
          confidenceReason: assessmentMap.get(card.cardId)?.confidenceReason ?? null,
        }));
      const blockedEscalationIds = new Set(blockedEscalations.map((item) => item.cardId));
      const overdueCards = deadlineRisks.filter((card) => card.isOverdue);
      const deadlineEscalations = policy.missedDeadlineEscalationEnabled && overdueCards.length >= policy.escalateMissedDeadlines
        ? overdueCards
          .filter((card) => !existingEscalationIds.has(card.cardId) && !blockedEscalationIds.has(card.cardId))
          .map((card) => ({
            ...card,
            escalationCategory: "repeated_missed_deadlines",
            robertDecision: `${overdueCards.length} active cards are overdue, meeting the escalation threshold of ${policy.escalateMissedDeadlines}. Set recovery order and ownership.`,
            confidenceScore: assessmentMap.get(card.cardId)?.confidenceScore ?? null,
            confidenceReason: assessmentMap.get(card.cardId)?.confidenceReason ?? null,
          }))
        : [];
      const escalations = [...planEscalations, ...blockedEscalations, ...deadlineEscalations];

      return {
        pendingDecisions,
        stalledCards,
        blockedCards,
        waitingCards,
        repairCards,
        escalations,
        deadlineRisks,
        readyForApproval,
        normalCount,
        externalCount,
        totalIssues: pendingDecisions.length + stalledCards.length + blockedCards.length + waitingCards.length + escalations.length + deadlineRisks.length + readyForApproval.length,
        policyThresholds: policy,
      };
    }),

    // ─── Operational Policies ─────────────────────────────────────────────
    getPolicies: protectedProcedure.query(async () => {
      return getAllPolicies();
    }),

    updatePolicy: protectedProcedure
      .input(z.object({ ruleKey: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await upsertPolicy(input.ruleKey, input.value);
        return { success: true };
      }),

    togglePolicy: protectedProcedure
      .input(z.object({ ruleKey: z.string(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        await setPolicyEnabled(input.ruleKey, input.enabled);
        return { success: true };
      }),

    // ─── Auto Follow-Up Drafts ────────────────────────────────────────────
    getPendingFollowUps: protectedProcedure.query(async () => {
      return getPendingFollowUpDrafts();
    }),

    getAllFollowUps: protectedProcedure.query(async () => {
      return getAllFollowUpDrafts();
    }),

    markFollowUpSent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await markFollowUpDraftSent(input.id);
        return { success: true };
      }),

    dismissFollowUp: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await dismissFollowUpDraft(input.id);
        return { success: true };
      }),
    /**
     * Post a follow-up draft as a Trello comment on the card, then mark it as sent.
     * Requires autopilot level ≥ 3 (draft external comms).
     * If autopilot < 3, the draft is only marked as sent in the DB (manual send assumed).
     */
    postFollowUpToTrello: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const draft = await getFollowUpDraftById(input.id);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Follow-up draft not found" });
        if (draft.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Draft is not pending" });

        const autopilotLevel = await getAutopilotLevel();
        if (autopilotLevel < 3) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Autopilot level 3 or higher is required to post an approved external follow-up. The draft remains pending.",
          });
        }

        const commentText = `${draft.draftMessage}\n\nReason recorded in APTLSS: ${draft.reason}`;
        await postJoyceCardComment(draft.cardId, commentText);
        await markFollowUpDraftSent(input.id);
        return { success: true, postedToTrello: true };
      }),
    // ─── Worker Performance Signals ───────────────────────────────────────
    getWorkerPerformance: protectedProcedure.query(async () => {
      return getAllWorkerPerformance();
    }),

    recordWorkerSignal: protectedProcedure
      .input(z.object({
        workerId: z.string(),
        workerName: z.string(),
        weekKey: z.string(),
        avgResponseTimeMinutes: z.number().default(0),
        checklistItemsCompleted: z.number().default(0),
        stalledCardsCount: z.number().default(0),
        missedDeadlines: z.number().default(0),
        robertEscalationsCount: z.number().default(0),
        reworkCount: z.number().default(0),
        unclearHandovers: z.number().default(0),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertWorkerPerformance({
          ...input,
          notes: input.notes ?? null,
          calculatedAt: new Date(),
        });
        return { success: true };
      }),


    // ─── Default Action Rules Engine (Item 20) ────────────────────────────────
    /**
     * Returns the active default action text for a given card state.
     * Looks up the policy with ruleKey = "default_action_<STATE>".
     * Falls back to a built-in default if no custom rule is configured.
     */
    getDefaultActionForState: protectedProcedure
      .input(z.object({ state: z.string() }))
      .query(async ({ input }) => {
        const ruleKey = `default_action_${input.state.toLowerCase()}`;
        const BUILT_IN_DEFAULTS: Record<string, string> = {
          new_untriaged: "Generate an APTLSS plan to break this card into actionable steps.",
          ready_to_start: "Pick the highest-priority open step and start working on it.",
          in_progress: "Continue the current open step. Update checklist when done.",
          waiting_for_joyce: "Answer the pending question in the card comments.",
          waiting_for_robert: "Notify Robert that a decision is needed on this card.",
          waiting_for_external_party: "Check if the follow-up deadline has passed. If yes, send a follow-up message.",
          blocked_by_other_card: "Check the blocking card. If resolved, unblock and resume.",
          stalled: "Leave a comment explaining why progress has stalled. Escalate if needed.",
          overdue: "Immediately prioritise this card. Notify Robert if it cannot be completed today.",
          ready_for_review: "Ask Robert to review and approve before moving to Done.",
          ready_for_done: "Verify all done-gate criteria are met, then move the card to Done.",
          done_confirmed: "Archive this card at the end of the week.",
          needs_restructuring: "Open the card and fix the flagged issue (add description, due date, or split into smaller cards).",
          needs_archive: "Mark the card as complete in Trello and move it to the Archive list.",
        };
        const customValue = await getPolicyValue(ruleKey, "");
        const action = customValue.trim() || BUILT_IN_DEFAULTS[input.state.toLowerCase()] || "No default action configured for this state.";
        return { state: input.state, action, isCustom: !!customValue.trim() };
      }),
    /**
     * Returns all default action rules (custom overrides only) for the settings UI.
     */
    getAllDefaultActions: protectedProcedure.query(async () => {
      const allPolicies = await getAllPolicies();
      return allPolicies.filter((p) => p.ruleKey.startsWith("default_action_"));
    }),

        // ─── Weekly Analysis ──────────────────────────────────────────────────
    getLatestWeeklyAnalysis: protectedProcedure.query(async () => {
      return getLatestWeeklyAnalysis();
    }),
    getWeeklyAnalysisHistory: protectedProcedure.query(async () => {
      return getRecentWeeklyAnalyses(8);
    }),

    // ─── Priority Command Center ──────────────────────────────────────────
    /**
     * Returns all active cards classified into 5 priority buckets:
     *   1. Critical Today — legal, financial, overdue, deadline-sensitive
     *   2. Ready to Act — can move forward without Robert
     *   3. Waiting External — someone else must reply first
     *   4. Needs Robert Decision — only items requiring yes/no
     *   5. Low-Risk Maintenance — can be postponed or auto-cleaned
     *
     * Each card includes:
     *   - whyShown: human-readable reason
     *   - nextBestAction: recommended next action
     *   - confidenceLabel: High / Medium / Low
     *   - confidenceScore: 0–100
     *   - onHoldClassification (for ON-HOLD cards): still_waiting | ready_to_resume | needs_escalation | possibly_obsolete | needs_robert
     *   - checklistProgress: { completed, total, pct }
     *   - tier: CRITICAL | HIGH | MEDIUM | LOW | BLOCKED
     */
    getCommandCenter: protectedProcedure.query(async () => {
      const [allPlans, allScores, allStates, allSteps, allAssessments, waitingRecords, policy] = await Promise.all([
        getAllAptlssPlans(),
        getAllPriorityScores(),
        getAllCardStates(),
        getAllRobertDecisionSteps(),
        getLatestAssessments(),
        getActiveWaitingReasons(),
        getOperationalPolicySnapshot(),
      ]);

      const scoreMap = new Map(allScores.map(s => [s.cardId, s]));
      const planMap = new Map(allPlans.map(p => [p.cardId, p]));
      const assessmentMap = new Map(allAssessments.map(assessment => [assessment.cardId, assessment]));
      const waitingMap = new Map(waitingRecords.map((record) => [record.cardId, toAptlssWaitingSignal(record)]));

      // Helper: parse planJson safely
      function parsePlan(cardId: string): Record<string, unknown> {
        try { return JSON.parse(planMap.get(cardId)?.planJson ?? '{}'); } catch { return {}; }
      }

      // Helper: confidence label from score
      function confidenceLabel(score: number | null | undefined): 'High' | 'Medium' | 'Low' {
        if (score == null) return 'Low';
        if (score >= policy.confidenceAutoProceedThreshold) return 'High';
        if (score >= policy.confidenceFlagThreshold) return 'Medium';
        return 'Low';
      }

      // Helper: build why-shown reason
      function buildWhyShown(state: (typeof allStates)[0] | undefined, score: (typeof allScores)[0] | undefined, plan: Record<string, unknown>, waiting?: ReturnType<typeof toAptlssWaitingSignal>): string {
        const reasons: string[] = [];
        if (state?.isOverdue) reasons.push('due date passed');
        if (state?.daysSinceProgress && state.daysSinceProgress > 7) reasons.push(`${state.daysSinceProgress} days idle`);
        if (state?.state === 'BLOCKED_BY_OTHER_CARD') reasons.push('blocked by another card');
        if (state?.state === 'STALLED') reasons.push('stalled — no recent progress');
        if (state?.state === 'WAITING_FOR_EXTERNAL_PARTY') reasons.push('waiting for external reply');
        if (state?.hasUnansweredQuestion) reasons.push('unanswered question detected');
        if (plan.escalationCategory) reasons.push(`escalation: ${plan.escalationCategory}`);
        if (score?.tier === 'CRITICAL') reasons.push('CRITICAL priority tier');
        if (score?.tier === 'HIGH') reasons.push('HIGH priority tier');
        if (waiting) reasons.push(`VA evidence: waiting on ${waiting.waitingOnName ?? waiting.waitingOn.replace(/_/g, ' ')}`);
        if (reasons.length === 0) reasons.push('active card in system');
        return 'Shown because: ' + reasons.join(' + ');
      }

      // Helper: ON-HOLD sub-classification
      function classifyOnHold(state: (typeof allStates)[0] | undefined, plan: Record<string, unknown>, waiting?: ReturnType<typeof toAptlssWaitingSignal>): string {
        if (!state) return 'still_waiting';
        if (waiting?.waitingOn === 'robert') return 'needs_robert';
        if (waiting?.waitingOn === 'external_party' || waiting?.waitingOn === 'dependency') {
          const followUpMs = waiting.followUpAt ? new Date(waiting.followUpAt).getTime() : Number.NaN;
          return Number.isFinite(followUpMs) && followUpMs <= Date.now() ? 'needs_escalation' : 'still_waiting';
        }
        const daysSince = state.daysSinceProgress ?? 0;
        const isOverdue = state.isOverdue;
        const hasEscalation = !!plan.escalationCategory;
        const needsRobert = !!plan.robertDecision;
        if (needsRobert || hasEscalation) return 'needs_robert';
        if (daysSince > 30) return 'possibly_obsolete';
        if (isOverdue || daysSince > 14) return 'needs_escalation';
        // Heuristic: if state was recently updated (< 3 days), assume new activity
        const updatedMs = state.calculatedAt ? new Date(state.calculatedAt).getTime() : 0;
        const daysSinceUpdate = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 3 && daysSince < 3) return 'ready_to_resume';
        return 'still_waiting';
      }

      // Build enriched card objects
      const enrichedCards = allStates.map(s => {
        const score = scoreMap.get(s.cardId);
        const plan = planMap.get(s.cardId);
        const planData = parsePlan(s.cardId);
        const assessment = assessmentMap.get(s.cardId);
        const waiting = waitingMap.get(s.cardId);
        const openSteps = allSteps.filter(st => st.cardId === s.cardId && st.status !== 'complete');
        const totalSteps = (score?.openSteps ?? 0) + (score?.completedSteps ?? 0);
        const completedSteps = score?.completedSteps ?? 0;
        const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        const confidenceScore = waiting
          ? Math.min(assessment?.confidenceScore ?? waiting.confidenceScore, waiting.confidenceScore + 10)
          : assessment?.confidenceScore ?? null;
        const confidenceReason = assessment?.confidenceReason ?? null;
        const nextBestAction = waiting?.nextAction ?? (planData.nextBestAction as string | null) ?? null;
        const escalationCategory = (planData.escalationCategory as string | null) ?? null;
        const robertDecision = (planData.robertDecision as string | null) ?? null;
        const urgencyLabel = (planData.urgencyLabel as string | null) ?? null;
        // Build confidence sub-score breakdown for tooltip
        const checklistClarity = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 40) : 0;
        const planClarity = confidenceScore != null ? Math.min(Math.round(confidenceScore * 0.4), 40) : 20;
        const activityScore = Math.max(0, 20 - Math.min(s.daysSinceProgress * 2, 20));
        const waitingFollowUpMs = waiting?.followUpAt ? new Date(waiting.followUpAt).getTime() : Number.NaN;
        const waitingFollowUpDue = Number.isFinite(waitingFollowUpMs) && waitingFollowUpMs <= Date.now();
        const effectiveState = waiting?.waitingOn === 'dependency' || waiting?.category === 'dependency' ? 'BLOCKED_BY_OTHER_CARD'
          : waiting?.waitingOn === 'robert' ? 'WAITING_FOR_ROBERT'
            : waiting?.waitingOn === 'external_party' ? 'WAITING_FOR_EXTERNAL_PARTY'
              : waiting ? 'WAITING_FOR_JOYCE'
                : s.state;
        const effectiveActionability = waiting?.waitingOn === 'dependency' ? 'blocked'
          : waiting?.waitingOn === 'robert' ? 'decision'
            : waiting?.waitingOn === 'external_party' ? (waitingFollowUpDue ? 'actionable' : 'waiting')
              : waiting ? (waiting.waitingOn === 'unknown' ? 'repair' : 'actionable')
                : assessment?.actionability ?? null;
        const openRobertSteps = openSteps.filter(st => st.requiresRobert).length + (waiting?.requiresRobert && !openSteps.some((step) => step.requiresRobert) ? 1 : 0);
        const scoreBreakdown = {
          planClarity,
          checklistClarity,
          activityScore,
          total: confidenceScore ?? (planClarity + checklistClarity + activityScore),
          reason: confidenceReason ?? (confidenceScore != null
            ? `Plan confidence: ${confidenceScore}%. Checklist: ${completedSteps}/${totalSteps} steps done. Days idle: ${s.daysSinceProgress}.`
            : 'No plan generated yet — confidence cannot be calculated.'),
        };
        return {
          cardId: s.cardId,
          cardName: s.cardName,
          cardUrl: plan?.cardUrl ?? `https://trello.com/c/${s.cardId}`,
          boardName: s.boardName,
          listName: s.listName,
          state: effectiveState,
          stateReason: waiting ? `VA-recorded waiting evidence: ${waiting.summary}` : s.stateReason ?? null,
          tier: score?.tier ?? 'MEDIUM',
          score: score?.score ?? 0,
          isOverdue: s.isOverdue,
          daysSinceProgress: s.daysSinceProgress,
          hasUnansweredQuestion: s.hasUnansweredQuestion,
          checklistProgress: { completed: completedSteps, total: totalSteps, pct },
          nextBestAction,
          confidenceScore,
          confidenceLabel: confidenceLabel(confidenceScore),
          confidenceReason,
          scoreBreakdown,
          escalationCategory,
          robertDecision,
          urgencyLabel,
          actionability: effectiveActionability,
          secondarySignals: Array.from(new Set([...(assessment?.secondarySignalsValue ?? []), ...(waiting?.signals ?? [])])),
          uncertainties: Array.from(new Set([...(assessment?.uncertaintiesValue ?? []), ...(waiting?.missingInformation.map((item) => `Waiting reason: ${item}`) ?? [])])),
          recommendations: Array.from(new Set([...(waiting ? [waiting.nextAction] : []), ...(assessment?.recommendationsValue ?? [])])),
          waiting,
          assessmentVersion: assessment?.engineVersion ?? null,
          lastEvaluatedAt: assessment?.lastEvaluatedAt ?? null,
          nextAssessmentAt: assessment?.nextAssessmentAt ?? null,
          openRobertSteps,
          whyShown: buildWhyShown({ ...s, state: effectiveState }, score, planData, waiting),
          onHoldClassification: s.listName && s.listName.toLowerCase().includes('hold')
            ? classifyOnHold({ ...s, state: effectiveState }, planData, waiting)
            : null,
        };
      });

      // ── Bucket 1: Critical Today ──────────────────────────────────────────
      const criticalToday = enrichedCards.filter(c =>
        c.actionability !== 'waiting' && c.actionability !== 'blocked' && (
          c.tier === 'CRITICAL' ||
          c.isOverdue ||
          c.escalationCategory === 'legal_approval' ||
          c.escalationCategory === 'money_decision' ||
          (c.tier === 'HIGH' && c.daysSinceProgress > 5)
        )
      ).sort((a, b) => b.score - a.score);

      // ── Bucket 2: Ready to Act ────────────────────────────────────────────
      const readyToAct = enrichedCards.filter(c =>
        !criticalToday.find(x => x.cardId === c.cardId) &&
        (c.state === 'READY_TO_START' || c.state === 'IN_PROGRESS' || c.state === 'READY_FOR_REVIEW') &&
        c.openRobertSteps === 0 &&
        !c.isOverdue
      ).sort((a, b) => b.score - a.score);

      // ── Bucket 3: Waiting External ────────────────────────────────────────
      const waitingExternal = enrichedCards.filter(c =>
        !criticalToday.find(x => x.cardId === c.cardId) &&
        !readyToAct.find(x => x.cardId === c.cardId) &&
        (c.state === 'WAITING_FOR_EXTERNAL_PARTY' || c.state === 'BLOCKED_BY_OTHER_CARD')
      ).sort((a, b) => b.score - a.score);

      // ── Bucket 4: Needs Robert Decision ──────────────────────────────────
      const needsRobertDecision = enrichedCards.filter(c =>
        !criticalToday.find(x => x.cardId === c.cardId) &&
        !readyToAct.find(x => x.cardId === c.cardId) &&
        !waitingExternal.find(x => x.cardId === c.cardId) &&
        (c.openRobertSteps > 0 || c.state === 'WAITING_FOR_ROBERT' || !!c.robertDecision)
      ).sort((a, b) => b.score - a.score);

      // ── Bucket 5: Low-Risk Maintenance ────────────────────────────────────
      const lowRiskMaintenance = enrichedCards.filter(c =>
        !criticalToday.find(x => x.cardId === c.cardId) &&
        !readyToAct.find(x => x.cardId === c.cardId) &&
        !waitingExternal.find(x => x.cardId === c.cardId) &&
        !needsRobertDecision.find(x => x.cardId === c.cardId) &&
        c.state !== 'DONE_CONFIRMED' &&
        c.state !== 'NEEDS_ARCHIVE'
      ).sort((a, b) => a.score - b.score); // lowest priority first

      // ── ON-HOLD cards with sub-classification ────────────────────────────
      const onHoldCards = enrichedCards.filter(c =>
        c.listName && c.listName.toLowerCase().includes('hold')
      ).map(c => ({
        ...c,
        onHoldClassification: c.onHoldClassification ?? 'still_waiting',
      }));

      // ── Summary counts ────────────────────────────────────────────────────
      const summary = {
        criticalCount: criticalToday.length,
        needsDecisionCount: enrichedCards.filter((card) => card.openRobertSteps > 0 || card.state === 'WAITING_FOR_ROBERT' || Boolean(card.robertDecision)).length,
        autoHandledCount: policy.confidenceAutoProceedEnabled
          ? readyToAct.filter(c => (c.confidenceScore ?? 0) >= policy.confidenceAutoProceedThreshold).length
          : 0,
        waitingExternalCount: enrichedCards.filter((card) => card.state === 'WAITING_FOR_EXTERNAL_PARTY' || card.state === 'BLOCKED_BY_OTHER_CARD').length,
        totalActive: enrichedCards.filter(c => c.state !== 'DONE_CONFIRMED' && c.state !== 'NEEDS_ARCHIVE').length,
      };

      return {
        criticalToday,
        readyToAct,
        waitingExternal,
        needsRobertDecision,
        lowRiskMaintenance,
        onHoldCards,
        summary,
      };
    }),

    // ─── Batch Actions ────────────────────────────────────────────────────
    /**
     * Keep all low-risk ON-HOLD cards on hold (logs audit entry per card).
     */
    batchKeepOnHold: protectedProcedure
      .input(z.object({ cardIds: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        const allPlansKOH = await getAllAptlssPlans();
        const planMapKOH = new Map(allPlansKOH.map(p => [p.cardId, p]));
        let count = 0;
        for (const cardId of input.cardIds) {
          const plan = planMapKOH.get(cardId);
          await logAuditAction({
            cardId,
            cardName: plan?.cardName ?? cardId,
            action: 'kept_on_hold',
            description: 'Batch action: kept on hold (low-risk, no escalation needed)',
            source: 'manual',
          });
          count++;
        }
        return { success: true, count };
      }),
    /**
     * Move all ready-to-resume ON-HOLD cards to DOING (posts Trello comment + logs audit).
     */
    batchMoveToDoing: protectedProcedure
      .input(z.object({ cardIds: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Trello credentials not configured" });
        }
        const allPlans = await getAllAptlssPlans();
        const planMap = new Map(allPlans.map((plan) => [plan.cardId, plan]));
        const results: Array<{ cardId: string; success: boolean; moved?: boolean; targetListName?: string; error?: string }> = [];
        for (const cardId of input.cardIds) {
          const plan = planMap.get(cardId);
          try {
            const moved = await moveCardToDoing(cardId, apiKey, apiToken);
            if (moved.moved) {
              queueCardReassessment(cardId, "manual");
              broadcast("trello-invalidate");
              await postSystemCardComment(cardId, "Card moved to DOING after an explicit operator action.");
            }
            await logAuditAction({
              cardId,
              cardName: plan?.cardName ?? cardId,
              action: 'moved_to_doing',
              description: moved.moved
                ? `Moved to ${moved.targetListName} after explicit approval.`
                : `No move needed; card was already in ${moved.targetListName}.`,
              payload: JSON.stringify(moved),
              source: 'manual',
              requiresApproval: true,
              approved: true,
            });
            results.push({ cardId, success: true, moved: moved.moved, targetListName: moved.targetListName });
          } catch (error) {
            results.push({ cardId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        const count = results.filter((result) => result.success).length;
        return { success: count === results.length, count, failed: results.length - count, results };
      }),
    /**
     * Draft daily updates for all DOING cards and return them for approval.
     * High-confidence drafts (>= 80) can be posted only after an explicit
     * autoPost request and when autopilot level >= 4 permits approved sends.
     */
    batchDraftDailyUpdates: protectedProcedure
      .input(z.object({ cardIds: z.array(z.string()), autoPost: z.boolean().default(false) }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        const autopilotLevel = await getAutopilotLevel();
        const [allPlans, allStates, allAssessments, policy] = await Promise.all([
          getAllAptlssPlans(),
          getAllCardStates(),
          getLatestAssessments(),
          getOperationalPolicySnapshot(),
        ]);
        const planMap2 = new Map(allPlans.map(p => [p.cardId, p]));
        const stateMap2 = new Map(allStates.map(s => [s.cardId, s]));
        const assessmentMap2 = new Map(allAssessments.map(assessment => [assessment.cardId, assessment]));

        const drafts: Array<{
          cardId: string; cardName: string; cardUrl: string;
          draft: string; confidenceScore: number; autoPosted: boolean;
        }> = [];

        for (const cardId of input.cardIds) {
          const plan = planMap2.get(cardId);
          const state = stateMap2.get(cardId);
          if (!plan) continue;

          let planData: Record<string, unknown> = {};
          try { planData = JSON.parse(plan.planJson); } catch { /* ignore */ }

          const nextBestAction = (planData.nextBestAction as string) ?? 'Continue working on current tasks';
          const summary = (planData.summary as string) ?? '';
          const nextCheckpoint = (planData.nextCheckpoint as string) ?? 'Tomorrow';
          const isBlocked = (planData.isBlocked as boolean) ?? false;
          const blockedReason = (planData.blockedReason as string) ?? '';
          const confidenceScore = assessmentMap2.get(cardId)?.confidenceScore ?? 0;
          const steps = (planData.steps as Array<{ description?: string; status?: string }> | undefined) ?? [];
          const completedSteps = steps.filter(s => s.status === 'complete').map(s => s.description ?? '').filter(Boolean);
          const openStepsArr = steps.filter(s => s.status !== 'complete').map(s => s.description ?? '').filter(Boolean);
          const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

          // Use LLM to generate a natural-language daily update draft
          let draft: string;
          try {
            const llmRes = await invokeLLM({
              messages: [
                {
                  role: 'system' as const,
                  content: `You are Joyce, a professional virtual assistant. Write a concise, professional daily Trello update comment for a task card.\nFormat:\n**Daily update — ${todayStr}**\nWork completed today: <what was done>\nCurrent status: <brief status>\nNext step: <single most important next action>\nBlocker: <None or describe blocker>\nExpected next update: <when>\n\nBe specific, use the context provided. Keep it under 120 words. Return only the formatted comment text, no JSON.`,
                },
                {
                  role: 'user' as const,
                  content: `Card: ${plan.cardName}\nSummary: ${summary || 'No summary available'}\nCurrent state: ${state?.stateReason ?? state?.state ?? 'In progress'}\nNext best action: ${nextBestAction}\nCompleted steps today: ${completedSteps.slice(0, 5).join('; ') || 'None recorded'}\nOpen steps remaining: ${openStepsArr.slice(0, 5).join('; ') || 'None'}\nBlocker: ${isBlocked ? blockedReason : 'None'}\nNext checkpoint: ${nextCheckpoint}`,
                },
              ],
            });
            const llmContent = llmRes?.choices?.[0]?.message?.content;
            draft = typeof llmContent === 'string' && llmContent.trim()
              ? llmContent.trim()
              : [
                  `**Daily update — ${todayStr}**`,
                  `Work completed today: ${summary || 'Progressing on assigned tasks'}`,
                  `Current status: ${state?.stateReason ?? state?.state ?? 'In progress'}`,
                  `Next step: ${nextBestAction}`,
                  `Blocker: ${isBlocked ? blockedReason : 'None'}`,
                  `Expected next update: ${nextCheckpoint}`,
                ].join('\n');
          } catch {
            // Fallback to template if LLM fails
            draft = [
              `**Daily update — ${todayStr}**`,
              `Work completed today: ${summary || 'Progressing on assigned tasks'}`,
              `Current status: ${state?.stateReason ?? state?.state ?? 'In progress'}`,
              `Next step: ${nextBestAction}`,
              `Blocker: ${isBlocked ? blockedReason : 'None'}`,
              `Expected next update: ${nextCheckpoint}`,
            ].join('\n');
          }

          let autoPosted = false;
          if (input.autoPost && autopilotLevel >= 4 && policy.confidenceAutoProceedEnabled && confidenceScore >= policy.confidenceAutoProceedThreshold && apiKey && apiToken) {
            await postJoyceCardComment(cardId, draft);
            await logAuditAction({
              cardId,
              cardName: plan.cardName,
              action: 'daily_update_drafted',
              description: `Posted approved daily update (confidence >= ${policy.confidenceAutoProceedThreshold}, autoPost=true, autopilot >= 4)`,
              confidenceScore,
              source: 'manual',
            });
            autoPosted = true;
          } else {
            await logAuditAction({
              cardId,
              cardName: plan.cardName,
              action: 'daily_update_drafted',
              description: 'Daily update draft generated (awaiting approval)',
              confidenceScore,
              requiresApproval: true,
              source: 'manual',
            });
          }

          drafts.push({
            cardId,
            cardName: plan.cardName,
            cardUrl: plan.cardUrl,
            draft,
            confidenceScore,
            autoPosted,
          });
        }

        return { drafts };
      }),
    /**
     * Post a single approved daily update draft to Trello.
     */
    postDailyUpdateDraft: protectedProcedure
      .input(z.object({ cardId: z.string(), cardName: z.string(), draft: z.string() }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Trello credentials not configured' });
        await postJoyceCardComment(input.cardId, input.draft);
        await logAuditAction({
          cardId: input.cardId,
          cardName: input.cardName,
          action: 'comment_posted',
          description: 'Daily update posted to Trello after manual approval',
          source: 'manual',
          approved: true,
        });
        return { success: true };
      }),
    /**
     * Batch follow-up: post follow-up comment on all stale external-waiting cards.
     */
    batchFollowUp: protectedProcedure
      .input(z.object({ cardIds: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.TrelloAPIKey;
        const apiToken = process.env.TrelloAPIToken;
        if (!apiKey || !apiToken) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Trello credentials are required before follow-up comments can be posted.",
          });
        }
        const allPlans = await getAllAptlssPlans();
        const planMap3 = new Map(allPlans.map(p => [p.cardId, p]));
        const results: Array<{ cardId: string; success: boolean; error?: string }> = [];
        for (const cardId of input.cardIds) {
          const plan = planMap3.get(cardId);
          const comment = '[APTLSS Auto Follow-Up] This card has been waiting for an external reply. Please follow up with the relevant party.';
          try {
            await postJoyceCardComment(cardId, comment);
            await logAuditAction({
              cardId,
              cardName: plan?.cardName ?? cardId,
              action: 'comment_posted',
              description: 'Batch follow-up comment posted on stale external-waiting card',
              source: 'manual',
              requiresApproval: true,
              approved: true,
            });
            results.push({ cardId, success: true });
          } catch (error) {
            results.push({ cardId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        const count = results.filter((result) => result.success).length;
        return { success: count === results.length, count, failed: results.length - count, results };
      }),
    /**
     * Snooze all low-priority cards for N days.
     */
    batchSnooze: protectedProcedure
      .input(z.object({ cardIds: z.array(z.string()), days: z.number().min(1).max(30).default(7) }))
      .mutation(async ({ input }) => {
        const allPlans = await getAllAptlssPlans();
        const planMap4 = new Map(allPlans.map(p => [p.cardId, p]));
        const snoozedUntil = new Date(Date.now() + input.days * 86_400_000);
        const results: Array<{ cardId: string; success: boolean; error?: string }> = [];
        for (const cardId of input.cardIds) {
          const plan = planMap4.get(cardId);
          try {
            await snoozeCard({
              cardId,
              cardName: plan?.cardName ?? cardId,
              cardUrl: plan?.cardUrl ?? `https://trello.com/c/${cardId}`,
              boardName: plan?.boardName ?? "",
              listName: plan?.listName ?? "",
              snoozedUntil,
              note: `Batch snooze approved for ${input.days} day(s).`,
            } as any);
            await logAuditAction({
              cardId,
              cardName: plan?.cardName ?? cardId,
              action: 'snooze_applied',
              description: `Card hidden from intake until ${snoozedUntil.toISOString()}.`,
              payload: JSON.stringify({ days: input.days, snoozedUntil: snoozedUntil.toISOString() }),
              source: 'manual',
              requiresApproval: true,
              approved: true,
            });
            results.push({ cardId, success: true });
          } catch (error) {
            results.push({ cardId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        const count = results.filter((result) => result.success).length;
        return { success: count === results.length, count, failed: results.length - count, snoozedUntil, results };
      }),

    // ─── Automation History ───────────────────────────────────────────────
    /** Get the audit log for a specific card (most recent first). */
    getCardAuditLog: protectedProcedure
      .input(z.object({ cardId: z.string(), limit: z.number().min(1).max(100).default(20) }))
      .query(async ({ input }) => {
        return getCardAuditLog(input.cardId, input.limit);
      }),
    /** Get the most recent audit log entries across all cards. */
    getRecentAuditLog: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(100) }))
      .query(async ({ input }) => {
        return getRecentAuditLog(input.limit);
      }),

    runMaintenanceNow: protectedProcedure.mutation(async () => {
      return runAptlssMaintenance("manual");
    }),

    // ─── Admin Monitoring ─────────────────────────────────────────────────
    /**
     * Admin-only monitoring data: sync health, API errors, webhook status,
     * automation actions taken, cards skipped, pending approvals, logs.
     * Only accessible to the owner (noodzakelijkonline@gmail.com).
     */
    getAdminMonitor: protectedProcedure.query(async () => {
      const apiKey = process.env.TrelloAPIKey;
      const apiToken = process.env.TrelloAPIToken;

      // Sync stats
      const [syncStats, lastSync, recentSyncs, recentAudit, assessments, states, calibration, assessmentReviewQueue, plans, latestJobRuns, recentJobRuns] = await Promise.all([
        getSyncStats24h(),
        getLastSuccessfulSync(),
        getRecentSyncLog(20),
        getRecentAuditLog(50),
        getLatestAssessments(),
        getAllCardStates(),
        getAssessmentCalibration(5_000, APTLSS_ASSESSMENT_VERSION),
        getAssessmentReviewQueue(8, APTLSS_ASSESSMENT_VERSION),
        getAllAptlssPlans(),
        getLatestJobRuns(),
        getRecentJobRuns(30),
      ]);
      const now = Date.now();
      const assessmentHealth = {
        engineVersion: APTLSS_ASSESSMENT_VERSION,
        nearCertaintyTarget: APTLSS_NEAR_CERTAINTY_TARGET,
        assessedCards: assessments.length,
        unassessedCards: Math.max(0, states.length - assessments.length),
        freshCards: assessments.filter((assessment) => assessment.nextAssessmentAt.getTime() > now).length,
        dueForAssessment: assessments.filter((assessment) => assessment.nextAssessmentAt.getTime() <= now).length,
        lowConfidenceCards: assessments.filter((assessment) => assessment.confidenceScore < 60).length,
        nearCertaintyCards: assessments.filter((assessment) => assessment.confidenceScore >= APTLSS_NEAR_CERTAINTY_TARGET).length,
        averageConfidence: assessments.length
          ? Math.round(assessments.reduce((sum, assessment) => sum + assessment.confidenceScore, 0) / assessments.length)
          : 0,
        outdatedEngineCards: assessments.filter((assessment) => assessment.engineVersion !== APTLSS_ASSESSMENT_VERSION).length,
        dependencyCycleCards: assessments.filter((assessment) => assessment.intelligenceValue.portfolio?.isInDependencyCycle).length,
        portfolioBottlenecks: assessments.filter((assessment) => (assessment.intelligenceValue.portfolio?.bottleneckScore ?? 0) >= 40).length,
        activeTimerCards: assessments.filter((assessment) => assessment.intelligenceValue.runtime?.activeTimer).length,
        forecastCalibratedCards: assessments.filter((assessment) => (assessment.intelligenceValue.forecast?.calibrationSampleSize ?? 0) > 0).length,
        forecastCalibrationSamples: Math.max(0, ...assessments.map((assessment) => assessment.intelligenceValue.forecast?.calibrationSampleSize ?? 0)),
        forecastSamplesRemaining: Math.max(0, 2 - Math.max(0, ...assessments.map((assessment) => assessment.intelligenceValue.forecast?.calibrationSampleSize ?? 0))),
        humanReviewsRemaining: Math.max(0, 10 - calibration.sampleSize),
        planCount: plans.length,
        planCoveragePct: assessments.length ? Math.min(100, Math.round(plans.length / assessments.length * 100)) : 0,
      };

      // Webhook status
      let webhookStatus: { active: boolean; count: number; webhooks: unknown[] } = { active: false, count: 0, webhooks: [] };
      if (apiKey && apiToken) {
        try {
          const webhooks = await getRegisteredWebhooks(apiKey, apiToken);
          webhookStatus = { active: webhooks.length > 0, count: webhooks.length, webhooks };
        } catch { /* ignore */ }
      }

      // Pending approvals (audit log entries with requiresApproval=true and approved=null)
      const pendingApprovals = recentAudit.filter(e => e.requiresApproval && e.approved === null);

      // Cards skipped due to low confidence (last 24h)
      const cardsSkipped = recentAudit.filter(e => e.action === 'card_skipped_low_confidence');

      // Failed recommendations (low confidence escalations)
      const failedRecs = recentAudit.filter(e =>
        e.action === 'escalated' && (e.confidenceScore ?? 100) < 60
      );

      return {
        syncStats,
        lastSync,
        recentSyncs,
        webhookStatus,
        pendingApprovals,
        cardsSkipped,
        failedRecs,
        assessmentHealth,
        calibration,
        assessmentReviewQueue,
        latestJobRuns,
        recentJobRuns,
        recentAuditLog: recentAudit,
        ownerName: process.env.OWNER_NAME ?? 'Owner',
      };
    }),

    // ─── Escalation Rules Engine ──────────────────────────────────────────
    /**
     * Evaluate escalation rules against all active cards and return
     * a list of triggered escalations with recommended actions.
     *
     * Rules:
     *   1. Legal/financial card overdue → Show to Robert immediately
     *   2. ON-HOLD card idle for 7+ days → Ask VA to follow up
     *   3. DOING card no update today → Draft daily update
     *   4. Card inactive for 30+ days → Suggest archive/review
     *   5. External party silent for 5 working days → Suggest reminder email
     */
    getEscalationRules: protectedProcedure.query(async () => {
      const [allPlans, allScores, allStates] = await Promise.all([
        getAllAptlssPlans(),
        getAllPriorityScores(),
        getAllCardStates(),
      ]);
      const scoreMap3 = new Map(allScores.map(s => [s.cardId, s]));
      const planMap5 = new Map(allPlans.map(p => [p.cardId, p]));

      const triggered: Array<{
        cardId: string; cardName: string; cardUrl: string; boardName: string;
        rule: string; ruleDescription: string; recommendedAction: string; tier: string;
        daysSinceActivity: number;
      }> = [];

      for (const state of allStates) {
        if (state.state === 'DONE_CONFIRMED' || state.state === 'NEEDS_ARCHIVE') continue;
        const score = scoreMap3.get(state.cardId);
        const plan = planMap5.get(state.cardId);
        let planData: Record<string, unknown> = {};
        try { planData = JSON.parse(plan?.planJson ?? '{}'); } catch { /* ignore */ }

        const cardUrl = plan?.cardUrl ?? `https://trello.com/c/${state.cardId}`;
        const boardName = state.boardName;
        const tier = score?.tier ?? 'MEDIUM';
        const daysSince = state.daysSinceProgress ?? 0;
        const escalationCategory = planData.escalationCategory as string | null;

        // Rule 1: Legal/financial card overdue
        if (state.isOverdue && (escalationCategory === 'legal_approval' || escalationCategory === 'money_decision')) {
          triggered.push({
            cardId: state.cardId, cardName: state.cardName, cardUrl, boardName, tier,
            rule: 'legal_financial_overdue',
            ruleDescription: 'Legal or financial card is overdue',
            recommendedAction: 'Show to Robert immediately — requires urgent decision',
            daysSinceActivity: daysSince,
          });
        }

        // Rule 2: ON-HOLD card idle for 7+ days
        if (state.listName?.toLowerCase().includes('hold') && daysSince >= 7) {
          triggered.push({
            cardId: state.cardId, cardName: state.cardName, cardUrl, boardName, tier,
            rule: 'on_hold_idle_7_days',
            ruleDescription: `ON-HOLD card idle for ${daysSince} days`,
            recommendedAction: 'Ask VA to follow up with external party',
            daysSinceActivity: daysSince,
          });
        }

        // Rule 3: DOING card with no update today (stateReason contains 'no update')
        if (state.state === 'IN_PROGRESS' && state.stateReason?.toLowerCase().includes('no update')) {
          triggered.push({
            cardId: state.cardId, cardName: state.cardName, cardUrl, boardName, tier,
            rule: 'doing_no_update_today',
            ruleDescription: 'DOING card has no update posted today',
            recommendedAction: 'Draft daily update for this card',
            daysSinceActivity: daysSince,
          });
        }

        // Rule 4: Card inactive for 30+ days
        if (daysSince >= 30) {
          triggered.push({
            cardId: state.cardId, cardName: state.cardName, cardUrl, boardName, tier,
            rule: 'inactive_30_days',
            ruleDescription: `Card inactive for ${daysSince} days`,
            recommendedAction: 'Suggest archive or review — possibly obsolete',
            daysSinceActivity: daysSince,
          });
        }

        // Rule 5: External party silent for 5+ working days
        if (state.state === 'WAITING_FOR_EXTERNAL_PARTY' && daysSince >= 5) {
          triggered.push({
            cardId: state.cardId, cardName: state.cardName, cardUrl, boardName, tier,
            rule: 'external_silent_5_days',
            ruleDescription: `External party has not replied for ${daysSince} days`,
            recommendedAction: 'Send reminder email or follow-up message',
            daysSinceActivity: daysSince,
          });
        }
      }

      // Sort by severity: overdue legal first, then by days idle descending
      triggered.sort((a, b) => {
        const ruleOrder: Record<string, number> = {
          legal_financial_overdue: 0,
          doing_no_update_today: 1,
          on_hold_idle_7_days: 2,
          external_silent_5_days: 3,
          inactive_30_days: 4,
        };
        const orderDiff = (ruleOrder[a.rule] ?? 5) - (ruleOrder[b.rule] ?? 5);
        if (orderDiff !== 0) return orderDiff;
        return b.daysSinceActivity - a.daysSinceActivity;
      });

      return { triggered, totalCount: triggered.length };
    }),
  }),
});


export type AppRouter = typeof appRouter;
