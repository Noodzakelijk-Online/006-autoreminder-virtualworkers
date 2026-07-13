import { GOOGLE_DRIVE_READONLY_SCOPE, refreshGoogleAccessToken } from "./gmailOauth";
import {
  clearGoogleDriveChangeToken,
  getGmailOauthConnection,
  getGoogleDriveChangeToken,
  setGoogleDriveChangeToken,
} from "./gmailIngestionSettings";
import { runTrackedJob, type JobTrigger } from "./scheduledJobsDb";
import {
  getWorkspaceEvidenceContentBackfillCandidates,
  setWorkspaceEvidenceActive,
  upsertWorkspaceEvidence,
} from "./workspaceEvidenceDb";

const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
const INITIAL_FILE_LIMIT = 2_000;
const CONTENT_FILE_LIMIT = 100;
const CONTENT_CHARACTER_LIMIT = 20_000;

export type GoogleDriveIngestionResult = {
  mode: "initial" | "changes" | "skipped";
  scanned: number;
  indexed: number;
  contentExtracted: number;
  removed: number;
  rejected: number;
  skippedReason: string | null;
};

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  webViewLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  trashed?: boolean;
  starred?: boolean;
  size?: string;
  md5Checksum?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

type DriveFileList = { nextPageToken?: string; files?: GoogleDriveFile[] };
type DriveChange = { fileId: string; removed?: boolean; file?: GoogleDriveFile };
type DriveChangeList = { nextPageToken?: string; newStartPageToken?: string; changes?: DriveChange[] };

let activeRun: Promise<GoogleDriveIngestionResult> | null = null;

export function hasGoogleDriveReadonlyScope(scopes: string[]) {
  return scopes.includes(GOOGLE_DRIVE_READONLY_SCOPE)
    || scopes.includes("https://www.googleapis.com/auth/drive");
}

