/**
 * Upwork Reply Monitor
 *
 * Reads conversations through Upwork's approved read-only OAuth and GraphQL
 * APIs. The monitor never sends, archives, or otherwise mutates Upwork data.
 *
 * Detects:
 *  1. Threads where the last message is from a freelancer (not the account owner)
 *     and Joyce has not replied within 12 hours → "pending" → "overdue"
 *  2. Replies sent from the owner account that are vague/deferral messages
 *     (e.g. "I'll get back to you tonight") → flagged for review
 *  3. Owner messages missing ~ Angel or ~ Joyce signature → unsigned review flag
 *
 * Joyce replies on behalf of the connected account, so messages authored by
 * that connected account are treated as Joyce's replies.
 */

import { upsertWorkspaceEvidence } from "./workspaceEvidenceDb";
import { isVagueReply, hasValidSignature } from "./replyMonitor";
import {
  upsertUpworkThread,
  upsertUpworkVagueFlag,
  insertUnsignedFlag,
} from "./replyMonitorDb";
import { fetchUpworkMessageSnapshot, type UpworkRoom, type UpworkStory } from "./upworkApi";
import { getUpworkMonitoringSettings } from "./upworkIntegrationSettings";

// The account owner's user ID — messages from this ID are Joyce's replies
const FALLBACK_OWNER_USER_ID = process.env.UPWORK_ACCOUNT_USER_ID || "1681372983093714944";
const REPLY_DEADLINE_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Analyse a single room's story thread.
 * Returns the thread analysis result.
 */
export interface UpworkThreadAnalysis {
  roomId: string;
  roomName: string;
  topic: string;
  roomUrl: string;
  lastNonOwnerMsgAt: number | null;
  lastNonOwnerAuthor: string;
  lastNonOwnerText: string;
  lastOwnerReplyAt: number | null;
  vagueReplies: Array<{ storyId: string; text: string; createdAt: number }>;
  unsignedMessages: Array<{ storyId: string; text: string; createdAt: number }>;
  needsReply: boolean;
  isOverdue: boolean;
}

export async function analyseUpworkRoom(
  room: UpworkRoom,
  ownerUserId = FALLBACK_OWNER_USER_ID,
  organizationId?: string | null,
): Promise<UpworkThreadAnalysis> {
  const roomUrl = new URL(`https://www.upwork.com/ab/messages/rooms/${encodeURIComponent(room.roomId)}`);
  if (organizationId) roomUrl.searchParams.set("companyReference", organizationId);
  // Use stories already fetched by the scraper (guard against undefined for tests/edge cases)
  const stories = room.stories ?? [];

  // Filter out empty messages
  const humanStories = stories.filter((s) => s.message?.trim());

  if (humanStories.length === 0) {
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      topic: "Direct Message",
      roomUrl: roomUrl.toString(),
      lastNonOwnerMsgAt: null,
      lastNonOwnerAuthor: "",
      lastNonOwnerText: "",
      lastOwnerReplyAt: null,
      vagueReplies: [],
      unsignedMessages: [],
      needsReply: false,
      isOverdue: false,
    };
  }

  // Find the most recent non-owner message
  let lastNonOwnerMsg: UpworkStory | null = null;
  let lastOwnerReply: UpworkStory | null = null;
  const vagueReplies: Array<{ storyId: string; text: string; createdAt: number }> = [];
  const unsignedMessages: Array<{ storyId: string; text: string; createdAt: number }> = [];

  // Process stories from newest to oldest
  const sorted = [...humanStories].sort((a, b) => b.createdAt - a.createdAt);

  for (const story of sorted) {
    const isOwner = story.userId === ownerUserId;

    if (isOwner) {
      if (!lastOwnerReply) lastOwnerReply = story;
      // Check for vague replies from owner (Joyce)
      if (isVagueReply(story.message)) {
        vagueReplies.push({
          storyId: story.storyId,
          text: story.message.slice(0, 300),
          createdAt: story.createdAt,
        });
      }
      // Check for missing signature
      if (!hasValidSignature(story.message)) {
        unsignedMessages.push({
          storyId: story.storyId,
          text: story.message.slice(0, 300),
          createdAt: story.createdAt,
        });
      }
    } else {
      if (!lastNonOwnerMsg) lastNonOwnerMsg = story;
    }

  }

  const now = Date.now();
  const lastNonOwnerAt = lastNonOwnerMsg?.createdAt ?? null;
  const lastOwnerAt = lastOwnerReply?.createdAt ?? null;

  // Needs reply if last message is from non-owner (or owner replied before the non-owner's last message)
  const needsReply =
    lastNonOwnerAt !== null &&
    (lastOwnerAt === null || lastOwnerAt < lastNonOwnerAt);

  const isOverdue =
    needsReply &&
    lastNonOwnerAt !== null &&
    now - lastNonOwnerAt > REPLY_DEADLINE_MS;

  return {
    roomId: room.roomId,
    roomName: room.roomName,
    topic: "Direct Message",
    roomUrl: roomUrl.toString(),
    lastNonOwnerMsgAt: lastNonOwnerAt,
    lastNonOwnerAuthor: lastNonOwnerMsg?.userName || room.roomName,
    lastNonOwnerText: lastNonOwnerMsg?.message?.slice(0, 200) ?? "",
    lastOwnerReplyAt: lastOwnerAt,
    vagueReplies,
    unsignedMessages,
    needsReply,
    isOverdue,
  };
}

