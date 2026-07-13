/**
 * DB helpers for APTLSS operational policies, auto-follow-up drafts,
 * worker performance signals, and weekly analysis snapshots.
 */
import { getDb } from "./db";
import {
  aptlssOperationalPolicies,
  autoFollowUpDrafts,
  workerPerformanceSignals,
  weeklyAnalysisSnapshots,
  type AptlssOperationalPolicy,
  type AutoFollowUpDraft,
  type WorkerPerformanceSignal,
  type WeeklyAnalysisSnapshot,
} from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Operational Policies ────────────────────────────────────────────────────

/** Default policies seeded on first load */
const DEFAULT_POLICIES: Omit<AptlssOperationalPolicy, "id" | "createdAt" | "updatedAt">[] = [
  { ruleKey: "stall_threshold_days", label: "Stall Threshold (days)", description: "Number of days in DOING with no checklist progress before a card is marked STALLED.", value: "5", category: "stall", enabled: 1 },
  { ruleKey: "follow_up_hours_routine", label: "Routine Follow-up Delay (hours)", description: "Hours before drafting a follow-up for external parties who have not replied.", value: "24", category: "follow_up", enabled: 1 },
  { ruleKey: "follow_up_hours_urgent", label: "Urgent Follow-up Delay (hours)", description: "Hours before drafting a follow-up for active developer jobs with no reply.", value: "24", category: "follow_up", enabled: 1 },
  { ruleKey: "follow_up_hours_legal", label: "Legal/Formal Follow-up Delay (hours)", description: "Hours before drafting a formal reminder for legal/official matters.", value: "72", category: "follow_up", enabled: 1 },
  { ruleKey: "escalate_blocked_days", label: "Escalate Blocked After (days)", description: "Number of days a card can be blocked before escalating to Robert.", value: "3", category: "escalation", enabled: 1 },
  { ruleKey: "escalate_missed_deadlines", label: "Escalate After Missed Deadlines", description: "Number of missed deadlines by a freelancer before escalating to Robert.", value: "2", category: "escalation", enabled: 1 },
  { ruleKey: "autopilot_level", label: "Autopilot Level (0–5)", description: "0=Read only, 1=Approved checklist sync, 2=Internal planning, 3=External drafts, 4=Explicitly approved low-risk sends, 5=Exception-gated internal automation. Trello comments and moves always require an operator action.", value: "2", category: "autopilot", enabled: 1 },
  { ruleKey: "done_gate_require_summary", label: "Done Gate: Require Final Summary", description: "Block Done if no final summary comment exists on the card.", value: "true", category: "done_gate", enabled: 1 },
  { ruleKey: "done_gate_require_checklist_complete", label: "Done Gate: Require Checklist Complete", description: "Block Done if any APTLSS checklist item is still open.", value: "true", category: "done_gate", enabled: 1 },
  { ruleKey: "done_gate_require_no_unanswered", label: "Done Gate: Require No Unanswered Questions", description: "Block Done if there is an unanswered question in the card comments.", value: "true", category: "done_gate", enabled: 1 },
  { ruleKey: "confidence_auto_proceed_threshold", label: "Confidence Auto-Proceed Threshold (%)", description: "Plans with confidence above this threshold may proceed automatically.", value: "85", category: "scheduling", enabled: 1 },
  { ruleKey: "confidence_flag_threshold", label: "Confidence Flag-for-Review Threshold (%)", description: "Plans with confidence below this threshold are flagged for Joyce review.", value: "65", category: "scheduling", enabled: 1 },
];
let policyMetadataSync: Promise<void> | null = null;

async function ensureDefaultPolicies(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!policyMetadataSync) {
    policyMetadataSync = (async () => {
      for (const policy of DEFAULT_POLICIES) {
        await db.insert(aptlssOperationalPolicies).values(policy as AptlssOperationalPolicy).onDuplicateKeyUpdate({
          set: { label: policy.label, description: policy.description, category: policy.category },
        });
      }
    })().catch((error) => {
      policyMetadataSync = null;
      throw error;
    });
  }
  await policyMetadataSync;
}

export async function getAllPolicies(): Promise<AptlssOperationalPolicy[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureDefaultPolicies(db);
  return db.select().from(aptlssOperationalPolicies).orderBy(aptlssOperationalPolicies.category, aptlssOperationalPolicies.ruleKey);
}

export async function getPolicyByKey(ruleKey: string): Promise<AptlssOperationalPolicy | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureDefaultPolicies(db);
  const rows = await db.select().from(aptlssOperationalPolicies).where(eq(aptlssOperationalPolicies.ruleKey, ruleKey)).limit(1);
  return rows[0] ?? null;
}