async function driveFetch(accessToken: string, path: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${DRIVE_API_ROOT}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Google Drive API ${response.status}: ${detail || response.statusText}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Google Drive API request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function driveJson<T>(accessToken: string, path: string): Promise<T> {
  return await (await driveFetch(accessToken, path)).json() as T;
}

function exportMimeType(mimeType: string): string | null {
  if (mimeType === "application/vnd.google-apps.document") return "text/plain";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "text/csv";
  if (mimeType === "application/vnd.google-apps.presentation") return "text/plain";
  return null;
}

function isDownloadableText(file: GoogleDriveFile) {
  if (file.mimeType.startsWith("text/")) return true;
  return ["application/json", "application/xml", "application/javascript", "application/rtf"].includes(file.mimeType);
}

export function isDriveTextExtractable(file: Pick<GoogleDriveFile, "mimeType" | "size">) {
  return Boolean(exportMimeType(file.mimeType))
    || (isDownloadableText(file as GoogleDriveFile) && Number(file.size ?? 0) <= 5_000_000);
}

async function extractDriveText(accessToken: string, file: GoogleDriveFile): Promise<string | null> {
  const exportType = exportMimeType(file.mimeType);
  let response: Response;
  if (exportType) {
    response = await driveFetch(accessToken, `/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportType)}`);
  } else if (isDownloadableText(file) && Number(file.size ?? 0) <= 5_000_000) {
    response = await driveFetch(accessToken, `/files/${encodeURIComponent(file.id)}?alt=media`);
  } else {
    return null;
  }
  const text = (await response.text()).replace(/\0/g, "").trim();
  if (!text) return null;
  return text.length <= CONTENT_CHARACTER_LIMIT ? text : `${text.slice(0, CONTENT_CHARACTER_LIMIT - 3).trimEnd()}...`;
}

function fileSummary(file: GoogleDriveFile) {
  const owners = (file.owners ?? []).map((owner) => owner.displayName || owner.emailAddress).filter(Boolean).join(", ");
  return [file.description, owners ? `Owner: ${owners}` : null].filter(Boolean).join("\n") || null;
}

async function persistDriveFile(accessToken: string, file: GoogleDriveFile, extractContent: boolean) {
  if (file.trashed) {
    await setWorkspaceEvidenceActive("google_drive", file.id, false);
    return { indexed: 0, contentExtracted: 0, removed: 1 };
  }
  let content: string | null = null;
  if (extractContent) {
    try {
      content = await extractDriveText(accessToken, file);
    } catch (error) {
      console.warn(`[DriveIngestion] Content extraction skipped for ${file.id}:`, error instanceof Error ? error.message : String(error));
    }
  }
  await upsertWorkspaceEvidence({
    source: "google_drive",
    sourceId: file.id,
    sourceContainerId: file.shortcutDetails?.targetId ?? null,
    kind: file.mimeType.startsWith("application/vnd.google-apps.") ? file.mimeType.split(".").pop() || "google_file" : "file",
    title: file.name || "Untitled Drive file",
    summary: fileSummary(file),
    content,
    sourceUrl: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
    mimeType: file.mimeType,
    modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
    observedAt: new Date(),
    metadataJson: JSON.stringify({
      createdTime: file.createdTime ?? null,
      starred: file.starred ?? false,
      size: file.size ?? null,
      md5Checksum: file.md5Checksum ?? null,
      owners: file.owners ?? [],
      shortcutDetails: file.shortcutDetails ?? null,
    }),
    active: true,
  });
  return { indexed: 1, contentExtracted: content ? 1 : 0, removed: 0 };
}

async function fetchDriveFile(accessToken: string, fileId: string) {
  const fields = "id,name,mimeType,description,webViewLink,modifiedTime,createdTime,trashed,starred,size,md5Checksum,owners(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)";
  return driveJson<GoogleDriveFile>(accessToken, `/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`);
}

async function backfillDriveText(accessToken: string) {
  const candidates = await getWorkspaceEvidenceContentBackfillCandidates("google_drive", INITIAL_FILE_LIMIT);
  const extractable = candidates
    .filter((candidate) => {
      if (!candidate.mimeType) return false;
      let size: string | undefined;
      try {
        const metadata = JSON.parse(candidate.metadataJson ?? "{}") as { size?: string | null };
        size = metadata.size ?? undefined;
      } catch {
        size = undefined;
      }
      return isDriveTextExtractable({ mimeType: candidate.mimeType, size });
    })
    .slice(0, CONTENT_FILE_LIMIT);
  let indexed = 0;
  let contentExtracted = 0;
  let rejected = 0;
  for (const candidate of extractable) {
    try {
      const file = await fetchDriveFile(accessToken, candidate.sourceId);
      const persisted = await persistDriveFile(accessToken, file, true);
      indexed += persisted.indexed;
      contentExtracted += persisted.contentExtracted;
    } catch (error) {
      rejected++;
      console.warn(`[DriveIngestion] Text backfill skipped for ${candidate.sourceId}:`, error instanceof Error ? error.message : String(error));
    }
  }
  return { indexed, contentExtracted, rejected };
}

async function initialDriveScan(accessToken: string): Promise<GoogleDriveIngestionResult> {
  const start = await driveJson<{ startPageToken: string }>(accessToken, "/changes/startPageToken?supportsAllDrives=true");
  const files: GoogleDriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      q: "trashed = false",
      pageSize: String(Math.min(1_000, INITIAL_FILE_LIMIT - files.length)),
      orderBy: "modifiedTime desc",
      spaces: "drive",
      fields: "nextPageToken,files(id,name,mimeType,description,webViewLink,modifiedTime,createdTime,trashed,starred,size,md5Checksum,owners(displayName,emailAddress),shortcutDetails(targetId,targetMimeType))",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await driveJson<DriveFileList>(accessToken, `/files?${query.toString()}`);
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && files.length < INITIAL_FILE_LIMIT);

  const result: GoogleDriveIngestionResult = {
    mode: "initial", scanned: files.length, indexed: 0, contentExtracted: 0, removed: 0, rejected: 0, skippedReason: null,
  };
  let contentAttempts = 0;
  for (let index = 0; index < files.length; index++) {
    try {
      const canExtract = isDriveTextExtractable(files[index]) && contentAttempts++ < CONTENT_FILE_LIMIT;
      const persisted = await persistDriveFile(accessToken, files[index], canExtract);
      result.indexed += persisted.indexed;
      result.contentExtracted += persisted.contentExtracted;
      result.removed += persisted.removed;
    } catch (error) {
      result.rejected++;
      console.error(`[DriveIngestion] Failed to index ${files[index].id}:`, error instanceof Error ? error.message : String(error));
    }
  }
  await setGoogleDriveChangeToken(start.startPageToken);
  return result;
}