/**
 * Main scan: fetch all rooms, analyse each, upsert DB records.
 */
export async function runUpworkReplyMonitorScan(): Promise<{
  scanned: number;
  pending: number;
  overdue: number;
  vagueFlags: number;
}> {
  const snapshot = await fetchUpworkMessageSnapshot();
  const rooms = snapshot.rooms;

  let pending = 0;
  let overdue = 0;
  let vagueFlags = 0;
  const processingErrors: string[] = [];

  for (const room of rooms) {
    try {
      const analysis = await analyseUpworkRoom(room, snapshot.ownerUserId, snapshot.organizationId);

      if (analysis.lastNonOwnerMsgAt) {
        const evidenceItemId = await upsertWorkspaceEvidence({
          source: "communication",
          sourceId: `upwork:${analysis.roomId}:${analysis.lastNonOwnerMsgAt}`,
          sourceContainerId: analysis.roomId,
          kind: "upwork_message",
          title: `${analysis.roomName}: ${analysis.topic}`,
          summary: analysis.lastNonOwnerText,
          content: analysis.lastNonOwnerText,
          sourceUrl: analysis.roomUrl,
          mimeType: "application/vnd.upwork.message+json",
          modifiedAt: new Date(analysis.lastNonOwnerMsgAt),
          observedAt: new Date(),
          metadataJson: JSON.stringify({
            channel: "upwork",
            responseRequired: analysis.needsReply,
            overdue: analysis.isOverdue,
          }),
          active: true,
        });

        await upsertUpworkThread({
          source: "upwork",
          cardId: analysis.roomId,
          cardName: analysis.roomName,
          cardUrl: analysis.roomUrl,
          boardName: "Upwork Messages",
          listName: analysis.topic || "Direct Message",
          lastNonJoyceMsgAt: new Date(analysis.lastNonOwnerMsgAt),
          lastNonJoyceAuthor: analysis.lastNonOwnerAuthor,
          lastNonJoyceText: analysis.lastNonOwnerText,
          lastJoyceReplyAt: analysis.lastOwnerReplyAt
            ? new Date(analysis.lastOwnerReplyAt)
            : null,
          status: analysis.isOverdue
            ? "overdue"
            : analysis.needsReply
            ? "pending"
            : "ok",
          demerited: false,
          evidenceItemId,
        });

        if (analysis.needsReply) {
          if (analysis.isOverdue) overdue++;
          else pending++;
        }
      }

      // Upsert vague reply flags
      for (const vague of analysis.vagueReplies) {
        await upsertUpworkVagueFlag({
          source: "upwork",
          cardId: analysis.roomId,
          cardName: analysis.roomName,
          cardUrl: analysis.roomUrl,
          actionId: vague.storyId,
          messageText: vague.text,
          flaggedAt: new Date(vague.createdAt),
        });
        vagueFlags++;
      }

      // Upsert unsigned message flags
      for (const unsigned of analysis.unsignedMessages) {
        await insertUnsignedFlag({
          source: "upwork",
          cardId: analysis.roomId,
          cardName: analysis.roomName,
          cardUrl: analysis.roomUrl,
          actionId: unsigned.storyId,
          messageText: unsigned.text,
          flaggedAt: new Date(unsigned.createdAt),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      processingErrors.push(`${room.roomId}: ${message}`);
      console.error(`[upworkMonitor] Error processing room ${room.roomId}:`, message);
    }
  }

  if (processingErrors.length > 0) {
    throw new Error(`Upwork scan failed for ${processingErrors.length} of ${rooms.length} rooms: ${processingErrors.slice(0, 3).join("; ")}`);
  }

  console.log(
    `[upworkMonitor] Scan complete: ${rooms.length} rooms, ${pending} pending, ${overdue} overdue, ${vagueFlags} vague flags`
  );

  return {
    scanned: rooms.length,
    pending,
    overdue,
    vagueFlags,
  };
}

export async function isUpworkMonitorEnabled() {
  return (await getUpworkMonitoringSettings()).enabled;
}
