/**
 * Upwork Reply Monitor
 *
 * Uses the existing Chromium browser session (remote debugging port 9222) to
 * call Upwork's internal REST API via the authenticated page context.
 * No token management needed — the browser session handles auth automatically.
 *
 * Detects:
 *  1. Threads where the last message is from a freelancer (not the account owner)
 *     and Joyce has not replied within 12 hours → "pending" → "overdue"
 *  2. Replies sent from the owner account that are vague/deferral messages
 *     (e.g. "I'll get back to you tonight") → flagged for review
 *  3. Owner messages missing ~ Angel or ~ Joyce signature → unsigned review flag
 *
 * The Upwork account owner is Noodzakelijk Online (Angel Huang).
 * Joyce replies ON BEHALF of the owner, so messages sent as the owner are Joyce's replies.
 */

import { notifyOwner } from "./_core/notification";
import { upsertCommunicationEvidence } from "./communicationEvidenceDb";
import { upsertWorkspaceEvidence } from "./workspaceEvidenceDb";
import { isVagueReply, hasValidSignature } from "./replyMonitor";
import {
  upsertUpworkThread,
  upsertUpworkVagueFlag,
  insertUnsignedFlag,
} from "./replyMonitorDb";
import {
  fetchUpworkRooms as scraperFetchRooms,
  OWNER_USER_ID as SCRAPER_OWNER_USER_ID,
  type UpworkRoom as ScraperRoom,
  type UpworkStory as ScraperStory,
} from "./upworkScraper";

// The account owner's user ID — messages from this ID are Joyce's replies
const OWNER_USER_ID = process.env.UPWORK_CLIENT_USER_ID || SCRAPER_OWNER_USER_ID;
const UPWORK_ORG_ID = process.env.UPWORK_ORG_ID || "1681372983093714945";
const REPLY_DEADLINE_MS = 12 * 60 * 60 * 1000; // 12 hours

type UpworkRoom = ScraperRoom;
type UpworkStory = ScraperStory;

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

export async function analyseUpworkRoom(room: UpworkRoom): Promise<UpworkThreadAnalysis> {
  const roomUrl = `https://www.upwork.com/ab/messages/rooms/${room.roomId}?companyReference=${UPWORK_ORG_ID}`;
  // Use stories already fetched by the scraper (guard against undefined for tests/edge cases)
  const stories = room.stories ?? [];

  // Filter out empty messages
  const humanStories = stories.filter((s) => s.message?.trim());

  if (humanStories.length === 0) {
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      topic: "Direct Message",
      roomUrl,
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
    const isOwner = story.userId === OWNER_USER_ID;

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

    // Stop once we have both
    if (lastNonOwnerMsg && lastOwnerReply) break;
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
    roomUrl,
    lastNonOwnerMsgAt: lastNonOwnerAt,
    lastNonOwnerAuthor: room.roomName, // room name = freelancer name on Upwork
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
  tokenExpired: boolean;
}> {
  let rooms: UpworkRoom[];
  try {
    rooms = await scraperFetchRooms();
  } catch (err: any) {
    console.error("[upworkMonitor] Scraper failed:", err?.message);
    await notifyOwner({
      title: "⚠️ Upwork Scraper Failed",
      content: `The Upwork reply monitor scraper encountered an error: ${err?.message}. Please ensure the browser is open and logged into Upwork.`,
    });
    return { scanned: 0, pending: 0, overdue: 0, vagueFlags: 0, tokenExpired: false };
  }

  let pending = 0;
  let overdue = 0;
  let vagueFlags = 0;

  for (const room of rooms) {
    try {
      const analysis = await analyseUpworkRoom(room);

      // Upsert thread record
      await upsertUpworkThread({
        source: "upwork",
        cardId: analysis.roomId,
        cardName: analysis.roomName,
        cardUrl: analysis.roomUrl,
        boardName: "Upwork Messages",
        listName: analysis.topic || "Direct Message",
        lastNonJoyceMsgAt: analysis.lastNonOwnerMsgAt
          ? new Date(analysis.lastNonOwnerMsgAt)
          : null,
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
      });
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
        await upsertCommunicationEvidence({
          channel: "upwork",
          externalId: `${analysis.roomId}:${analysis.lastNonOwnerMsgAt}`,
          threadId: analysis.roomId,
          direction: "inbound",
          sender: analysis.lastNonOwnerAuthor || analysis.roomName,
          subject: analysis.topic || analysis.roomName,
          summary: analysis.lastNonOwnerText,
          occurredAt: new Date(analysis.lastNonOwnerMsgAt),
          responseRequired: analysis.needsReply,
          respondedAt: analysis.lastOwnerReplyAt ? new Date(analysis.lastOwnerReplyAt) : null,
          evidenceItemId,
          metadata: { roomUrl: analysis.roomUrl, overdue: analysis.isOverdue },
        });
      }

      if (analysis.needsReply) {
        if (analysis.isOverdue) overdue++;
        else pending++;
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
    } catch (err: any) {
      console.error(`[upworkMonitor] Error processing room ${room.roomId}:`, err?.message);
    }
  }

  console.log(
    `[upworkMonitor] Scan complete: ${rooms.length} rooms, ${pending} pending, ${overdue} overdue, ${vagueFlags} vague flags`
  );

  return {
    scanned: rooms.length,
    pending,
    overdue,
    vagueFlags,
    tokenExpired: false,
  };
}