async function changedDriveScan(accessToken: string, initialToken: string): Promise<GoogleDriveIngestionResult> {
  const changes: DriveChange[] = [];
  let pageToken: string | undefined = initialToken;
  let nextCursor: string | undefined;
  do {
    const query: URLSearchParams = new URLSearchParams({
      pageToken: pageToken ?? initialToken,
      pageSize: "500",
      spaces: "drive",
      includeRemoved: "true",
      supportsAllDrives: "true",
      fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,description,webViewLink,modifiedTime,createdTime,trashed,starred,size,md5Checksum,owners(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)))",
    });
    const page: DriveChangeList = await driveJson<DriveChangeList>(accessToken, `/changes?${query.toString()}`);
    changes.push(...(page.changes ?? []));
    pageToken = page.nextPageToken;
    nextCursor = page.newStartPageToken ?? nextCursor;
  } while (pageToken);

  const result: GoogleDriveIngestionResult = {
    mode: "changes", scanned: changes.length, indexed: 0, contentExtracted: 0, removed: 0, rejected: 0, skippedReason: null,
  };
  let contentAttempts = 0;
  for (const change of changes) {
    try {
      if (change.removed || !change.file || change.file.trashed) {
        await setWorkspaceEvidenceActive("google_drive", change.fileId, false);
        result.removed++;
        continue;
      }
      const canExtract = contentAttempts++ < CONTENT_FILE_LIMIT;
      const persisted = await persistDriveFile(accessToken, change.file, canExtract);
      result.indexed += persisted.indexed;
      result.contentExtracted += persisted.contentExtracted;
      result.removed += persisted.removed;
    } catch (error) {
      result.rejected++;
      console.error(`[DriveIngestion] Failed to apply change ${change.fileId}:`, error instanceof Error ? error.message : String(error));
    }
  }
  if (nextCursor) await setGoogleDriveChangeToken(nextCursor);
  return result;
}

async function executeGoogleDriveIngestion(): Promise<GoogleDriveIngestionResult> {
  const connection = await getGmailOauthConnection();
  if (!connection) return { mode: "skipped", scanned: 0, indexed: 0, contentExtracted: 0, removed: 0, rejected: 0, skippedReason: "Google Workspace is not connected" };
  if (!hasGoogleDriveReadonlyScope(connection.scopes)) {
    return { mode: "skipped", scanned: 0, indexed: 0, contentExtracted: 0, removed: 0, rejected: 0, skippedReason: "Reconnect Google Workspace to grant Drive read-only access" };
  }
  const { accessToken } = await refreshGoogleAccessToken();
  const cursor = await getGoogleDriveChangeToken();
  if (!cursor) return await initialDriveScan(accessToken);
  try {
    const result = await changedDriveScan(accessToken, cursor);
    const backfill = await backfillDriveText(accessToken);
    result.indexed += backfill.indexed;
    result.contentExtracted += backfill.contentExtracted;
    result.rejected += backfill.rejected;
    return result;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("Google Drive API 410:")) throw error;
    await clearGoogleDriveChangeToken();
    return await initialDriveScan(accessToken);
  }
}

export function runGoogleDriveIngestion(trigger: JobTrigger = "manual") {
  if (activeRun) return activeRun;
  activeRun = runTrackedJob({
    jobKey: "google_drive_ingestion",
    trigger,
    run: executeGoogleDriveIngestion,
    summarize: (result) => ({
      recordsProcessed: result.indexed,
      detail: result.skippedReason
        ?? `${result.mode}: ${result.scanned} scanned, ${result.indexed} indexed, ${result.contentExtracted} text-extracted, ${result.removed} removed, ${result.rejected} rejected`,
    }),
  }).finally(() => {
    activeRun = null;
  });
  return activeRun;
}
