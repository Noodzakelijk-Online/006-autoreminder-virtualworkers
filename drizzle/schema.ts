import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, index, varchar, decimal, date } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Payment cycles — each 2-week pay period.
 * Seeded with the first cycle: May 5 – May 22, 2026.
 */
export const paymentCycles = mysqlTable("payment_cycles", {
  id: int("id").autoincrement().primaryKey(),
  cycleStart: date("cycleStart").notNull(),       // Start date of the pay period
  cycleEnd: date("cycleEnd").notNull(),            // End date (pay date = this day)
  baseAmount: decimal("baseAmount", { precision: 8, scale: 2 }).notNull().default("90.00"),
  isPaid: boolean("isPaid").notNull().default(false),
  paidAt: timestamp("paidAt"),                     // When the owner marked it paid
  paidBy: varchar("paidBy", { length: 64 }),       // openId of who marked it paid
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentCycle = typeof paymentCycles.$inferSelect;

/**
 * Weekly merit/demerit log — one row per week, tracks the pay calculation.
 */
export const weeklyPayLog = mysqlTable("weekly_pay_log", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: date("weekStart").notNull().unique(), // One ledger row per Monday
  weekEnd: date("weekEnd").notNull(),              // Sunday of the week
  paymentCycleId: int("paymentCycleId"),           // FK to paymentCycles
  baseAmount: decimal("baseAmount", { precision: 8, scale: 2 }).notNull().default("90.00"),
  // Merits
  meritM1: decimal("meritM1", { precision: 8, scale: 2 }).notNull().default("0.00"),   // Proactive problem solving +$3
  meritM2: decimal("meritM2", { precision: 8, scale: 2 }).notNull().default("0.00"),   // Unsolicited specific feedback +$1
  meritM3: decimal("meritM3", { precision: 8, scale: 2 }).notNull().default("0.00"),   // Exceptional quality +$5
  meritStreak: decimal("meritStreak", { precision: 8, scale: 2 }).notNull().default("0.00"), // Consistency streak +$10
  // Demerits (stored as positive values, subtracted in formula)
  demeritD1: decimal("demeritD1", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD2: decimal("demeritD2", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD3: decimal("demeritD3", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD4: decimal("demeritD4", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD5: decimal("demeritD5", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD6: decimal("demeritD6", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD7: decimal("demeritD7", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD8: decimal("demeritD8", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD9: decimal("demeritD9", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD10: decimal("demeritD10", { precision: 8, scale: 2 }).notNull().default("0.00"),
  demeritD11: decimal("demeritD11", { precision: 8, scale: 2 }).notNull().default("0.00"),
  // Computed totals (stored for quick display)
  totalMerits: decimal("totalMerits", { precision: 8, scale: 2 }).notNull().default("0.00"),
  totalDemerits: decimal("totalDemerits", { precision: 8, scale: 2 }).notNull().default("0.00"),
  projectedPay: decimal("projectedPay", { precision: 8, scale: 2 }).notNull().default("90.00"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyPayLog = typeof weeklyPayLog.$inferSelect;

/**
 * Daily triage state — persists checkbox and timer state per calendar date.
 */
export const dailyTriageState = mysqlTable("daily_triage_state", {
  id: int("id").autoincrement().primaryKey(),
  triageDate: date("triageDate").notNull().unique(), // One row per day
  // Morning triage checkboxes (steps 1-5)
  step1Done: boolean("step1Done").notNull().default(false), // Email
  step2Done: boolean("step2Done").notNull().default(false), // WhatsApp
  step3Done: boolean("step3Done").notNull().default(false), // Upwork
  step4Done: boolean("step4Done").notNull().default(false), // Trello Notifications
  step5Done: boolean("step5Done").notNull().default(false), // Major Tasks planned
  // Focus mode tasks (stored as JSON array of {id, label, seconds, done})
  focusTasks: text("focusTasks"),  // nullable - null means empty
  // Evening ritual checkboxes
  eveningStep1Done: boolean("eveningStep1Done").notNull().default(false),
  eveningStep2Done: boolean("eveningStep2Done").notNull().default(false),
  eveningStep3Done: boolean("eveningStep3Done").notNull().default(false),
  eveningStep4Done: boolean("eveningStep4Done").notNull().default(false),
  // EOD report text
  eodReport: text("eodReport"),  // nullable - null means empty
  // Current view/phase
  currentView: varchar("currentView", { length: 32 }).notNull().default("overview"),  // varchar is fine for defaults
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyTriageState = typeof dailyTriageState.$inferSelect;

/**
 * Sunday checklist state — persists checkbox state per Sunday date.
 */
export const sundayChecklist = mysqlTable("sunday_checklist", {
  id: int("id").autoincrement().primaryKey(),
  sundayDate: date("sundayDate").notNull().unique(), // One row per Sunday
  // Trello maintenance
  trelloArchived: boolean("trelloArchived").notNull().default(false),
  trelloLabels: boolean("trelloLabels").notNull().default(false),
  trelloDeadlines: boolean("trelloDeadlines").notNull().default(false),
  trelloTimers: boolean("trelloTimers").notNull().default(false),
  // Communication
  emailInbox: boolean("emailInbox").notNull().default(false),
  whatsappCleared: boolean("whatsappCleared").notNull().default(false),
  upworkArchived: boolean("upworkArchived").notNull().default(false),
  // Files & system
  downloadsCleared: boolean("downloadsCleared").notNull().default(false),
  desktopCleared: boolean("desktopCleared").notNull().default(false),
  browserTabsClosed: boolean("browserTabsClosed").notNull().default(false),
  // Review
  weekReviewed: boolean("weekReviewed").notNull().default(false),
  nextWeekPlanned: boolean("nextWeekPlanned").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SundayChecklist = typeof sundayChecklist.$inferSelect;

/**
 * Tracks per-card per-day whether Joyce has assigned a due date.
 * One row per (cardId, date) pair.
 */
export const dailyDueDateAssignments = mysqlTable("daily_due_date_assignments", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  date: date("date").notNull(),                          // YYYY-MM-DD in Kenyan time
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyDueDateAssignment = typeof dailyDueDateAssignments.$inferSelect;

/**
 * Tracks per-card per-day whether Joyce has posted a daily update.
 * One row per (cardId, date) pair.
 */
export const dailyCardUpdates = mysqlTable("daily_card_updates", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  date: date("date").notNull(),                          // YYYY-MM-DD in Kenyan time
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyCardUpdate = typeof dailyCardUpdates.$inferSelect;

/**
 * Tracks per-card per-day whether Joyce has reviewed each ON-HOLD card.
 * One row per (cardId, date) pair — Joyce must tick every ON-HOLD card individually each day.
 */
export const onHoldDailyChecks = mysqlTable("on_hold_daily_checks", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  date: date("date").notNull(),                          // YYYY-MM-DD in Kenyan time
  checked: boolean("checked").notNull().default(false),
  checkedAt: timestamp("checkedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OnHoldDailyCheck = typeof onHoldDailyChecks.$inferSelect;

/**
 * Tracks daily update streak — one row per date Joyce completed all DOING card updates before 23:00 EAT.
 * Used to compute the current streak (consecutive days) for the streak badge.
 */
export const dailyUpdateStreak = mysqlTable("daily_update_streak", {
  id: int("id").autoincrement().primaryKey(),
  streakDate: date("streakDate").notNull().unique(),        // YYYY-MM-DD in Kenyan time
  completedBeforeDeadline: boolean("completedBeforeDeadline").notNull().default(false),
  completedAt: timestamp("completedAt"),                   // When all DOING cards were updated
  doingCardCount: int("doingCardCount").notNull().default(0), // How many DOING cards were tracked
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyUpdateStreak = typeof dailyUpdateStreak.$inferSelect;

/**
 * Time entries — each row is one start/stop session on a Trello card.
 * A running timer has stoppedAt = null and durationSeconds = null.
 * When stopped, both fields are populated.
 */
export const timeEntries = mysqlTable("time_entries", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  boardName: varchar("boardName", { length: 256 }).notNull().default("Unknown Board"),
  listName: varchar("listName", { length: 256 }).notNull().default("Unknown"),
  startedAt: timestamp("startedAt").notNull(),
  stoppedAt: timestamp("stoppedAt"),           // null = timer still running
  durationSeconds: int("durationSeconds"),      // null = timer still running
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("time_entries_running_idx").on(table.stoppedAt, table.startedAt),
  index("time_entries_period_idx").on(table.startedAt, table.stoppedAt),
]);

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

/**
 * App-wide settings — key/value store for configurable parameters.
 * One row per setting key. Currently used for:
 *   - dailyGoalHours: Joyce's daily hour target (default 9, range 9–10)
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

/**
 * Daily compliance snapshots — one row per work day.
 * Recorded automatically at 22:30 EAT by the server cron job.
 * Tracks how many ON-HOLD and DOING cards Joyce reviewed/updated that day.
 */
export const dailyComplianceSnapshots = mysqlTable("daily_compliance_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: date("snapshotDate").notNull().unique(),   // YYYY-MM-DD in Kenyan time
  onHoldTotal: int("onHoldTotal").notNull().default(0),
  onHoldReviewed: int("onHoldReviewed").notNull().default(0),
  onHoldMissedCards: text("onHoldMissedCards"),            // JSON array of {id,name,url}
  doingTotal: int("doingTotal").notNull().default(0),
  doingUpdated: int("doingUpdated").notNull().default(0),
  doingMissedCards: text("doingMissedCards"),              // JSON array of {id,name,url}
  messageTotal: int("messageTotal").notNull().default(0),
  messageReplied: int("messageReplied").notNull().default(0),
  messageMissed: int("messageMissed").notNull().default(0),
  messageNeedsClarification: int("messageNeedsClarification").notNull().default(0),
  emailTotal: int("emailTotal").notNull().default(0),
  emailCompleted: int("emailCompleted").notNull().default(0),
  emailMissed: int("emailMissed").notNull().default(0),
  emailNeedsClarification: int("emailNeedsClarification").notNull().default(0),
  clarificationOpen: int("clarificationOpen").notNull().default(0),
  trackedSeconds: int("trackedSeconds").notNull().default(0),
  scheduledTargetSeconds: int("scheduledTargetSeconds").notNull().default(0),
  overtimeSeconds: int("overtimeSeconds").notNull().default(0),
  timeEntryCount: int("timeEntryCount").notNull().default(0),
  d1Instances: int("d1Instances").notNull().default(0),   // number of D1 demerits added
  estimatedPenalty: decimal("estimatedPenalty", { precision: 8, scale: 2 }).notNull().default("0.00"),
  source: varchar("source", { length: 16 }).notNull().default("auto"), // 'auto' | 'manual'
  weeklyPayLogId: int("weeklyPayLogId"),                  // FK to weekly_pay_log row (if D1 was added)
  required: boolean("required").notNull().default(true),
  verificationStatus: varchar("verificationStatus", { length: 24 }).notNull().default("unverified"),
  verificationMethod: varchar("verificationMethod", { length: 64 }),
  verificationCutoffAt: timestamp("verificationCutoffAt"),
  verifiedAt: timestamp("verifiedAt"),
  evidenceCount: int("evidenceCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyComplianceSnapshot = typeof dailyComplianceSnapshots.$inferSelect;

/**
 * Immutable-source evidence used to calculate one card's daily compliance.
 * Rows are replaced only when the same date is explicitly re-fact-checked.
 */
export const complianceCardEvidence = mysqlTable("compliance_card_evidence", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: date("snapshotDate").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  category: varchar("category", { length: 16 }).notNull(),
  assignedToJoyce: boolean("assignedToJoyce").notNull().default(true),
  compliant: boolean("compliant").notNull().default(false),
  evidenceType: varchar("evidenceType", { length: 32 }).notNull().default("none"),
  evidenceActionId: varchar("evidenceActionId", { length: 64 }),
  evidenceAt: timestamp("evidenceAt"),
  evidenceJson: text("evidenceJson").notNull(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("compliance_evidence_date_card_unique").on(table.snapshotDate, table.cardId),
  index("compliance_evidence_card_date_idx").on(table.cardId, table.snapshotDate),
  index("compliance_evidence_date_compliant_idx").on(table.snapshotDate, table.compliant),
]);

export type ComplianceCardEvidence = typeof complianceCardEvidence.$inferSelect;
export type InsertComplianceCardEvidence = typeof complianceCardEvidence.$inferInsert;

/** Per-message and per-email facts included in one daily compliance snapshot. */
export const complianceCommunicationEvidence = mysqlTable("compliance_communication_evidence", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: date("snapshotDate").notNull(),
  evidenceKey: varchar("evidenceKey", { length: 256 }).notNull(),
  kind: mysqlEnum("kind", ["message_response", "email_processing"]).notNull(),
  channel: varchar("channel", { length: 64 }).notNull(),
  externalId: varchar("externalId", { length: 256 }).notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1024 }),
  occurredAt: timestamp("occurredAt").notNull(),
  dueAt: timestamp("dueAt"),
  outcome: mysqlEnum("outcome", ["verified", "missed", "needs_clarification", "excluded"]).notNull(),
  evidenceType: varchar("evidenceType", { length: 64 }).notNull(),
  evidenceAt: timestamp("evidenceAt"),
  evidenceJson: text("evidenceJson").notNull(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("compliance_comm_date_key_unique").on(table.snapshotDate, table.evidenceKey),
  index("compliance_comm_date_kind_outcome_idx").on(table.snapshotDate, table.kind, table.outcome),
  index("compliance_comm_external_idx").on(table.channel, table.externalId),
]);

export type ComplianceCommunicationEvidence = typeof complianceCommunicationEvidence.$inferSelect;
export type InsertComplianceCommunicationEvidence = typeof complianceCommunicationEvidence.$inferInsert;

/** Immediate accountability questions created when source evidence cannot prove an outcome. */
export const complianceClarificationRequests = mysqlTable("compliance_clarification_requests", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: date("snapshotDate").notNull(),
  evidenceKey: varchar("evidenceKey", { length: 256 }).notNull(),
  kind: mysqlEnum("kind", ["message_response", "email_processing"]).notNull(),
  channel: varchar("channel", { length: 64 }).notNull(),
  externalId: varchar("externalId", { length: 256 }).notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  question: text("question").notNull(),
  status: mysqlEnum("status", ["open", "resolved", "superseded"]).notNull().default("open"),
  resolution: mysqlEnum("resolution", ["completed", "not_completed", "not_required"]),
  response: text("response"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
  resolvedAt: timestamp("resolvedAt"),
  sourceJson: text("sourceJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("compliance_clarification_date_key_unique").on(table.snapshotDate, table.evidenceKey),
  index("compliance_clarification_status_requested_idx").on(table.status, table.requestedAt),
]);

export type ComplianceClarificationRequest = typeof complianceClarificationRequests.$inferSelect;

/**
 * Tracks Trello card comment threads where someone else commented last.
 * One row per card. Updated each time the cron scans comments.
 * - lastNonJoyceMsgAt: timestamp of the most recent comment NOT from Joyce
 * - lastJoyceReplyAt: timestamp of Joyce's most recent comment (null if she never replied)
 * - status: 'pending' = awaiting Joyce reply, 'replied' = Joyce replied, 'overdue' = >12h with no reply
 */
export const replyThreads = mysqlTable("reply_threads", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["trello", "upwork"]).notNull().default("trello"),
  cardId: varchar("cardId", { length: 64 }).notNull(),          // Trello card ID
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  lastNonJoyceMsgAt: timestamp("lastNonJoyceMsgAt").notNull(),  // When the other person last commented
  lastNonJoyceAuthor: varchar("lastNonJoyceAuthor", { length: 256 }).notNull().default(""),
  lastNonJoyceText: text("lastNonJoyceText"),                   // Snippet of their last comment
  lastJoyceReplyAt: timestamp("lastJoyceReplyAt"),              // null = Joyce has not replied yet
  status: mysqlEnum("status", ["pending", "replied", "overdue"]).notNull().default("pending"),
  demerited: boolean("demerited").notNull().default(false),     // true = D1 demerit already issued for this thread
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("reply_threads_source_card_unique").on(t.source, t.cardId),
  index("reply_threads_status_idx").on(t.status),
  // One row per card — upsert by cardId + source
]);
export type ReplyThread = typeof replyThreads.$inferSelect;
export type InsertReplyThread = typeof replyThreads.$inferInsert;

/**
 * Tracks vague/deferral replies from Joyce that need to be corrected.
 * A vague reply is one that defers action without substance:
 *   "I'll get back to you", "I'll update tonight", "will respond today", etc.
 * Joyce has 1 hour to correct the reply before a D1 demerit is auto-issued.
 */
export const vagueReplyFlags = mysqlTable("vague_reply_flags", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["trello", "upwork"]).notNull().default("trello"),
  cardId: varchar("cardId", { length: 64 }).notNull(),          // Trello card ID (or Upwork room ID)
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(), // Trello action ID (prevents duplicates)
  messageText: text("messageText").notNull(),                   // The vague reply text
  flaggedAt: timestamp("flaggedAt").notNull(),                  // When the vague reply was detected
  resolvedAt: timestamp("resolvedAt"),                          // When Joyce corrected it (null = unresolved)
  resolvedBy: mysqlEnum("resolvedBy", ["manual", "auto_demerit"]), // How it was resolved
  demeritIssued: boolean("demeritIssued").notNull().default(false), // true = D1 demerit issued
  demeritIssuedAt: timestamp("demeritIssuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("vague_reply_flags_resolved_idx").on(t.resolvedAt),
]);
export type VagueReplyFlag = typeof vagueReplyFlags.$inferSelect;
export type InsertVagueReplyFlag = typeof vagueReplyFlags.$inferInsert;

export const unsignedMessageFlags = mysqlTable("unsigned_message_flags", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["trello", "upwork"]).notNull().default("trello"),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  messageText: text("messageText").notNull(),
  flaggedAt: timestamp("flaggedAt").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: mysqlEnum("resolvedBy", ["manual", "auto_demerit", "system"]),
  resolutionNote: text("resolutionNote"),
  demeritIssued: boolean("demeritIssued").notNull().default(false),
  demeritIssuedAt: timestamp("demeritIssuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("unsigned_message_flags_resolved_idx").on(t.resolvedAt),
]);

export type UnsignedMessageFlag = typeof unsignedMessageFlags.$inferSelect;

export const replyMonitorStatus = mysqlTable("reply_monitor_status", {
  id: int("id").primaryKey().default(1),
  state: mysqlEnum("state", ["never", "running", "success", "error"]).notNull().default("never"),
  lastStartedAt: timestamp("lastStartedAt"),
  lastCompletedAt: timestamp("lastCompletedAt"),
  lastSuccessfulAt: timestamp("lastSuccessfulAt"),
  threadsScanned: int("threadsScanned").notNull().default(0),
  errorMessage: text("errorMessage"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReplyMonitorStatus = typeof replyMonitorStatus.$inferSelect;

/**
 * Gmail email tasks — one row per inbox email that needs processing.
 * Scanned periodically; classified by LLM into financial or non-financial.
 * Financial emails have a 48h processing deadline; non-financial are mapped to Trello cards.
 */
export const emailTasks = mysqlTable("email_tasks", {
  id: int("id").autoincrement().primaryKey(),
  gmailMessageId: varchar("gmailMessageId", { length: 128 }).notNull().unique(),
  gmailThreadId: varchar("gmailThreadId", { length: 128 }).notNull(),
  subject: varchar("subject", { length: 1024 }).notNull().default("(no subject)"),
  fromAddress: varchar("fromAddress", { length: 320 }).notNull().default(""),
  fromName: varchar("fromName", { length: 256 }).notNull().default(""),
  snippet: text("snippet"),
  receivedAt: timestamp("receivedAt").notNull(),
  category: mysqlEnum("category", ["financial", "non_financial"]).notNull().default("non_financial"),
  status: mysqlEnum("status", ["pending", "processed", "archived"]).notNull().default("pending"),
  deadlineAt: timestamp("deadlineAt"),
  trelloCardId: varchar("trelloCardId", { length: 64 }),
  trelloCardName: varchar("trelloCardName", { length: 512 }),
  trelloCardUrl: varchar("trelloCardUrl", { length: 1024 }),
  suggestedNextAction: text("suggestedNextAction"),
  llmSummary: text("llmSummary"),
  processedAt: timestamp("processedAt"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("email_tasks_status_idx").on(t.status),
]);

export type EmailTask = typeof emailTasks.$inferSelect;
export type InsertEmailTask = typeof emailTasks.$inferInsert;

/**
 * Card snoozes — temporarily hide an ON-HOLD card from Daily Actions until a resurface date.
 * One active row per cardId (isActive=true). When snoozedUntil passes, the card resurfaces.
 */
export const cardSnoozes = mysqlTable("card_snoozes", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  snoozedUntil: timestamp("snoozedUntil").notNull(),
  snoozedAt: timestamp("snoozedAt").defaultNow().notNull(),
  note: text("note"),
  isActive: boolean("isActive").notNull().default(true),
  resurfacedAt: timestamp("resurfacedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CardSnooze = typeof cardSnoozes.$inferSelect;
export type InsertCardSnooze = typeof cardSnoozes.$inferInsert;

/**
 * APTLSS plans — AI-generated step-by-step action plans for Trello cards.
 * One row per card per day (re-generated daily or on demand).
 * Stores the full JSON plan so the Power-Up popup can render it instantly.
 *
 * APTLSS = Action Plan · Plan · Timeline · Links · Steps · Summary
 */
export const aptlssPlans = mysqlTable("aptlss_plans", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull(),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull(),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  /** Full JSON plan: { action, plan, timeline, links, steps[], summary, urgencyLabel, nextCheckpoint, robertDecision } */
  planJson: text("planJson").notNull(),
  /** Context snapshot used to generate the plan (for debugging/audit) */
  contextSnapshot: text("contextSnapshot"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("aptlss_plans_card_unique").on(t.cardId),
]);
export type AptlssPlan = typeof aptlssPlans.$inferSelect;
export type InsertAptlssPlan = typeof aptlssPlans.$inferInsert;

// ─── APTLSS Steps (atomic work units synced with Trello checklist items) ──────
export const aptlssSteps = mysqlTable("aptlss_steps", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  /** ID of the APTLSS Execution Checklist in Trello (null until written) */
  trelloChecklistId: varchar("trelloChecklistId", { length: 64 }),
  /** ID of the specific checklist item in Trello (null until written) */
  trelloCheckItemId: varchar("trelloCheckItemId", { length: 64 }),
  stepNumber: int("stepNumber").notNull(),
  title: varchar("title", { length: 1024 }).notNull(),
  estimatedMinutes: int("estimatedMinutes").notNull().default(15),
  /** open | complete | obsolete | replaced */
  status: varchar("status", { length: 32 }).notNull().default("open"),
  /** internal_work | external_follow_up | robert_decision | verification | communication */
  category: varchar("category", { length: 64 }).notNull().default("internal_work"),
  requiresRobert: boolean("requiresRobert").notNull().default(false),
  /** Card ID that blocks this step (null if not blocked by another card) */
  blockedBy: varchar("blockedBy", { length: 64 }),
  /** JSON array of card IDs this step depends on */
  dependsOnCards: text("dependsOnCards"),
  completionCriteria: text("completionCriteria"),
  riskIfSkipped: text("riskIfSkipped"),
  /** Recommended decision text if requiresRobert is true */
  recommendedDecision: text("recommendedDecision"),
  /** Whether this step was manually added by Joyce (preserve on regeneration) */
  isManual: boolean("isManual").notNull().default(false),
  completedAt: timestamp("completedAt"),
  lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("aptlss_steps_card_status_idx").on(t.cardId, t.status),
  index("aptlss_steps_robert_status_idx").on(t.requiresRobert, t.status),
  index("aptlss_steps_trello_item_idx").on(t.trelloCheckItemId),
]);
export type AptlssStep = typeof aptlssSteps.$inferSelect;
export type InsertAptlssStep = typeof aptlssSteps.$inferInsert;

/** Durable record of a Robert decision before its linked APTLSS step is closed. */
export const decisionOutcomes = mysqlTable("decision_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  stepId: int("stepId").notNull().unique(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull().default(""),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  decisionPrompt: text("decisionPrompt").notNull(),
  recommendedDecision: text("recommendedDecision"),
  outcome: text("outcome").notNull(),
  resolvedBy: varchar("resolvedBy", { length: 64 }).notNull(),
  resolvedAt: timestamp("resolvedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DecisionOutcome = typeof decisionOutcomes.$inferSelect;
export type InsertDecisionOutcome = typeof decisionOutcomes.$inferInsert;

/** Immutable VA-supplied waiting evidence plus its normalized APTLSS interpretation. */
export const aptlssWaitingReasons = mysqlTable("aptlss_waiting_reasons", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  cardUrl: varchar("cardUrl", { length: 1024 }).notNull().default(""),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  rawReason: text("rawReason").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  waitingOn: varchar("waitingOn", { length: 32 }).notNull(),
  waitingOnName: varchar("waitingOnName", { length: 256 }),
  requestedItem: text("requestedItem"),
  nextAction: text("nextAction").notNull(),
  nextStepType: varchar("nextStepType", { length: 64 }).notNull(),
  followUpAt: timestamp("followUpAt"),
  followUpSource: varchar("followUpSource", { length: 32 }).notNull(),
  urgency: varchar("urgency", { length: 16 }).notNull(),
  requiresRobert: boolean("requiresRobert").notNull().default(false),
  confidenceScore: int("confidenceScore").notNull(),
  confidenceReason: text("confidenceReason").notNull(),
  interpretationJson: text("interpretationJson").notNull(),
  interpreterVersion: varchar("interpreterVersion", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  /** active | superseded | resolved */
  status: varchar("status", { length: 16 }).notNull().default("active"),
  recordedBy: varchar("recordedBy", { length: 128 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("aptlss_waiting_reasons_card_status_idx").on(table.cardId, table.status, table.createdAt),
  index("aptlss_waiting_reasons_follow_up_idx").on(table.status, table.followUpAt),
]);
export type AptlssWaitingReason = typeof aptlssWaitingReasons.$inferSelect;
export type InsertAptlssWaitingReason = typeof aptlssWaitingReasons.$inferInsert;

// ─── Card States (state machine per Trello card) ──────────────────────────────
export const cardStates = mysqlTable("card_states", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  boardName: varchar("boardName", { length: 256 }).notNull().default(""),
  listName: varchar("listName", { length: 256 }).notNull().default(""),
  /**
   * NEW_UNTRIAGED | READY_TO_START | IN_PROGRESS | WAITING_FOR_JOYCE |
   * WAITING_FOR_ROBERT | WAITING_FOR_EXTERNAL_PARTY | BLOCKED_BY_OTHER_CARD |
   * STALLED | OVERDUE | READY_FOR_REVIEW | READY_FOR_DONE | DONE_CONFIRMED |
   * NEEDS_RESTRUCTURING | NEEDS_ARCHIVE
   */
  state: varchar("state", { length: 64 }).notNull().default("NEW_UNTRIAGED"),
  /** Human-readable reason for the current state */
  stateReason: text("stateReason"),
  /** Days since last checklist progress (for stall detection) */
  daysSinceProgress: int("daysSinceProgress").notNull().default(0),
  /** Whether the card has an unanswered question from Joyce */
  hasUnansweredQuestion: boolean("hasUnansweredQuestion").notNull().default(false),
  /** Whether the card is overdue */
  isOverdue: boolean("isOverdue").notNull().default(false),
  /** Whether all checklist items are complete */
  checklistComplete: boolean("checklistComplete").notNull().default(false),
  /** Whether a final summary comment has been posted */
  hasFinalSummary: boolean("hasFinalSummary").notNull().default(false),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("card_states_card_unique").on(t.cardId),
  index("card_states_state_idx").on(t.state),
]);
export type CardState = typeof cardStates.$inferSelect;
export type InsertCardState = typeof cardStates.$inferInsert;

// ─── Priority Scores (calculated score per Trello card) ───────────────────────
export const priorityScores = mysqlTable("priority_scores", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  /** Final priority score 0–100 */
  score: int("score").notNull().default(0),
  /** JSON breakdown of score components */
  breakdown: text("breakdown"),
  /** Priority tier: CRITICAL | HIGH | MEDIUM | LOW | BLOCKED */
  tier: varchar("tier", { length: 16 }).notNull().default("MEDIUM"),
  /** Estimated remaining minutes across all open steps */
  estimatedRemainingMinutes: int("estimatedRemainingMinutes").notNull().default(0),
  /** Number of open steps */
  openSteps: int("openSteps").notNull().default(0),
  /** Number of completed steps */
  completedSteps: int("completedSteps").notNull().default(0),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  uniqueIndex("priority_scores_card_unique").on(t.cardId),
  index("priority_scores_tier_score_idx").on(t.tier, t.score),
]);
export type PriorityScore = typeof priorityScores.$inferSelect;
export type InsertPriorityScore = typeof priorityScores.$inferInsert;

/**
 * Versioned APTLSS assessment snapshots. A new row is created only when the
 * material context or derived assessment changes; unchanged evaluations update
 * lastEvaluatedAt/evaluationCount on the latest snapshot.
 */
export const aptlssAssessments = mysqlTable("aptlss_assessments", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  engineVersion: varchar("engineVersion", { length: 32 }).notNull(),
  contextHash: varchar("contextHash", { length: 64 }).notNull(),
  trigger: varchar("trigger", { length: 32 }).notNull().default("manual"),
  primaryState: varchar("primaryState", { length: 64 }).notNull(),
  stateReason: text("stateReason").notNull(),
  secondarySignals: text("secondarySignals").notNull(),
  actionability: varchar("actionability", { length: 32 }).notNull(),
  priorityScore: int("priorityScore").notNull(),
  priorityTier: varchar("priorityTier", { length: 16 }).notNull(),
  priorityBreakdown: text("priorityBreakdown").notNull(),
  confidenceScore: int("confidenceScore").notNull(),
  confidenceBand: varchar("confidenceBand", { length: 16 }).notNull(),
  confidenceReason: text("confidenceReason").notNull(),
  evidenceCoverage: text("evidenceCoverage").notNull(),
  evidenceJson: text("evidenceJson").notNull(),
  /** Portfolio, runtime, communication, schedule, and forecast context. */
  intelligenceJson: text("intelligenceJson"),
  uncertaintiesJson: text("uncertaintiesJson").notNull(),
  recommendationsJson: text("recommendationsJson").notNull(),
  lastMeaningfulProgressAt: timestamp("lastMeaningfulProgressAt"),
  daysSinceMeaningfulProgress: int("daysSinceMeaningfulProgress").notNull().default(0),
  nextAssessmentAt: timestamp("nextAssessmentAt").notNull(),
  changeJson: text("changeJson").notNull(),
  evaluationCount: int("evaluationCount").notNull().default(1),
  assessedAt: timestamp("assessedAt").notNull(),
  lastEvaluatedAt: timestamp("lastEvaluatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("aptlss_assessments_card_assessed_idx").on(table.cardId, table.assessedAt),
  index("aptlss_assessments_next_idx").on(table.nextAssessmentAt),
]);
export type AptlssAssessmentSnapshot = typeof aptlssAssessments.$inferSelect;
export type InsertAptlssAssessmentSnapshot = typeof aptlssAssessments.$inferInsert;

/** Human review of an immutable assessment snapshot, used for calibration. */
export const aptlssAssessmentFeedback = mysqlTable("aptlss_assessment_feedback", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  engineVersion: varchar("engineVersion", { length: 32 }).notNull(),
  predictedState: varchar("predictedState", { length: 64 }).notNull(),
  predictedConfidence: int("predictedConfidence").notNull(),
  verdict: mysqlEnum("verdict", ["accurate", "partial", "inaccurate"]).notNull(),
  correctedState: varchar("correctedState", { length: 64 }),
  note: text("note"),
  createdBy: varchar("createdBy", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("aptlss_assessment_feedback_assessment_idx").on(table.assessmentId),
  index("aptlss_assessment_feedback_card_created_idx").on(table.cardId, table.createdAt),
]);
export type AptlssAssessmentFeedback = typeof aptlssAssessmentFeedback.$inferSelect;
export type InsertAptlssAssessmentFeedback = typeof aptlssAssessmentFeedback.$inferInsert;

// ─── APTLSS Operational Policies ─────────────────────────────────────────────
/**
 * Configurable operational rules for the APTLSS engine.
 * Each row is a named rule with a JSON config blob.
 * Rules are evaluated by the engine during maintenance and escalation.
 */
export const aptlssOperationalPolicies = mysqlTable("aptlss_operational_policies", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique rule name, e.g. "stall_threshold_days" */
  ruleKey: varchar("ruleKey", { length: 128 }).notNull().unique(),
  /** Human-readable label */
  label: varchar("label", { length: 256 }).notNull().default(""),
  /** Description of what this rule does */
  description: text("description"),
  /** JSON value — could be a number, string, boolean, or object */
  value: text("value").notNull(),
  /** Category: stall | escalation | follow_up | done_gate | scheduling | autopilot */
  category: varchar("category", { length: 64 }).notNull().default("general"),
  /** Whether this rule is active */
  enabled: int("enabled").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AptlssOperationalPolicy = typeof aptlssOperationalPolicies.$inferSelect;
export type InsertAptlssOperationalPolicy = typeof aptlssOperationalPolicies.$inferInsert;

// ─── APTLSS Autopilot Level ───────────────────────────────────────────────────
/**
 * Stored in app_settings as key="aptlss_autopilot_level", value="0"–"5".
 * Level 0 = read-only analysis only.
 * Level 1 = create/update Trello checklists after explicit approval.
 * Level 2 = daily plans, priority assignments, blocker marking.
 * Level 3 = draft external communications (not send).
 * Level 4 = send explicitly approved routine follow-ups.
 * Level 5 = exception-gated internal automation; Trello writes remain explicit.
 * This is NOT a separate table — it uses the existing app_settings table.
 */

// ─── Worker Performance Signals ──────────────────────────────────────────────
/**
 * Tracks operational performance signals per worker (Joyce or freelancers).
 * One row per worker per week.
 */
export const workerPerformanceSignals = mysqlTable("worker_performance_signals", {
  id: int("id").autoincrement().primaryKey(),
  /** Worker identifier — "joyce" or a Trello member ID / freelancer name */
  workerId: varchar("workerId", { length: 128 }).notNull(),
  workerName: varchar("workerName", { length: 256 }).notNull().default(""),
  /** ISO week string, e.g. "2026-W21" */
  weekKey: varchar("weekKey", { length: 16 }).notNull(),
  /** Average hours between question and response (minutes) */
  avgResponseTimeMinutes: int("avgResponseTimeMinutes").notNull().default(0),
  /** Number of checklist items completed this week */
  checklistItemsCompleted: int("checklistItemsCompleted").notNull().default(0),
  /** Number of cards that became STALLED under this worker this week */
  stalledCardsCount: int("stalledCardsCount").notNull().default(0),
  /** Number of missed deadlines this week */
  missedDeadlines: int("missedDeadlines").notNull().default(0),
  /** Number of Robert escalations caused by this worker's cards this week */
  robertEscalationsCount: int("robertEscalationsCount").notNull().default(0),
  /** Number of cards requiring rework (plan regenerated more than once) */
  reworkCount: int("reworkCount").notNull().default(0),
  /** Number of unclear handovers (NEEDS_RESTRUCTURING cards) */
  unclearHandovers: int("unclearHandovers").notNull().default(0),
  /** JSON notes / observations for this week */
  notes: text("notes"),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WorkerPerformanceSignal = typeof workerPerformanceSignals.$inferSelect;
export type InsertWorkerPerformanceSignal = typeof workerPerformanceSignals.$inferInsert;

// ─── Weekly Analysis Snapshots ────────────────────────────────────────────────
/**
 * One row per week. Captures the weekly analysis output from the APTLSS engine.
 * Generated every Sunday by the scheduled weekly analysis job.
 */
export const weeklyAnalysisSnapshots = mysqlTable("weekly_analysis_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  /** ISO week string, e.g. "2026-W21" */
  weekKey: varchar("weekKey", { length: 16 }).notNull().unique(),
  /** JSON array of cards with no progress this week */
  noProgressCards: text("noProgressCards"),
  /** JSON array of recurring blocker patterns detected */
  recurringBlockers: text("recurringBlockers"),
  /** JSON array of estimate drift findings (cards where actual >> estimated) */
  estimateDrift: text("estimateDrift"),
  /** JSON array of underperforming freelancer signals */
  underperformingWorkers: text("underperformingWorkers"),
  /** JSON array of cards repeatedly moved between lists */
  listHoppers: text("listHoppers"),
  /** JSON array of projects with unclear scope */
  unclearScopeProjects: text("unclearScopeProjects"),
  /** JSON array of process improvement suggestions */
  processImprovements: text("processImprovements"),
  /** Plain-text summary of the week */
  summary: text("summary"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WeeklyAnalysisSnapshot = typeof weeklyAnalysisSnapshots.$inferSelect;
export type InsertWeeklyAnalysisSnapshot = typeof weeklyAnalysisSnapshots.$inferInsert;

// ─── Auto Follow-Up Drafts ────────────────────────────────────────────────────
/**
 * Stores auto-generated follow-up message drafts for cards in
 * WAITING_FOR_EXTERNAL_PARTY state. Joyce reviews and sends manually.
 */
export const autoFollowUpDrafts = mysqlTable("auto_follow_up_drafts", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  /** The drafted follow-up message text */
  draftMessage: text("draftMessage").notNull(),
  /** Context: why this follow-up was generated */
  reason: varchar("reason", { length: 512 }).notNull().default(""),
  /** How many hours since last external reply */
  hoursSinceLastReply: int("hoursSinceLastReply").notNull().default(0),
  /** Urgency: routine | urgent | formal_reminder | warning */
  urgencyType: varchar("urgencyType", { length: 32 }).notNull().default("routine"),
  /** Status: pending | sent | dismissed */
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("auto_follow_up_drafts_status_idx").on(t.status),
]);
export type AutoFollowUpDraft = typeof autoFollowUpDrafts.$inferSelect;
export type InsertAutoFollowUpDraft = typeof autoFollowUpDrafts.$inferInsert;

// ─── Daily Plans ──────────────────────────────────────────────────────────────
/**
 * Persists the auto-generated daily work schedule (from planMyDay logic).
 * One row per day (unique dateKey). The maintenance job generates this at
 * autopilot level >= 2. Joyce can also regenerate on demand from Plan My Day.
 */
export const dailyPlans = mysqlTable("daily_plans", {
  id: int("id").autoincrement().primaryKey(),
  /** ISO date string for the plan (e.g. "2026-05-27") */
  dateKey: varchar("dateKey", { length: 16 }).notNull().unique(),
  /** Full JSON schedule from planMyDay LLM response */
  scheduleJson: text("scheduleJson").notNull(),
  /** Human-readable daily summary */
  dailySummary: text("dailySummary"),
  /** Top priority card name */
  topPriority: varchar("topPriority", { length: 512 }),
  /** Total scheduled minutes */
  totalScheduledMinutes: int("totalScheduledMinutes").notNull().default(0),
  /** Number of cards requiring Robert's attention */
  robertItemsCount: int("robertItemsCount").notNull().default(0),
  /** Whether this was auto-generated by maintenance (true) or manually triggered (false) */
  autoGenerated: boolean("autoGenerated").notNull().default(true),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type InsertDailyPlan = typeof dailyPlans.$inferInsert;

// ─── APTLSS Audit Log ─────────────────────────────────────────────────────────
/**
 * Timestamped audit trail of every automated action the APTLSS system takes
 * on a Trello card. Provides traceability ("what did the system do and why?").
 *
 * One row per action. Kept for 90 days (pruned by maintenance job).
 */
export const aptlssAuditLog = mysqlTable("aptlss_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Trello card ID this action relates to */
  cardId: varchar("cardId", { length: 64 }).notNull(),
  /** Human-readable card name at time of action */
  cardName: varchar("cardName", { length: 512 }).notNull().default(""),
  /**
   * Action type:
   *   state_classified | priority_scored | checklist_written | plan_generated |
   *   follow_up_drafted | daily_update_drafted | escalated | robert_notified |
   *   moved_to_doing | kept_on_hold | batch_action | done_gate_blocked |
   *   duplicate_detected | maintenance_run | snooze_applied | comment_posted |
   *   card_skipped_low_confidence | llm_provider_call | llm_provider_skipped
   */
  action: varchar("action", { length: 64 }).notNull(),
  /** Human-readable description of what happened */
  description: text("description").notNull(),
  /** Optional: JSON payload (e.g. the plan, the draft text, the state value) */
  payload: text("payload"),
  /** Confidence score at time of action (0–100, null if not applicable) */
  confidenceScore: int("confidenceScore"),
  /** Whether this action required human approval */
  requiresApproval: boolean("requiresApproval").notNull().default(false),
  /** Whether human approval was granted (null = pending) */
  approved: boolean("approved"),
  /** Source: maintenance_job | webhook | manual | batch */
  source: varchar("source", { length: 32 }).notNull().default("maintenance_job"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AptlssAuditLog = typeof aptlssAuditLog.$inferSelect;
export type InsertAptlssAuditLog = typeof aptlssAuditLog.$inferInsert;

// ─── Admin Sync Log ───────────────────────────────────────────────────────────
/**
 * Tracks each Trello sync attempt (maintenance job runs, webhook deliveries).
 * Used by the admin monitoring tab to show sync health.
 */
export const adminSyncLog = mysqlTable("admin_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Type: maintenance_job | webhook | manual_refresh */
  syncType: varchar("syncType", { length: 32 }).notNull(),
  /** Whether the sync completed successfully */
  success: boolean("success").notNull(),
  /** Number of Trello cards processed */
  cardsProcessed: int("cardsProcessed").notNull().default(0),
  /** Number of automation actions taken this sync */
  actionsTaken: int("actionsTaken").notNull().default(0),
  /** Number of cards skipped due to low confidence */
  cardsSkippedLowConfidence: int("cardsSkippedLowConfidence").notNull().default(0),
  /** Error message if sync failed */
  errorMessage: text("errorMessage"),
  /** Duration in milliseconds */
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdminSyncLog = typeof adminSyncLog.$inferSelect;
export type InsertAdminSyncLog = typeof adminSyncLog.$inferInsert;

/** Durable execution ledger for every scheduled or externally-triggered job. */
export const scheduledJobRuns = mysqlTable("scheduled_job_runs", {
  id: int("id").autoincrement().primaryKey(),
  jobKey: varchar("jobKey", { length: 96 }).notNull(),
  trigger: mysqlEnum("trigger", ["cron", "external", "manual"]).notNull().default("cron"),
  status: mysqlEnum("status", ["running", "success", "error"]).notNull().default("running"),
  startedAt: timestamp("startedAt").notNull(),
  finishedAt: timestamp("finishedAt"),
  durationMs: int("durationMs"),
  recordsProcessed: int("recordsProcessed").notNull().default(0),
  detail: text("detail"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("scheduled_job_runs_job_started_idx").on(table.jobKey, table.startedAt),
  index("scheduled_job_runs_status_started_idx").on(table.status, table.startedAt),
]);
export type ScheduledJobRun = typeof scheduledJobRuns.$inferSelect;
export type InsertScheduledJobRun = typeof scheduledJobRuns.$inferInsert;

/**
 * Read-only source snapshots used to connect Gmail, Drive, and Trello evidence.
 * Raw credentials are never stored here; content is deliberately compacted by
 * each source adapter before persistence.
 */
export const workspaceEvidenceItems = mysqlTable("workspace_evidence_items", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["gmail", "google_drive", "trello", "communication"]).notNull(),
  sourceId: varchar("sourceId", { length: 256 }).notNull(),
  sourceContainerId: varchar("sourceContainerId", { length: 256 }),
  kind: varchar("kind", { length: 128 }).notNull().default("record"),
  title: varchar("title", { length: 1024 }).notNull(),
  summary: text("summary"),
  content: text("content"),
  sourceUrl: varchar("sourceUrl", { length: 2048 }),
  mimeType: varchar("mimeType", { length: 256 }),
  modifiedAt: timestamp("modifiedAt"),
  observedAt: timestamp("observedAt").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  metadataJson: text("metadataJson"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("workspace_evidence_source_id_unique").on(table.source, table.sourceId),
  index("workspace_evidence_source_modified_idx").on(table.source, table.modifiedAt),
  index("workspace_evidence_active_observed_idx").on(table.active, table.observedAt),
]);
export type WorkspaceEvidenceItem = typeof workspaceEvidenceItems.$inferSelect;
export type InsertWorkspaceEvidenceItem = typeof workspaceEvidenceItems.$inferInsert;

/** Evidence can support several cards, and every link retains its match proof. */
export const workspaceEvidenceLinks = mysqlTable("workspace_evidence_links", {
  id: int("id").autoincrement().primaryKey(),
  evidenceId: int("evidenceId").notNull(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  relevanceScore: int("relevanceScore").notNull(),
  matchReason: varchar("matchReason", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("workspace_evidence_link_unique").on(table.evidenceId, table.cardId),
  index("workspace_evidence_card_relevance_idx").on(table.cardId, table.relevanceScore),
]);
export type WorkspaceEvidenceLink = typeof workspaceEvidenceLinks.$inferSelect;
export type InsertWorkspaceEvidenceLink = typeof workspaceEvidenceLinks.$inferInsert;

/** Single-user operating calendar used by planning and compliance. */
export const operatingProfiles = mysqlTable("operating_profiles", {
  id: int("id").autoincrement().primaryKey(),
  profileKey: varchar("profileKey", { length: 64 }).notNull().default("joyce"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Africa/Nairobi"),
  workStart: varchar("workStart", { length: 5 }).notNull().default("08:00"),
  workEnd: varchar("workEnd", { length: 5 }).notNull().default("23:00"),
  workingDaysJson: text("workingDaysJson").notNull(),
  breaksJson: text("breaksJson").notNull(),
  weeklyHoursMin: int("weeklyHoursMin").notNull().default(50),
  weeklyHoursMax: int("weeklyHoursMax").notNull().default(55),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("operating_profiles_key_unique").on(table.profileKey),
]);
export type OperatingProfile = typeof operatingProfiles.$inferSelect;
export type InsertOperatingProfile = typeof operatingProfiles.$inferInsert;

/** Explicit non-working days and exceptional working days. */
export const operatingHolidays = mysqlTable("operating_holidays", {
  id: int("id").autoincrement().primaryKey(),
  dateKey: date("dateKey").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  kind: mysqlEnum("kind", ["holiday", "leave", "exceptional_workday"]).notNull().default("holiday"),
  source: mysqlEnum("source", ["manual", "calendar", "policy"]).notNull().default("manual"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("operating_holidays_date_name_unique").on(table.dateKey, table.name),
  index("operating_holidays_date_active_idx").on(table.dateKey, table.active),
]);
export type OperatingHoliday = typeof operatingHolidays.$inferSelect;
export type InsertOperatingHoliday = typeof operatingHolidays.$inferInsert;

/** Durable dependency edges supplementing dependencies embedded in APTLSS steps. */
export const taskDependencies = mysqlTable("task_dependencies", {
  id: int("id").autoincrement().primaryKey(),
  cardId: varchar("cardId", { length: 64 }).notNull(),
  dependsOnCardId: varchar("dependsOnCardId", { length: 64 }).notNull(),
  dependencyType: mysqlEnum("dependencyType", ["finish_to_start", "start_to_start", "finish_to_finish"]).notNull().default("finish_to_start"),
  status: mysqlEnum("status", ["active", "resolved", "invalid"]).notNull().default("active"),
  source: mysqlEnum("source", ["manual", "aptlss", "trello"]).notNull().default("aptlss"),
  evidenceJson: text("evidenceJson"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("task_dependencies_edge_unique").on(table.cardId, table.dependsOnCardId),
  index("task_dependencies_target_status_idx").on(table.dependsOnCardId, table.status),
  index("task_dependencies_card_status_idx").on(table.cardId, table.status),
]);
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type InsertTaskDependency = typeof taskDependencies.$inferInsert;

/** Client and project context that can be matched to Trello boards. */
export const projectContexts = mysqlTable("project_contexts", {
  id: int("id").autoincrement().primaryKey(),
  projectKey: varchar("projectKey", { length: 128 }).notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  clientName: varchar("clientName", { length: 512 }),
  priority: mysqlEnum("priority", ["standard", "priority", "vip"]).notNull().default("standard"),
  boardIdsJson: text("boardIdsJson").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("project_contexts_key_unique").on(table.projectKey),
  index("project_contexts_active_priority_idx").on(table.active, table.priority),
]);
export type ProjectContext = typeof projectContexts.$inferSelect;
export type InsertProjectContext = typeof projectContexts.$inferInsert;

/** Normalized communication evidence across Gmail, Trello, Upwork, and future channels. */
export const communicationEvidence = mysqlTable("communication_evidence", {
  id: int("id").autoincrement().primaryKey(),
  channel: varchar("channel", { length: 64 }).notNull(),
  externalId: varchar("externalId", { length: 256 }).notNull(),
  threadId: varchar("threadId", { length: 256 }),
  direction: mysqlEnum("direction", ["inbound", "outbound", "system", "unknown"]).notNull().default("unknown"),
  sender: varchar("sender", { length: 512 }),
  recipientsJson: text("recipientsJson"),
  subject: varchar("subject", { length: 1024 }),
  summary: text("summary"),
  occurredAt: timestamp("occurredAt").notNull(),
  responseRequired: boolean("responseRequired").notNull().default(false),
  respondedAt: timestamp("respondedAt"),
  linkedCardId: varchar("linkedCardId", { length: 64 }),
  evidenceItemId: int("evidenceItemId"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("communication_evidence_channel_external_unique").on(table.channel, table.externalId),
  index("communication_evidence_card_occurred_idx").on(table.linkedCardId, table.occurredAt),
  index("communication_evidence_response_idx").on(table.responseRequired, table.respondedAt),
]);
export type CommunicationEvidence = typeof communicationEvidence.$inferSelect;
export type InsertCommunicationEvidence = typeof communicationEvidence.$inferInsert;

/** Local delivery history exists even when an optional notification provider is unavailable. */
export const operatorNotifications = mysqlTable("operator_notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 1200 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 64 }).notNull().default("operational"),
  deliveryStatus: mysqlEnum("deliveryStatus", ["pending", "delivered", "skipped", "failed"]).notNull().default("pending"),
  provider: varchar("provider", { length: 64 }).notNull().default("local"),
  providerReference: varchar("providerReference", { length: 512 }),
  errorMessage: text("errorMessage"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("operator_notifications_status_created_idx").on(table.deliveryStatus, table.createdAt),
  index("operator_notifications_read_created_idx").on(table.readAt, table.createdAt),
]);
export type OperatorNotification = typeof operatorNotifications.$inferSelect;
export type InsertOperatorNotification = typeof operatorNotifications.$inferInsert;

/** Versioned end-of-day and shift handoffs with their source plan snapshot. */
export const handoffRecords = mysqlTable("handoff_records", {
  id: int("id").autoincrement().primaryKey(),
  dateKey: date("dateKey").notNull(),
  handoffType: mysqlEnum("handoffType", ["end_of_day", "shift", "manual"]).notNull().default("end_of_day"),
  status: mysqlEnum("status", ["draft", "reviewed", "sent", "superseded"]).notNull().default("draft"),
  version: int("version").notNull().default(1),
  content: text("content").notNull(),
  checklistJson: text("checklistJson").notNull(),
  sourcePlanJson: text("sourcePlanJson"),
  reviewedAt: timestamp("reviewedAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("handoff_records_date_type_version_unique").on(table.dateKey, table.handoffType, table.version),
  index("handoff_records_date_status_idx").on(table.dateKey, table.status),
]);
export type HandoffRecord = typeof handoffRecords.$inferSelect;
export type InsertHandoffRecord = typeof handoffRecords.$inferInsert;