export async function getPolicyValue(ruleKey: string, fallback: string): Promise<string> {
  const row = await getPolicyByKey(ruleKey);
  return row && row.enabled === 1 ? row.value : fallback;
}

export function resolvePolicyBoolean(
  row: Pick<AptlssOperationalPolicy, "enabled" | "value"> | null,
  fallback: boolean,
): boolean {
  if (!row) return fallback;
  if (row.enabled !== 1) return false;
  const value = row.value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return fallback;
}

export async function getPolicyBoolean(ruleKey: string, fallback: boolean): Promise<boolean> {
  const row = await getPolicyByKey(ruleKey);
  return resolvePolicyBoolean(row, fallback);
}

export async function getPolicyNumber(
  ruleKey: string,
  fallback: number,
  range?: { min?: number; max?: number },
): Promise<number> {
  const parsed = Number(await getPolicyValue(ruleKey, String(fallback)));
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(range?.max ?? Number.POSITIVE_INFINITY, Math.max(range?.min ?? Number.NEGATIVE_INFINITY, safe));
}

async function getPolicyNumberSetting(
  ruleKey: string,
  fallback: number,
  range?: { min?: number; max?: number },
): Promise<{ value: number; enabled: boolean }> {
  const row = await getPolicyByKey(ruleKey);
  return resolvePolicyNumberSetting(row, fallback, range);
}

export function resolvePolicyNumberSetting(
  row: Pick<AptlssOperationalPolicy, "enabled" | "value"> | null,
  fallback: number,
  range?: { min?: number; max?: number },
): { value: number; enabled: boolean } {
  const parsed = Number(row?.value ?? fallback);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return {
    value: Math.min(range?.max ?? Number.POSITIVE_INFINITY, Math.max(range?.min ?? Number.NEGATIVE_INFINITY, safe)),
    enabled: row ? row.enabled === 1 : true,
  };
}

export async function getOperationalPolicySnapshot() {
  const [
    stall,
    routineFollowUp,
    urgentFollowUp,
    legalFollowUp,
    blockedEscalation,
    missedDeadlineEscalation,
    confidenceAutoProceed,
    confidenceFlagging,
  ] = await Promise.all([
    getPolicyNumberSetting("stall_threshold_days", 5, { min: 1, max: 30 }),
    getPolicyNumberSetting("follow_up_hours_routine", 24, { min: 1, max: 720 }),
    getPolicyNumberSetting("follow_up_hours_urgent", 24, { min: 1, max: 720 }),
    getPolicyNumberSetting("follow_up_hours_legal", 72, { min: 1, max: 720 }),
    getPolicyNumberSetting("escalate_blocked_days", 3, { min: 1, max: 90 }),
    getPolicyNumberSetting("escalate_missed_deadlines", 2, { min: 1, max: 50 }),
    getPolicyNumberSetting("confidence_auto_proceed_threshold", 85, { min: 50, max: 100 }),
    getPolicyNumberSetting("confidence_flag_threshold", 65, { min: 0, max: 95 }),
  ]);
  return {
    stallThresholdDays: stall.value,
    stallDetectionEnabled: stall.enabled,
    routineFollowUpHours: routineFollowUp.value,
    routineFollowUpEnabled: routineFollowUp.enabled,
    urgentFollowUpHours: urgentFollowUp.value,
    urgentFollowUpEnabled: urgentFollowUp.enabled,
    legalFollowUpHours: legalFollowUp.value,
    legalFollowUpEnabled: legalFollowUp.enabled,
    escalateBlockedDays: blockedEscalation.value,
    blockedEscalationEnabled: blockedEscalation.enabled,
    escalateMissedDeadlines: missedDeadlineEscalation.value,
    missedDeadlineEscalationEnabled: missedDeadlineEscalation.enabled,
    confidenceAutoProceedThreshold: confidenceAutoProceed.value,
    confidenceAutoProceedEnabled: confidenceAutoProceed.enabled,
    confidenceFlagThreshold: confidenceFlagging.value,
    confidenceFlaggingEnabled: confidenceFlagging.enabled,
  };
}

