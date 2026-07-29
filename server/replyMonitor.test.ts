/**
 * Tests for the Reply Monitor module.
 *
 * Tests cover:
 * - isVagueReply: vague/deferral pattern detection
 * - isJoyceComment: Joyce authorship detection (direct + board-owner proxy)
 * - analyseCardThread: full thread analysis (needsReply, isOverdue, vagueReplies)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isVagueReply,
  isJoyceComment,
  analyseCardThread,
  REPLY_DEADLINE_MS,
  type TrelloCommentAction,
} from "./replyMonitor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeComment(
  overrides: Partial<TrelloCommentAction> & {
    username?: string;
    fullName?: string;
    memberId?: string;
    text?: string;
    date?: string;
  }
): TrelloCommentAction {
  return {
    id: overrides.id ?? "action_" + Math.random().toString(36).slice(2),
    type: "commentCard",
    date: overrides.date ?? new Date().toISOString(),
    data: { text: overrides.text ?? "Some comment" },
    memberCreator: {
      id: overrides.memberId ?? "some_member_id",
      fullName: overrides.fullName ?? "Test User",
      username: overrides.username ?? "testuser",
    },
  };
}

function makeJoyceComment(text = "Done, updating now.", date?: string): TrelloCommentAction {
  return makeComment({ username: "joyjemimajj1", fullName: "Joyce", text, date });
}

function makeOwnerProxyComment(text: string, date?: string): TrelloCommentAction {
  // Board owner posting on behalf of Joyce (dashboard inline comment box)
  return makeComment({
    username: "noodzakelijkonline",
    fullName: "Board Owner",
    text: `@joyjemimajj1 ${text}`,
    date,
  });
}

function makeOtherComment(text = "Can you update this?", date?: string): TrelloCommentAction {
  return makeComment({ username: "client_user", fullName: "Client", text, date });
}

function makeCard(id = "card_1") {
  return {
    id,
    name: "Test Card",
    url: `https://trello.com/c/${id}`,
    idList: "list_1",
    list: { id: "list_1", name: "Doing" },
    boardName: "Test Board",
    dateLastActivity: new Date().toISOString(),
  };
}

// ─── isVagueReply ─────────────────────────────────────────────────────────────

describe("isVagueReply", () => {
  it("flags 'I'll get back to you tonight'", () => {
    expect(isVagueReply("I'll get back to you tonight")).toBe(true);
  });

  it("flags 'I will get back to you today'", () => {
    expect(isVagueReply("I will get back to you today")).toBe(true);
  });

  it("flags 'Will get back to you soon'", () => {
    expect(isVagueReply("Will get back to you soon")).toBe(true);
  });

  it("flags 'Let me check on this'", () => {
    expect(isVagueReply("Let me check on this")).toBe(true);
  });

  it("flags 'I'll check on this later'", () => {
    expect(isVagueReply("I'll check on this later")).toBe(true);
  });

  it("flags 'I'll follow up today'", () => {
    expect(isVagueReply("I'll follow up today")).toBe(true);
  });

  it("flags 'Give me a moment'", () => {
    expect(isVagueReply("Give me a moment")).toBe(true);
  });

  it("flags standalone 'tonight' in short message", () => {
    expect(isVagueReply("tonight")).toBe(true);
  });

  it("flags 'I need to check on this'", () => {
    expect(isVagueReply("I need to check on this")).toBe(true);
  });

  it("does NOT flag a substantive reply", () => {
    expect(
      isVagueReply(
        "I have updated the card with the latest invoice details. The client has been notified and the payment is expected by Friday."
      )
    ).toBe(false);
  });

  it("does NOT flag 'I have sent the email'", () => {
    expect(isVagueReply("I have sent the email to the client.")).toBe(false);
  });

  it("does NOT flag 'Done'", () => {
    expect(isVagueReply("Done")).toBe(false);
  });

  it("does NOT flag 'Updated the card'", () => {
    expect(isVagueReply("Updated the card with the latest status.")).toBe(false);
  });

  it("does NOT flag a long message mentioning 'tonight' in context", () => {
    // Long message (>120 chars) with 'tonight' but substantive — should NOT be flagged
    // because the standalone-word pattern is excluded for long messages
    const longMsg =
      "I have reviewed the contract and sent the revised version to the client. They confirmed receipt and said they will sign tonight after their meeting.";
    expect(isVagueReply(longMsg)).toBe(false);
  });

  it("flags a long message with strong deferral pattern", () => {
    const longMsg =
      "I understand the urgency here and I want to make sure I address everything properly. I will get back to you today with a full breakdown of the situation and next steps.";
    expect(isVagueReply(longMsg)).toBe(true);
  });
});

// ─── isJoyceComment ───────────────────────────────────────────────────────────

describe("isJoyceComment", () => {
  it("recognises Joyce by username 'joyjemimajj1'", () => {
    const action = makeJoyceComment("Hello");
    expect(isJoyceComment(action)).toBe(true);
  });

  it("recognises Joyce by member ID", () => {
    const action = makeComment({ memberId: "664ed797b37eb4605ed64bc1", text: "Hello" });
    expect(isJoyceComment(action)).toBe(true);
  });

  it("recognises board-owner proxy comment starting with @joyjemimajj1", () => {
    const action = makeOwnerProxyComment("Updated the card.");
    expect(isJoyceComment(action)).toBe(true);
  });

  it("does NOT recognise board-owner comment without @joyjemimajj1 prefix", () => {
    const action = makeComment({
      username: "noodzakelijkonline",
      text: "Please update this card.",
    });
    expect(isJoyceComment(action)).toBe(false);
  });

  it("does NOT recognise a random user as Joyce", () => {
    const action = makeOtherComment("Can you update this?");
    expect(isJoyceComment(action)).toBe(false);
  });
});

// ─── analyseCardThread ────────────────────────────────────────────────────────

describe("analyseCardThread", () => {
  let nowMs: number;

  beforeEach(() => {
    nowMs = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns needsReply=false when there are no comments", () => {
    const state = analyseCardThread(makeCard(), []);
    expect(state.needsReply).toBe(false);
    expect(state.isOverdue).toBe(false);
    expect(state.vagueReplies).toHaveLength(0);
  });

  it("returns needsReply=false when Joyce commented last", () => {
    const otherDate = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const joyceDate = new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    const comments = [
      makeOtherComment("Please update this.", otherDate),
      makeJoyceComment("Updated!", joyceDate),
    ];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(false);
    expect(state.isOverdue).toBe(false);
  });

  it("returns needsReply=true when someone else commented after Joyce", () => {
    const joyceDate = new Date(nowMs - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const otherDate = new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    const comments = [
      makeJoyceComment("Updated!", joyceDate),
      makeOtherComment("Thanks, but can you also do X?", otherDate),
    ];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(true);
    expect(state.isOverdue).toBe(false); // Only 1h elapsed, deadline is 12h
    expect(state.lastNonJoyceAuthor).toBe("Client");
  });

  it("returns isOverdue=true when 12h+ has elapsed without Joyce replying", () => {
    const otherDate = new Date(nowMs - 13 * 60 * 60 * 1000).toISOString(); // 13h ago
    const comments = [makeOtherComment("Please update this.", otherDate)];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(true);
    expect(state.isOverdue).toBe(true);
    expect(state.elapsedMs).toBeGreaterThan(REPLY_DEADLINE_MS);
  });

  it("returns isOverdue=false when exactly at the 12h boundary", () => {
    const otherDate = new Date(nowMs - REPLY_DEADLINE_MS + 1000).toISOString(); // 11h 59m 59s ago
    const comments = [makeOtherComment("Please update this.", otherDate)];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(true);
    expect(state.isOverdue).toBe(false);
  });

  it("detects a vague reply from Joyce", () => {
    const joyceDate = new Date(nowMs - 30 * 60 * 1000).toISOString(); // 30m ago
    const otherDate = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const comments = [
      makeOtherComment("Can you update this?", otherDate),
      makeJoyceComment("I'll get back to you tonight", joyceDate),
    ];
    const state = analyseCardThread(makeCard(), comments);
    // Joyce replied last, so needsReply=false — but there IS a vague reply
    expect(state.needsReply).toBe(false);
    expect(state.vagueReplies).toHaveLength(1);
    expect(state.vagueReplies[0].text).toBe("I'll get back to you tonight");
  });

  it("detects a vague reply from Joyce via board-owner proxy", () => {
    const joyceDate = new Date(nowMs - 30 * 60 * 1000).toISOString();
    const otherDate = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    const comments = [
      makeOtherComment("Can you update this?", otherDate),
      makeOwnerProxyComment("I'll check on this later", joyceDate),
    ];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(false); // Joyce replied (via proxy)
    expect(state.vagueReplies).toHaveLength(1);
  });

  it("does NOT flag a substantive reply as vague", () => {
    const joyceDate = new Date(nowMs - 30 * 60 * 1000).toISOString();
    const otherDate = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    const comments = [
      makeOtherComment("Can you update this?", otherDate),
      makeJoyceComment("I have updated the card with the latest invoice. Client notified.", joyceDate),
    ];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.vagueReplies).toHaveLength(0);
  });

  it("handles multiple non-Joyce comments — tracks the LAST one", () => {
    const date1 = new Date(nowMs - 5 * 60 * 60 * 1000).toISOString();
    const date2 = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    const comments = [
      makeComment({ username: "user_a", fullName: "User A", text: "First comment", date: date1 }),
      makeComment({ username: "user_b", fullName: "User B", text: "Second comment", date: date2 }),
    ];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(true);
    expect(state.lastNonJoyceAuthor).toBe("User B"); // Most recent non-Joyce
    expect(state.lastNonJoyceText).toBe("Second comment");
  });

  it("returns needsReply=false when there are only Joyce comments", () => {
    const comments = [makeJoyceComment("Started working on this.")];
    const state = analyseCardThread(makeCard(), comments);
    expect(state.needsReply).toBe(false);
    expect(state.lastNonJoyceMsgAt).toBeNull();
  });

  it("ignores APTLSS system notes for reply and signature monitoring", () => {
    const comments = [makeComment({
      username: "noodzakelijkonline",
      fullName: "Board Owner",
      text: "[APTLSS System]\n\nAssessment refreshed",
    })];

    const state = analyseCardThread(makeCard(), comments);

    expect(state.needsReply).toBe(false);
    expect(state.lastNonJoyceMsgAt).toBeNull();
    expect(state.unsignedMessages).toHaveLength(0);
  });
});
