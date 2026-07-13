import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";

const SCHEDULE_KEY = "gmailIngestionSettings";
const OAUTH_CLIENT_KEY = "gmailOauthClient";
const OAUTH_CONNECTION_KEY = "gmailOauthConnection";
const OAUTH_PENDING_KEY = "gmailOauthPending";
const DRIVE_CHANGE_TOKEN_KEY = "googleDriveChangeToken";
const OAUTH_CALLBACK_PATH = "/api/integrations/gmail/callback";

export const GMAIL_INGESTION_INTERVALS = [5, 15, 30, 60, 120, 240, 720, 1_440] as const;
export type GmailIngestionInterval = (typeof GMAIL_INGESTION_INTERVALS)[number];

export interface GmailIngestionSettings {
  enabled: boolean;
  intervalMinutes: GmailIngestionInterval;
  lookbackHours: number;
  maxMessages: number;
}

export const DEFAULT_GMAIL_INGESTION_SETTINGS: GmailIngestionSettings = {
  enabled: false,
  intervalMinutes: 60,
  lookbackHours: 24,
  maxMessages: 250,
};

interface SealedValue {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface StoredOauthClient {
  clientId: string;
  clientSecret: SealedValue;
  updatedAt: string;
}

interface StoredOauthConnection {
  refreshToken: SealedValue;
  email: string;
  connectedAt: string;
  scopes?: string[];
}

interface PendingOauthState {
  state: string;
  redirectUri: string;
  createdAt: string;
}

export interface GmailOauthClientCredentials {
  clientId: string;
  clientSecret: string;
  source: "environment" | "database";
}

export interface GmailOauthConnection {
  refreshToken: string;
  email: string;
  connectedAt: string | null;
  scopes: string[];
  source: "environment" | "database";
}

function encryptionKey(): Buffer {
  const secret = process.env.GMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET or GMAIL_CREDENTIALS_ENCRYPTION_KEY is required to protect Gmail credentials");
  }
  return createHash("sha256").update(secret).digest();
}

function seal(value: string): SealedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function unseal(value: SealedValue): string {
  if (value?.version !== 1 || !value.iv || !value.tag || !value.ciphertext) {
    throw new Error("Stored Gmail credential has an unsupported format");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function readSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is required to persist Gmail settings");
  await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is required to update Gmail settings");
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

function isAllowedInterval(value: unknown): value is GmailIngestionInterval {
  return typeof value === "number" && GMAIL_INGESTION_INTERVALS.includes(value as GmailIngestionInterval);
}

export async function getGmailIngestionSettings(): Promise<GmailIngestionSettings> {
  const raw = await readSetting(SCHEDULE_KEY);
  if (!raw) return DEFAULT_GMAIL_INGESTION_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<GmailIngestionSettings>;
    return {
      enabled: parsed.enabled === true,
      intervalMinutes: isAllowedInterval(parsed.intervalMinutes)
        ? parsed.intervalMinutes
        : DEFAULT_GMAIL_INGESTION_SETTINGS.intervalMinutes,
      lookbackHours: Number.isInteger(parsed.lookbackHours) && Number(parsed.lookbackHours) >= 1 && Number(parsed.lookbackHours) <= 168
        ? Number(parsed.lookbackHours)
        : DEFAULT_GMAIL_INGESTION_SETTINGS.lookbackHours,
      maxMessages: Number.isInteger(parsed.maxMessages) && Number(parsed.maxMessages) >= 1 && Number(parsed.maxMessages) <= 500
        ? Number(parsed.maxMessages)
        : DEFAULT_GMAIL_INGESTION_SETTINGS.maxMessages,
    };
  } catch {
    return DEFAULT_GMAIL_INGESTION_SETTINGS;
  }
}

export async function setGmailIngestionSettings(input: Pick<GmailIngestionSettings, "enabled" | "intervalMinutes">): Promise<GmailIngestionSettings> {
  if (!isAllowedInterval(input.intervalMinutes)) {
    throw new Error("Select a supported Gmail ingestion interval");
  }
  const next: GmailIngestionSettings = {
    ...DEFAULT_GMAIL_INGESTION_SETTINGS,
    enabled: input.enabled,
    intervalMinutes: input.intervalMinutes,
  };
  await writeSetting(SCHEDULE_KEY, JSON.stringify(next));
  return next;
}

export async function getGmailOauthClientCredentials(): Promise<GmailOauthClientCredentials | null> {
  const envClientId = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
  const envClientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret, source: "environment" };
  }

  const raw = await readSetting(OAUTH_CLIENT_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredOauthClient;
    return {
      clientId: stored.clientId,
      clientSecret: unseal(stored.clientSecret),
      source: "database",
    };
  } catch (error) {
    throw new Error(`Stored Gmail OAuth client could not be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveGmailOauthClientCredentials(clientId: string, clientSecret: string): Promise<void> {
  const normalizedId = clientId.trim();
  const normalizedSecret = clientSecret.trim();
  if (normalizedId.length < 10 || normalizedId.length > 512) throw new Error("Enter a valid Google OAuth client ID");
  if (normalizedSecret.length < 6 || normalizedSecret.length > 2_048) throw new Error("Enter a valid Google OAuth client secret");
  const stored: StoredOauthClient = {
    clientId: normalizedId,
    clientSecret: seal(normalizedSecret),
    updatedAt: new Date().toISOString(),
  };
  await writeSetting(OAUTH_CLIENT_KEY, JSON.stringify(stored));
}

export async function getGmailOauthConnection(): Promise<GmailOauthConnection | null> {
  const envRefreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN?.trim();
  if (envRefreshToken) {
    return {
      refreshToken: envRefreshToken,
      email: process.env.GMAIL_ACCOUNT_EMAIL?.trim() || "Connected through server environment",
      connectedAt: null,
      scopes: (process.env.GOOGLE_OAUTH_SCOPES ?? "https://www.googleapis.com/auth/gmail.readonly")
        .split(/[\s,]+/).filter(Boolean),
      source: "environment",
    };
  }

  const raw = await readSetting(OAUTH_CONNECTION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredOauthConnection;
    return {
      refreshToken: unseal(stored.refreshToken),
      email: stored.email,
      connectedAt: stored.connectedAt,
      scopes: Array.isArray(stored.scopes) && stored.scopes.length
        ? stored.scopes.filter((scope) => typeof scope === "string")
        : ["https://www.googleapis.com/auth/gmail.readonly"],
      source: "database",
    };
  } catch (error) {
    throw new Error(`Stored Gmail connection could not be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveGmailOauthConnection(refreshToken: string, email: string, scopes: string[] = []): Promise<void> {
  if (!refreshToken.trim()) throw new Error("Google did not return a Gmail refresh token");
  const stored: StoredOauthConnection = {
    refreshToken: seal(refreshToken.trim()),
    email: email.trim() || "Connected Gmail account",
    connectedAt: new Date().toISOString(),
    scopes: Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean))).sort(),
  };
  await writeSetting(OAUTH_CONNECTION_KEY, JSON.stringify(stored));
  await deleteSetting(DRIVE_CHANGE_TOKEN_KEY);
}