export async function upsertPolicy(ruleKey: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(aptlssOperationalPolicies)
    .values({ ruleKey, value, label: ruleKey, category: "general", enabled: 1 } as AptlssOperationalPolicy)
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function setPolicyEnabled(ruleKey: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(aptlssOperationalPolicies)
    .set({ enabled: enabled ? 1 : 0, updatedAt: new Date() })
    .where(eq(aptlssOperationalPolicies.ruleKey, ruleKey));
}

// ─── Auto Follow-Up Drafts ───────────────────────────────────────────────────

export async function getPendingFollowUpDrafts(): Promise<AutoFollowUpDraft[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(autoFollowUpDrafts)
    .where(eq(autoFollowUpDrafts.status, "pending"))
    .orderBy(desc(autoFollowUpDrafts.createdAt));
}

export async function getAllFollowUpDrafts(): Promise<AutoFollowUpDraft[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(autoFollowUpDrafts).orderBy(desc(autoFollowUpDrafts.createdAt)).limit(50);
}

export async function upsertFollowUpDraft(draft: Omit<AutoFollowUpDraft, "id" | "createdAt" | "updatedAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(autoFollowUpDrafts)
    .where(and(eq(autoFollowUpDrafts.cardId, draft.cardId), eq(autoFollowUpDrafts.status, "pending")))
    .limit(1);
  if (existing.length > 0) {
    await db.update(autoFollowUpDrafts)
      .set({ draftMessage: draft.draftMessage, reason: draft.reason, hoursSinceLastReply: draft.hoursSinceLastReply, urgencyType: draft.urgencyType, updatedAt: new Date() })
      .where(eq(autoFollowUpDrafts.id, existing[0].id));
  } else {
    await db.insert(autoFollowUpDrafts).values(draft as AutoFollowUpDraft);
  }
}

export async function getFollowUpDraftById(id: number): Promise<AutoFollowUpDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(autoFollowUpDrafts).where(eq(autoFollowUpDrafts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function markFollowUpDraftSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(autoFollowUpDrafts).set({ status: "sent", updatedAt: new Date() }).where(eq(autoFollowUpDrafts.id, id));
}

export async function dismissFollowUpDraft(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(autoFollowUpDrafts).set({ status: "dismissed", updatedAt: new Date() }).where(eq(autoFollowUpDrafts.id, id));
}

// ─── Worker Performance Signals ──────────────────────────────────────────────

export async function getAllWorkerPerformance(): Promise<WorkerPerformanceSignal[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workerPerformanceSignals).orderBy(desc(workerPerformanceSignals.weekKey), workerPerformanceSignals.workerName);
}

export async function upsertWorkerPerformance(signal: Omit<WorkerPerformanceSignal, "id" | "createdAt" | "updatedAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(workerPerformanceSignals)
    .where(and(eq(workerPerformanceSignals.workerId, signal.workerId), eq(workerPerformanceSignals.weekKey, signal.weekKey)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(workerPerformanceSignals).set({ ...signal, updatedAt: new Date() }).where(eq(workerPerformanceSignals.id, existing[0].id));
  } else {
    await db.insert(workerPerformanceSignals).values(signal as WorkerPerformanceSignal);
  }
}

// ─── Weekly Analysis Snapshots ───────────────────────────────────────────────

export async function getLatestWeeklyAnalysis(): Promise<WeeklyAnalysisSnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(weeklyAnalysisSnapshots).orderBy(desc(weeklyAnalysisSnapshots.generatedAt)).limit(1);
  return rows[0] ?? null;
}

export async function getWeeklyAnalysisByKey(weekKey: string): Promise<WeeklyAnalysisSnapshot | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(weeklyAnalysisSnapshots).where(eq(weeklyAnalysisSnapshots.weekKey, weekKey)).limit(1);
  return rows[0] ?? null;
}

export async function upsertWeeklyAnalysis(snapshot: Omit<WeeklyAnalysisSnapshot, "id" | "createdAt" | "generatedAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getWeeklyAnalysisByKey(snapshot.weekKey);
  if (existing) {
    await db.update(weeklyAnalysisSnapshots).set({ ...snapshot, generatedAt: new Date() }).where(eq(weeklyAnalysisSnapshots.weekKey, snapshot.weekKey));
  } else {
    await db.insert(weeklyAnalysisSnapshots).values(snapshot as WeeklyAnalysisSnapshot);
  }
}

export async function getRecentWeeklyAnalyses(limit = 8): Promise<WeeklyAnalysisSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyAnalysisSnapshots).orderBy(desc(weeklyAnalysisSnapshots.generatedAt)).limit(limit);
}

// ─── Autopilot Level Helper (Item 17) ────────────────────────────────────────
/**
 * Returns the current autopilot level (0–5).
 * 0 = read-only, 1 = approved checklist sync, 2 = internal execution support,
 * 3 = draft external comms, 4 = explicitly approved low-risk sends,
 * 5 = exception-gated internal automation. Trello side effects remain explicit.
 */
export async function getAutopilotLevel(): Promise<number> {
  const row = await getPolicyByKey("autopilot_level");
  if (row && row.enabled !== 1) return 0;
  const val = row?.value ?? "2";
  const n = parseInt(val, 10);
  return isNaN(n) ? 2 : Math.max(0, Math.min(5, n));
}
