import { randomBytes, timingSafeEqual } from "crypto";
import { desc, eq } from "drizzle-orm";
import {
  browserTabDailyEvidence,
  browserTabStates,
  appSettings,
} from "../drizzle/schema";
import {
  DEFAULT_BROWSER_TAB_POLICY,
  evaluateBrowserTabHygiene,
  normalizeBrowserTabPolicy,
  type BrowserTabPolicy,
} from "../shared/browserTabPolicy";
import { dateKeyInEat } from "../shared/eatTime";
import { getDb, getScheduleSettings } from "./db";

const POLICY_KEY = "browserTabPolicy";
const COLLECTOR_TOKEN_KEY = "browserTabCollectorToken";
const MAX_STORED_TABS = 250;

export interface BrowserTabInventoryItem {
  id: string;
  title: string;
  url: string;
  pinned: boolean;
  active: boolean;
  windowId: number;
}

export interface BrowserTabInventoryInput {
  collectorId: string;
  collectorLabel?: string;
  tabs: BrowserTabInventoryItem[];
}

async function readSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function writeSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required to persist browser-tab settings");
  await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getBrowserTabPolicy(): Promise<BrowserTabPolicy> {
  const raw = await readSetting(POLICY_KEY);
  if (!raw) return DEFAULT_BROWSER_TAB_POLICY;
  try {
    return normalizeBrowserTabPolicy(JSON.parse(raw) as Partial<BrowserTabPolicy>);
  } catch {
    return DEFAULT_BROWSER_TAB_POLICY;
  }
}

export async function setBrowserTabPolicy(input: Partial<BrowserTabPolicy>) {
  const policy = normalizeBrowserTabPolicy(input);
  await writeSetting(POLICY_KEY, JSON.stringify(policy));
  return policy;
}

export async function ensureBrowserTabCollectorToken() {
  const existing = await readSetting(COLLECTOR_TOKEN_KEY);
  if (existing?.trim()) return existing.trim();
  const token = randomBytes(32).toString("base64url");
  await writeSetting(COLLECTOR_TOKEN_KEY, token);
  return token;
}

export async function hasBrowserTabCollectorToken() {
  return Boolean((await readSetting(COLLECTOR_TOKEN_KEY))?.trim());
}

export async function verifyBrowserTabCollectorToken(candidate: string | null | undefined) {
  const expected = await readSetting(COLLECTOR_TOKEN_KEY);
  if (!expected || !candidate) return false;
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
}

function sanitizeUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return `${parsed.origin}${parsed.pathname}`.slice(0, 2_048);
    }
    return `${parsed.protocol}//`.slice(0, 2_048);
  } catch {
    return "unknown://";
  }
}

function sanitizeTab(tab: BrowserTabInventoryItem): BrowserTabInventoryItem {
  return {
    id: String(tab.id).slice(0, 64),
    title: tab.title.trim().slice(0, 512) || "Untitled tab",
    url: sanitizeUrl(tab.url),
    pinned: Boolean(tab.pinned),
    active: Boolean(tab.active),
    windowId: Number.isFinite(tab.windowId) ? Math.trunc(tab.windowId) : 0,
  };
}

function actionableTabs(tabs: BrowserTabInventoryItem[], policy: BrowserTabPolicy) {
  return tabs.filter((tab) => policy.includePinnedTabs || !tab.pinned);
}

export async function ingestBrowserTabInventory(input: BrowserTabInventoryInput, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is required to ingest browser-tab state");
  const tabs = input.tabs.slice(0, MAX_STORED_TABS).map(sanitizeTab);
  const collectorId = input.collectorId.trim().slice(0, 128);
  const collectorLabel = input.collectorLabel?.trim().slice(0, 128) || "Joyce Chrome";
  if (!collectorId) throw new Error("collectorId is required");

  const values = {
    collectorId,
    collectorLabel,
    totalTabs: tabs.length,
    pinnedTabs: tabs.filter((tab) => tab.pinned).length,
    windowCount: new Set(tabs.map((tab) => tab.windowId)).size,
    tabsJson: JSON.stringify(tabs),
    capturedAt: now,
  };
  await db.insert(browserTabStates).values(values).onDuplicateKeyUpdate({ set: values });

  const status = await getBrowserTabStatus(now);
  if (status.warningWindow) await recordBrowserTabEodEvidence(now, "collector");
  return status;
}

function parseTabs(raw: string): BrowserTabInventoryItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_TABS) : [];
  } catch {
    return [];
  }
}

export async function getLatestBrowserTabState() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(browserTabStates).orderBy(desc(browserTabStates.capturedAt)).limit(1);
  const row = rows[0];
  return row ? { ...row, tabs: parseTabs(row.tabsJson) } : null;
}

export async function getBrowserTabStatus(now = new Date()) {
  const [policy, schedule, latest, collectorConfigured] = await Promise.all([
    getBrowserTabPolicy(),
    getScheduleSettings(),
    getLatestBrowserTabState(),
    hasBrowserTabCollectorToken(),
  ]);
  const tabs = latest?.tabs ?? [];
  const actionable = actionableTabs(tabs, policy);
  const evaluation = evaluateBrowserTabHygiene({
    now,
    workEnd: schedule.endTime,
    policy,
    totalTabs: latest?.totalTabs ?? 0,
    actionableTabs: actionable.length,
    capturedAt: latest?.capturedAt ?? null,
  });
  return {
    ...evaluation,
    policy,
    workEnd: schedule.endTime,
    collectorConfigured,
    collectorLabel: latest?.collectorLabel ?? null,
    capturedAt: latest?.capturedAt ?? null,
    pinnedTabs: latest?.pinnedTabs ?? 0,
    windowCount: latest?.windowCount ?? 0,
    tabs: actionable
      .sort((left, right) => Number(right.active) - Number(left.active) || left.title.localeCompare(right.title))
      .slice(0, 50),
  };
}

export async function recordBrowserTabEodEvidence(now = new Date(), source = "auto") {
  const db = await getDb();
  if (!db) throw new Error("Database is required to record browser-tab evidence");
  const status = await getBrowserTabStatus(now);
  const snapshotDate = dateKeyInEat(now);
  const values = {
    snapshotDate: snapshotDate as unknown as Date,
    status: status.status,
    totalTabs: status.totalTabs,
    actionableTabs: status.actionableTabs,
    allowedTabs: status.allowedTabs,
    compliant: status.compliant,
    source: source.slice(0, 32),
    evidenceJson: JSON.stringify({
      version: 1,
      collectorLabel: status.collectorLabel,
      windowCount: status.windowCount,
      pinnedTabs: status.pinnedTabs,
      excessTabs: status.excessTabs,
      ageMinutes: status.ageMinutes,
      workEnd: status.workEnd,
      tabs: status.tabs,
    }),
    capturedAt: status.capturedAt,
    verifiedAt: now,
  };
  await db.insert(browserTabDailyEvidence).values(values).onDuplicateKeyUpdate({ set: values });
  return { ...status, snapshotDate };
}

export async function getBrowserTabEvidenceHistory(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(browserTabDailyEvidence).orderBy(desc(browserTabDailyEvidence.snapshotDate)).limit(Math.min(366, Math.max(1, limit)));
}

export async function getBrowserTabEvidenceByDate(dateKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(browserTabDailyEvidence)
    .where(eq(browserTabDailyEvidence.snapshotDate, dateKey as unknown as Date))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return { ...row, evidence: JSON.parse(row.evidenceJson) as Record<string, unknown> };
  } catch {
    return { ...row, evidence: {} };
  }
}
