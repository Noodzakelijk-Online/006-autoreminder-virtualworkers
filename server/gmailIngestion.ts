import { getLatestJobRuns, runTrackedJob, type JobTrigger } from "./scheduledJobsDb";
import { upsertEmailTask } from "./db";
import { refreshGmailAccessToken } from "./gmailOauth";
import { broadcast } from "./sse";
import { upsertWorkspaceEvidence } from "./workspaceEvidenceDb";
import { getWorkspaceEvidenceStats } from "./workspaceEvidenceDb";
import { upsertCommunicationEvidence } from "./communicationEvidenceDb";
import { GMAIL_READONLY_SCOPE, GOOGLE_DRIVE_READONLY_SCOPE } from "./gmailOauth";
import {
  GMAIL_INGESTION_INTERVALS,
  buildGmailOauthCallbackUrl,
  clearGmailOauthConnection,
  getGmailIngestionSettings,
  getGmailOauthClientCredentials,
  getGmailOauthConnection,
  maskOauthClientId,
} from "./gmailIngestionSettings";

const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_FETCH_CONCURRENCY = 8;

interface GmailMessageReference {
  id: string;
  threadId: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface GmailListResponse {
  messages?: GmailMessageReference[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface NormalizedGmailTask {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  snippet: string;
  receivedAt: Date;
  category: "financial" | "non_financial";
  status: "pending";
  suggestedNextAction: string;
  llmSummary: string;
}

export interface GmailIngestionResult {
  scanned: number;
  deduplicated: number;
  imported: number;
  rejected: number;
}

interface GmailSchedulerRuntimeState {
  running: boolean;
  nextRunAt: string | null;
  blockedReason: string | null;
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let activeRun: Promise<GmailIngestionResult> | null = null;
let schedulerGeneration = 0;
let schedulerState: GmailSchedulerRuntimeState = { running: false, nextRunAt: null, blockedReason: null };

function decodeMimeWords(value: string): string {
  return value
    .replace(/=\?([^?]+)\?B\?([^?]+)\?=/gi, (_match, charset: string, encoded: string) => {
      try {
        return Buffer.from(encoded, "base64").toString(charset.toLowerCase() === "iso-8859-1" ? "latin1" : "utf8");
      } catch {
        return _match;
      }
    })
    .replace(/=\?([^?]+)\?Q\?([^?]+)\?=/gi, (_match, charset: string, encoded: string) => {
      try {
        const bytes = encoded.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_token: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return Buffer.from(bytes, "binary").toString(charset.toLowerCase() === "iso-8859-1" ? "latin1" : "utf8");
      } catch {
        return _match;
      }
    });
}

function header(message: GmailMessage, name: string): string {
  const value = message.payload?.headers?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return decodeMimeWords(value).trim();
}

function parseSender(value: string): { name: string; address: string } {
  const angle = value.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  if (angle) {
    return {
      name: angle[1].replace(/^['"]|['"]$/g, "").trim(),
      address: angle[2].trim().toLowerCase(),
    };
  }
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  return { name: email ? value.replace(email, "").trim() : value.trim(), address: email.toLowerCase() };
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`;
}

const FINANCIAL_PATTERN = /\b(invoice|receipt|payment|paid|billing|bank|balance|transaction|transfer|refund|credit|debit|tax|vat|payroll|salary|subscription|renewal|charge|amount due|overdue)\b/i;
const SECURITY_PATTERN = /\b(password|security|sign[ -]?in|login|verification|verify|suspicious|breach|two-factor|2fa|account access)\b/i;
const SCHEDULING_PATTERN = /\b(meeting|appointment|calendar|schedule|reschedule|availability|deadline)\b/i;
const SUPPORT_PATTERN = /\b(case|ticket|support|bug report|troubleshoot|reproduction|incident)\b/i;
const REPLY_PATTERN = /\b(please|could you|can you|would you|need your|reply|respond|confirm|question|requested)\b/i;

export function classifyGmailTask(input: { subject: string; snippet: string; fromName: string; fromAddress: string }): Pick<NormalizedGmailTask, "category" | "suggestedNextAction" | "llmSummary"> {
  const subject = input.subject || "(no subject)";
  const source = input.fromName || input.fromAddress || "The sender";
  const evidence = `${subject} ${input.snippet}`;
  const category = FINANCIAL_PATTERN.test(evidence) ? "financial" : "non_financial";

  let suggestedNextAction: string;
  if (category === "financial") {
    suggestedNextAction = `Review "${compact(subject, 90)}" and record any payment or bookkeeping action.`;
  } else if (SECURITY_PATTERN.test(evidence)) {
    suggestedNextAction = `Review "${compact(subject, 90)}" and secure the account if action is required.`;
  } else if (SCHEDULING_PATTERN.test(evidence)) {
    suggestedNextAction = `Review "${compact(subject, 90)}" and confirm or update the requested schedule.`;
  } else if (SUPPORT_PATTERN.test(evidence)) {
    suggestedNextAction = `Review "${compact(subject, 90)}" and complete the requested troubleshooting or follow-up.`;
  } else if (REPLY_PATTERN.test(evidence)) {
    suggestedNextAction = `Review "${compact(subject, 90)}" and send the required reply.`;
  } else if (/\b(no[- ]?reply|notification|automated|newsletter|digest)\b/i.test(`${input.fromAddress} ${evidence}`)) {
    suggestedNextAction = `Review "${compact(subject, 90)}" for required action, then archive it if informational.`;
  } else {
    suggestedNextAction = `Review "${compact(subject, 90)}" and decide whether it needs a reply, Trello card, or archive.`;
  }

  const context = compact(input.snippet, 180);
  const llmSummary = context
    ? `${source}: ${context}`
    : `${source} sent "${compact(subject, 140)}".`;
  return { category, suggestedNextAction, llmSummary };
}

export function normalizeGmailMessage(message: GmailMessage): NormalizedGmailTask {
  const subject = header(message, "subject") || "(no subject)";
  const sender = parseSender(header(message, "from"));
  const snippet = message.snippet ?? "";
  const receivedMs = Number(message.internalDate);
  const receivedAt = Number.isFinite(receivedMs) && receivedMs > 0 ? new Date(receivedMs) : new Date();
  const assessment = classifyGmailTask({ subject, snippet, fromName: sender.name, fromAddress: sender.address });
  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    subject,
    fromAddress: sender.address,
    fromName: sender.name,
    snippet,
    receivedAt,
    category: assessment.category,
    status: "pending",
    suggestedNextAction: assessment.suggestedNextAction,
    llmSummary: assessment.llmSummary,
  };
}

export function deduplicateGmailTasks(tasks: NormalizedGmailTask[]): NormalizedGmailTask[] {
  const newestByThread = new Map<string, NormalizedGmailTask>();
  for (const task of tasks) {
    const existing = newestByThread.get(task.gmailThreadId);
    if (!existing || task.receivedAt.getTime() > existing.receivedAt.getTime()) {
      newestByThread.set(task.gmailThreadId, task);
    }
  }
  return Array.from(newestByThread.values()).sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${GMAIL_API_ROOT}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      throw new Error(`Gmail API ${response.status}: ${detail || response.statusText}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Gmail API request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listGmailMessageReferences(accessToken: string, lookbackHours: number, maxMessages: number): Promise<GmailMessageReference[]> {
  const after = Math.floor((Date.now() - lookbackHours * 60 * 60_000) / 1_000);
  const messages: GmailMessageReference[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      q: `in:inbox after:${after} -in:spam -in:trash`,
      maxResults: String(Math.min(100, maxMessages - messages.length)),
    });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await gmailFetch<GmailListResponse>(accessToken, `/messages?${query.toString()}`);
    messages.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && messages.length < maxMessages);
  return messages.slice(0, maxMessages);
}

async function fetchMessageBatch(accessToken: string, references: GmailMessageReference[]): Promise<{ messages: GmailMessage[]; rejected: number }> {
  const messages: GmailMessage[] = [];
  let rejected = 0;
  for (let index = 0; index < references.length; index += GMAIL_FETCH_CONCURRENCY) {
    const batch = references.slice(index, index + GMAIL_FETCH_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((reference) => {
      const params = new URLSearchParams({ format: "metadata" });
      params.append("metadataHeaders", "From");
      params.append("metadataHeaders", "Subject");
      return gmailFetch<GmailMessage>(accessToken, `/messages/${encodeURIComponent(reference.id)}?${params.toString()}`);
    }));
    for (const result of results) {
      if (result.status === "fulfilled") messages.push(result.value);
      else rejected++;
    }
  }
  return { messages, rejected };
}

async function executeGmailIngestion(): Promise<GmailIngestionResult> {
  const settings = await getGmailIngestionSettings();
  const { accessToken } = await refreshGmailAccessToken();
  const references = await listGmailMessageReferences(accessToken, settings.lookbackHours, settings.maxMessages);
  const fetched = await fetchMessageBatch(accessToken, references);
  const normalized = deduplicateGmailTasks(fetched.messages.map(normalizeGmailMessage));
  let imported = 0;
  let rejected = fetched.rejected;
  for (const task of normalized) {
    try {
      await upsertEmailTask(task);
      const evidenceItemId = await upsertWorkspaceEvidence({
        source: "gmail",
        sourceId: task.gmailMessageId,
        sourceContainerId: task.gmailThreadId,
        kind: "email",
        title: task.subject,
        summary: task.llmSummary,
        content: [task.snippet, task.suggestedNextAction].filter(Boolean).join("\n"),
        sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(task.gmailThreadId)}`,
        mimeType: "message/rfc822",
        modifiedAt: task.receivedAt,
        observedAt: new Date(),
        metadataJson: JSON.stringify({
          threadId: task.gmailThreadId,
          fromAddress: task.fromAddress,
          fromName: task.fromName,
          category: task.category,
        }),
        active: true,
      });
      await upsertCommunicationEvidence({
        channel: "gmail",
        externalId: task.gmailMessageId,
        threadId: task.gmailThreadId,
        direction: "inbound",
        sender: task.fromAddress || task.fromName,
        subject: task.subject,
        summary: task.llmSummary,
        occurredAt: task.receivedAt,
        responseRequired: /send the required reply|confirm or update|requested/i.test(task.suggestedNextAction),
        evidenceItemId,
        metadata: {
          category: task.category,
          suggestedNextAction: task.suggestedNextAction,
        },
      });
      imported++;
    } catch (error) {
      rejected++;
      console.error(`[GmailIngestion] Failed to import ${task.gmailMessageId}:`, error);
    }
  }
  return { scanned: references.length, deduplicated: normalized.length, imported, rejected };
}

export async function runGmailIngestion(trigger: JobTrigger = "manual"): Promise<GmailIngestionResult> {
  if (activeRun) return activeRun;
  activeRun = runTrackedJob({
    jobKey: "gmail_ingestion",
    trigger,
    run: executeGmailIngestion,
    summarize: (result) => ({
      recordsProcessed: result.imported,
      detail: `${result.scanned} scanned, ${result.deduplicated} retained, ${result.imported} imported, ${result.rejected} rejected`,
    }),
  }).then((result) => {
    broadcast("gmail-invalidate");
    return result;
  }).finally(() => {
    activeRun = null;
    schedulerState = { ...schedulerState, running: false };
  });
  schedulerState = { ...schedulerState, running: true, blockedReason: null };
  return activeRun;
}

async function scheduleNextRun(delayMs?: number): Promise<void> {
  const generation = ++schedulerGeneration;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = null;
  schedulerState = { ...schedulerState, nextRunAt: null, blockedReason: null };

  const [settings, client, connection] = await Promise.all([
    getGmailIngestionSettings(),
    getGmailOauthClientCredentials(),
    getGmailOauthConnection(),
  ]);
  if (!settings.enabled) return;
  if (!client) {
    schedulerState = { ...schedulerState, blockedReason: "Google OAuth client is not configured" };
    return;
  }
  if (!connection) {
    schedulerState = { ...schedulerState, blockedReason: "Gmail is not connected" };
    return;
  }

  const intervalMs = settings.intervalMinutes * 60_000;
  const delay = Math.max(1_000, delayMs ?? intervalMs);
  schedulerState = { ...schedulerState, nextRunAt: new Date(Date.now() + delay).toISOString() };
  schedulerTimer = setTimeout(() => {
    if (generation !== schedulerGeneration) return;
    schedulerTimer = null;
    schedulerState = { ...schedulerState, nextRunAt: null };
    schedulerState = { ...schedulerState, running: true };
    void import("./workspaceIngestion").then(({ runWorkspaceIngestion }) => runWorkspaceIngestion("cron"))
      .catch((error) => console.error("[WorkspaceIngestion] Scheduled run failed:", error))
      .finally(() => {
        schedulerState = { ...schedulerState, running: false };
        return scheduleNextRun().catch((error) => {
          schedulerState = { ...schedulerState, blockedReason: error instanceof Error ? error.message : String(error) };
          console.error("[WorkspaceIngestion] Could not schedule the next run:", error);
        });
      });
  }, delay);
  schedulerTimer.unref?.();
}

export async function rescheduleGmailIngestion(): Promise<void> {
  await scheduleNextRun();
}

export async function startGmailIngestionScheduler(): Promise<void> {
  const settings = await getGmailIngestionSettings();
  if (!settings.enabled) {
    await scheduleNextRun();
    console.log("[GmailIngestion] Internal scheduler is disabled.");
    return;
  }
  const latestRuns = await getLatestJobRuns();
  const latest = latestRuns.find((run) => run.jobKey === "workspace_ingestion")
    ?? latestRuns.find((run) => run.jobKey === "gmail_ingestion");
  const intervalMs = settings.intervalMinutes * 60_000;
  const dueIn = latest
    ? new Date(latest.startedAt).getTime() + intervalMs - Date.now()
    : 5_000;
  await scheduleNextRun(Math.max(5_000, dueIn));
  console.log(`[WorkspaceIngestion] Internal scheduler active every ${settings.intervalMinutes} minute(s).`);
}

export function getGmailSchedulerRuntimeState(): GmailSchedulerRuntimeState {
  return { ...schedulerState, running: schedulerState.running || Boolean(activeRun) };
}

export async function getGmailIntegrationStatus(origin: string) {
  const [settings, client, connection, runs, evidence] = await Promise.all([
    getGmailIngestionSettings(),
    getGmailOauthClientCredentials(),
    getGmailOauthConnection(),
    getLatestJobRuns(),
    getWorkspaceEvidenceStats(),
  ]);
  const latestRun = runs.find((run) => run.jobKey === "gmail_ingestion") ?? null;
  const workspaceLatestRun = runs.find((run) => run.jobKey === "workspace_ingestion") ?? null;
  const scopes = connection?.scopes ?? [];
  const gmailScopeGranted = scopes.includes(GMAIL_READONLY_SCOPE)
    || scopes.includes("https://mail.google.com/");
  const driveScopeGranted = scopes.includes(GOOGLE_DRIVE_READONLY_SCOPE)
    || scopes.includes("https://www.googleapis.com/auth/drive");
  return {
    settings,
    intervalOptions: [...GMAIL_INGESTION_INTERVALS],
    callbackUrl: buildGmailOauthCallbackUrl(origin),
    oauthClientConfigured: Boolean(client),
    oauthClientPreview: client ? maskOauthClientId(client.clientId) : null,
    oauthClientManagedByEnvironment: client?.source === "environment",
    connected: Boolean(connection),
    accountEmail: connection?.email ?? null,
    connectionManagedByEnvironment: connection?.source === "environment",
    connectedAt: connection?.connectedAt ?? null,
    scopes: { gmail: gmailScopeGranted, googleDrive: driveScopeGranted },
    reconnectRequired: Boolean(connection && (!gmailScopeGranted || !driveScopeGranted)),
    canRun: Boolean(client && connection && gmailScopeGranted),
    evidence,
    runtime: getGmailSchedulerRuntimeState(),
    latestRun,
    workspaceLatestRun,
    sourceRuns: {
      gmail: latestRun,
      googleDrive: runs.find((run) => run.jobKey === "google_drive_ingestion") ?? null,
      trello: runs.find((run) => run.jobKey === "trello_evidence_ingestion") ?? null,
    },
  };
}

export async function disconnectGmail(): Promise<void> {
  const connection = await getGmailOauthConnection();
  if (!connection) return;
  if (connection.source === "environment") {
    throw new Error("Gmail is managed by GMAIL_OAUTH_REFRESH_TOKEN; remove it from the server environment to disconnect");
  }
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: connection.refreshToken }),
    });
  } catch (error) {
    console.warn("[GmailIngestion] Google token revocation could not be confirmed:", error);
  }
  await clearGmailOauthConnection();
  await rescheduleGmailIngestion();
}
