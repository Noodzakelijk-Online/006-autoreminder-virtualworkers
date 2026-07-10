/**
 * Tests for upworkMonitor.ts
 * Covers: analyseUpworkRoom logic (pure analysis, no API calls) and hasValidSignature
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers so no DB calls are made ─────────────────────────────────
vi.mock("./replyMonitorDb", () => ({
  upsertUpworkThread: vi.fn(),
  upsertUpworkVagueFlag: vi.fn(),
  insertUnsignedFlag: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

// ─── Mock the scraper so no Puppeteer calls are made ─────────────────────────
vi.mock("./upworkScraper", () => ({
  fetchUpworkRooms: vi.fn(),
  OWNER_USER_ID: "1681372983093714944",
}));

import { analyseUpworkRoom } from "./upworkMonitor";
import { hasValidSignature, isVagueReply } from "./replyMonitor";

const OWNER_USER_ID = "1681372983093714944";
const FREELANCER_USER_ID = "9999999999999999999";
const ORG_ID = "1681372983093714945";

const NOW = Date.now();
const HOURS = (n: number) => n * 60 * 60 * 1000;

function makeStory(overrides: Partial<{
  storyId: string;
  userId: string;
  message: string;
  createdAt: number;
}> = {}) {
  return {
    storyId: "story_" + Math.random().toString(36).slice(2),
    userId: FREELANCER_USER_ID,
    message: "Hello, any update?",
    createdAt: NOW - HOURS(1),
    ...overrides,
  };
}

function makeRoom(overrides: Partial<{
  roomId: string;
  roomName: string;
  stories: ReturnType<typeof makeStory>[];
}> = {}) {
  return {
    roomId: "room_test123",
    roomName: "Test Freelancer",
    latestStory: null,
    stories: [] as ReturnType<typeof makeStory>[],
    ...overrides,
  };
}

// ─── hasValidSignature ────────────────────────────────────────────────────────

describe("hasValidSignature", () => {
  it("accepts ~ Angel at end", () => {
    expect(hasValidSignature("Thanks for your patience. ~ Angel")).toBe(true);
  });

  it("accepts ~ Joyce at end", () => {
    expect(hasValidSignature("We will proceed with the contract. ~ Joyce")).toBe(true);
  });

  it("accepts ~ Angel with trailing newline", () => {
    expect(hasValidSignature("Got it.\n~ Angel\n")).toBe(true);
  });

  it("accepts ~ Joyce with trailing whitespace", () => {
    expect(hasValidSignature("Will do.  ~ Joyce  ")).toBe(true);
  });

  it("rejects message without signature", () => {
    expect(hasValidSignature("I'll get back to you tonight")).toBe(false);
  });

  it("rejects message with only partial signature", () => {
    expect(hasValidSignature("Thanks ~ An")).toBe(false);
  });

  it("rejects empty message", () => {
    expect(hasValidSignature("")).toBe(false);
  });

  it("accepts ~ angel (lowercase) — check is case-insensitive", () => {
    // The check lowercases both sides, so ~ angel / ~ Angel / ~ ANGEL are all valid
    expect(hasValidSignature("Done. ~ angel")).toBe(true);
  });

  it("rejects message with ~ in the middle but not at end", () => {
    expect(hasValidSignature("~ Angel said: let me check on this")).toBe(false);
  });
});

// ─── analyseUpworkRoom ────────────────────────────────────────────────────────

describe("analyseUpworkRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns needsReply=false when no stories", async () => {
    const result = await analyseUpworkRoom(makeRoom({ stories: [] }));
    expect(result.needsReply).toBe(false);
    expect(result.isOverdue).toBe(false);
  });

  it("returns needsReply=true when last message is from freelancer", async () => {
    const stories = [
      makeStory({ userId: FREELANCER_USER_ID, createdAt: NOW - HOURS(1) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.needsReply).toBe(true);
    expect(result.isOverdue).toBe(false);
  });

  it("returns isOverdue=true when freelancer message is >12h old", async () => {
    const stories = [
      makeStory({ userId: FREELANCER_USER_ID, createdAt: NOW - HOURS(13) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.needsReply).toBe(true);
    expect(result.isOverdue).toBe(true);
  });

  it("returns needsReply=false when owner replied after freelancer", async () => {
    const stories = [
      makeStory({ userId: OWNER_USER_ID, message: "On it. ~ Joyce", createdAt: NOW - HOURS(1) }),
      makeStory({ userId: FREELANCER_USER_ID, createdAt: NOW - HOURS(3) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.needsReply).toBe(false);
  });

  it("returns needsReply=true when owner replied BEFORE freelancer's last message", async () => {
    const stories = [
      makeStory({ userId: FREELANCER_USER_ID, createdAt: NOW - HOURS(1) }),
      makeStory({ userId: OWNER_USER_ID, message: "Thanks. ~ Angel", createdAt: NOW - HOURS(5) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.needsReply).toBe(true);
  });

  it("flags vague reply from owner", async () => {
    const stories = [
      makeStory({ userId: OWNER_USER_ID, message: "I'll get back to you tonight ~ Joyce", createdAt: NOW - HOURS(2) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.vagueReplies.length).toBeGreaterThan(0);
    expect(result.vagueReplies[0].text).toContain("I'll get back to you tonight");
  });

  it("flags unsigned message from owner", async () => {
    const stories = [
      makeStory({ userId: OWNER_USER_ID, message: "We will proceed with the contract.", createdAt: NOW - HOURS(1) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.unsignedMessages.length).toBeGreaterThan(0);
  });

  it("does NOT flag signed message as unsigned", async () => {
    const stories = [
      makeStory({ userId: OWNER_USER_ID, message: "We will proceed with the contract. ~ Joyce", createdAt: NOW - HOURS(1) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.unsignedMessages.length).toBe(0);
  });

  it("does NOT flag freelancer messages as unsigned", async () => {
    const stories = [
      makeStory({ userId: FREELANCER_USER_ID, message: "Hello, any update?", createdAt: NOW - HOURS(1) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.unsignedMessages.length).toBe(0);
  });

  it("ignores stories with empty message", async () => {
    const stories = [
      makeStory({ userId: FREELANCER_USER_ID, message: "", createdAt: NOW - HOURS(1) }),
      makeStory({ userId: FREELANCER_USER_ID, message: "   ", createdAt: NOW - HOURS(2) }),
    ];
    const result = await analyseUpworkRoom(makeRoom({ stories }));
    expect(result.needsReply).toBe(false);
  });

  it("returns correct roomUrl with org reference", async () => {
    const result = await analyseUpworkRoom(makeRoom({ roomId: "room_abc123", stories: [] }));
    expect(result.roomUrl).toContain("room_abc123");
    expect(result.roomUrl).toContain("companyReference");
  });
});