export async function clearGmailOauthConnection(): Promise<void> {
  await deleteSetting(OAUTH_CONNECTION_KEY);
  await deleteSetting(DRIVE_CHANGE_TOKEN_KEY);
}

export async function getGoogleDriveChangeToken(): Promise<string | null> {
  return await readSetting(DRIVE_CHANGE_TOKEN_KEY);
}

export async function setGoogleDriveChangeToken(token: string): Promise<void> {
  const normalized = token.trim();
  if (!normalized) throw new Error("Google Drive returned an empty change token");
  await writeSetting(DRIVE_CHANGE_TOKEN_KEY, normalized);
}

export async function clearGoogleDriveChangeToken(): Promise<void> {
  await deleteSetting(DRIVE_CHANGE_TOKEN_KEY);
}

export function buildGmailOauthCallbackUrl(requestOrigin: string): string {
  const explicit = process.env.GMAIL_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const origin = new URL(requestOrigin);
  return new URL(OAUTH_CALLBACK_PATH, origin).toString();
}

export async function savePendingGmailOauthState(state: string, redirectUri: string): Promise<void> {
  const pending: PendingOauthState = { state, redirectUri, createdAt: new Date().toISOString() };
  await writeSetting(OAUTH_PENDING_KEY, JSON.stringify(pending));
}

export async function consumePendingGmailOauthState(state: string): Promise<PendingOauthState> {
  const raw = await readSetting(OAUTH_PENDING_KEY);
  if (!raw) throw new Error("Gmail connection request expired or was already used");
  const pending = JSON.parse(raw) as PendingOauthState;
  const expected = Buffer.from(pending.state || "");
  const actual = Buffer.from(state || "");
  const matches = expected.length === actual.length && expected.length > 0 && timingSafeEqual(expected, actual);
  if (!matches) throw new Error("Gmail OAuth state validation failed");
  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60_000) {
    await deleteSetting(OAUTH_PENDING_KEY);
    throw new Error("Gmail connection request expired; start it again from Settings");
  }
  await deleteSetting(OAUTH_PENDING_KEY);
  return pending;
}

export function maskOauthClientId(clientId: string): string {
  if (clientId.length <= 14) return `${clientId.slice(0, 4)}...`;
  return `${clientId.slice(0, 8)}...${clientId.slice(-6)}`;
}
