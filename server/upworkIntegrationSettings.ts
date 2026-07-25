import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";

const CLIENT_KEY = "upworkOauthClient";
const CONNECTION_KEY = "upworkOauthConnection";
const PENDING_KEY = "upworkOauthPending";
const MONITORING_KEY = "upworkMonitoringSettings";
const CALLBACK_PATH = "/api/integrations/upwork/callback";

interface SealedValue {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface StoredClient {
  clientId: string;
  clientSecret: SealedValue;
  updatedAt: string;
}

interface StoredConnection {
  refreshToken: SealedValue;
  userId: string;
  userName: string;
  organizationId: string | null;
  connectedAt: string;
}

interface PendingOauthState {
  state: string;
  redirectUri: string;
  createdAt: string;
}

export interface UpworkOauthClientCredentials {
  clientId: string;
  clientSecret: string;
  source: "environment" | "database";
}

export interface UpworkOauthConnection {
  refreshToken: string;
  userId: string;
  userName: string;
  organizationId: string | null;
  connectedAt: string | null;
  source: "environment" | "database";
}

export interface UpworkMonitoringSettings {
  enabled: boolean;
}

function encryptionKey(): Buffer {
  const secret = process.env.UPWORK_CREDENTIALS_ENCRYPTION_KEY?.trim()
    || process.env.GMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim()
    || process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET or UPWORK_CREDENTIALS_ENCRYPTION_KEY is required to protect Upwork credentials");
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
    throw new Error("Stored Upwork credential has an unsupported format");
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
  if (!db) throw new Error("Database is required to persist Upwork settings");
  await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is required to update Upwork settings");
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

export async function getUpworkOauthClientCredentials(): Promise<UpworkOauthClientCredentials | null> {
  const envClientId = process.env.UPWORK_OAUTH_CLIENT_ID?.trim();
  const envClientSecret = process.env.UPWORK_OAUTH_CLIENT_SECRET?.trim();
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret, source: "environment" };
  }
  const raw = await readSetting(CLIENT_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredClient;
    return { clientId: stored.clientId, clientSecret: unseal(stored.clientSecret), source: "database" };
  } catch (error) {
    throw new Error(`Stored Upwork OAuth client could not be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveUpworkOauthClientCredentials(clientId: string, clientSecret: string): Promise<void> {
  const normalizedId = clientId.trim();
  const normalizedSecret = clientSecret.trim();
  if (normalizedId.length < 8 || normalizedId.length > 512) throw new Error("Enter a valid Upwork OAuth client ID");
  if (normalizedSecret.length < 6 || normalizedSecret.length > 2_048) throw new Error("Enter a valid Upwork OAuth client secret");
  await writeSetting(CLIENT_KEY, JSON.stringify({
    clientId: normalizedId,
    clientSecret: seal(normalizedSecret),
    updatedAt: new Date().toISOString(),
  } satisfies StoredClient));
}

export async function getUpworkOauthConnection(): Promise<UpworkOauthConnection | null> {
  const envRefreshToken = process.env.UPWORK_OAUTH_REFRESH_TOKEN?.trim();
  const envUserId = process.env.UPWORK_ACCOUNT_USER_ID?.trim();
  if (envRefreshToken && envUserId) {
    return {
      refreshToken: envRefreshToken,
      userId: envUserId,
      userName: process.env.UPWORK_ACCOUNT_NAME?.trim() || "Connected Upwork account",
      organizationId: process.env.UPWORK_ORG_ID?.trim() || null,
      connectedAt: null,
      source: "environment",
    };
  }
  const raw = await readSetting(CONNECTION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredConnection;
    return {
      refreshToken: unseal(stored.refreshToken),
      userId: stored.userId,
      userName: stored.userName,
      organizationId: stored.organizationId || null,
      connectedAt: stored.connectedAt,
      source: "database",
    };
  } catch (error) {
    throw new Error(`Stored Upwork connection could not be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveUpworkOauthConnection(input: {
  refreshToken: string;
  userId: string;
  userName: string;
  organizationId?: string | null;
}): Promise<void> {
  if (!input.refreshToken.trim()) throw new Error("Upwork did not return a refresh token");
  if (!input.userId.trim()) throw new Error("Upwork account identity could not be verified");
  await writeSetting(CONNECTION_KEY, JSON.stringify({
    refreshToken: seal(input.refreshToken.trim()),
    userId: input.userId.trim(),
    userName: input.userName.trim() || "Connected Upwork account",
    organizationId: input.organizationId?.trim() || null,
    connectedAt: new Date().toISOString(),
  } satisfies StoredConnection));
}

export async function clearUpworkOauthConnection(): Promise<void> {
  await deleteSetting(CONNECTION_KEY);
}

export async function getUpworkMonitoringSettings(): Promise<UpworkMonitoringSettings> {
  const raw = await readSetting(MONITORING_KEY);
  if (!raw) return { enabled: false };
  try {
    return { enabled: (JSON.parse(raw) as Partial<UpworkMonitoringSettings>).enabled === true };
  } catch {
    return { enabled: false };
  }
}

export async function setUpworkMonitoringSettings(enabled: boolean): Promise<UpworkMonitoringSettings> {
  const next = { enabled };
  await writeSetting(MONITORING_KEY, JSON.stringify(next));
  return next;
}

export function buildUpworkOauthCallbackUrl(requestOrigin: string): string {
  const explicit = process.env.UPWORK_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL(CALLBACK_PATH, new URL(requestOrigin)).toString();
}

export async function savePendingUpworkOauthState(state: string, redirectUri: string): Promise<void> {
  await writeSetting(PENDING_KEY, JSON.stringify({ state, redirectUri, createdAt: new Date().toISOString() } satisfies PendingOauthState));
}

export async function consumePendingUpworkOauthState(state: string): Promise<PendingOauthState> {
  const raw = await readSetting(PENDING_KEY);
  if (!raw) throw new Error("Upwork connection request expired or was already used");
  const pending = JSON.parse(raw) as PendingOauthState;
  const expected = Buffer.from(pending.state || "");
  const actual = Buffer.from(state || "");
  const matches = expected.length === actual.length && expected.length > 0 && timingSafeEqual(expected, actual);
  if (!matches) throw new Error("Upwork OAuth state validation failed");
  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60_000) {
    await deleteSetting(PENDING_KEY);
    throw new Error("Upwork connection request expired; start it again from Settings");
  }
  await deleteSetting(PENDING_KEY);
  return pending;
}

export function maskUpworkClientId(clientId: string): string {
  if (clientId.length <= 12) return `${clientId.slice(0, 4)}...`;
  return `${clientId.slice(0, 7)}...${clientId.slice(-5)}`;
}

export async function getUpworkIntegrationStatus(requestOrigin: string) {
  const [client, connection, settings] = await Promise.all([
    getUpworkOauthClientCredentials(),
    getUpworkOauthConnection(),
    getUpworkMonitoringSettings(),
  ]);
  return {
    callbackUrl: buildUpworkOauthCallbackUrl(requestOrigin),
    oauthClientConfigured: Boolean(client),
    oauthClientPreview: client ? maskUpworkClientId(client.clientId) : null,
    oauthClientManagedByEnvironment: client?.source === "environment",
    connected: Boolean(connection),
    connectionManagedByEnvironment: connection?.source === "environment",
    accountName: connection?.userName ?? null,
    accountUserId: connection?.userId ?? null,
    organizationId: connection?.organizationId ?? null,
    connectedAt: connection?.connectedAt ?? null,
    settings,
    canEnable: Boolean(client && connection),
    provider: "Upwork OAuth 2.0 + GraphQL",
    requiredPermissions: ["Messaging - Read-Only Access", "Common Entities - Read-Only Access"],
  };
}

export async function disconnectUpwork(): Promise<void> {
  const connection = await getUpworkOauthConnection();
  if (connection?.source === "environment") {
    throw new Error("Upwork connection is managed by the server environment");
  }
  await clearUpworkOauthConnection();
  await setUpworkMonitoringSettings(false);
}
