import { describe, expect, it } from "vitest";
import {
  buildAptlssExternalEvidenceSignal,
  matchEvidenceToCards,
  type WorkspaceEvidenceCandidate,
} from "./workspaceEvidence";

const observedAt = new Date("2026-07-13T12:00:00.000Z");

function evidence(overrides: Partial<WorkspaceEvidenceCandidate> = {}): WorkspaceEvidenceCandidate {
  return {
    id: 1,
    source: "gmail",
    sourceId: "message-1",
    title: "Acme landing page approval required",
    summary: "The client needs the final landing page approved before Friday.",
    content: "Please review the Acme landing page copy and reply.",
    sourceUrl: "https://mail.google.com/mail/u/0/#inbox/thread-1",
    modifiedAt: observedAt,
    observedAt,
    ...overrides,
  };
}

const cards = [
  { id: "card-acme", name: "Acme landing page", url: "https://trello.com/c/card-acme", context: "Website / Doing" },
  { id: "card-payroll", name: "Monthly payroll", url: "https://trello.com/c/card-payroll", context: "Finance / Doing" },
];

describe("workspace evidence matching", () => {
  it("links full card names across Gmail and Trello", () => {
    expect(matchEvidenceToCards(evidence(), cards)).toEqual([
      expect.objectContaining({ cardId: "card-acme", relevanceScore: 92 }),
    ]);
  });

  it("uses explicit Drive identifiers embedded in Trello attachments", () => {
    const drive = evidence({ source: "google_drive", sourceId: "drive-file-123", title: "Launch brief" });
    const linked = matchEvidenceToCards(drive, [{
      id: "card-launch",
      name: "Prepare launch",
      context: "Attachment: https://drive.google.com/open?id=drive-file-123",
    }]);
    expect(linked[0]).toMatchObject({ cardId: "card-launch", relevanceScore: 98 });
  });

  it("does not link generic one-word overlap", () => {
    expect(matchEvidenceToCards(evidence({ title: "Project update", summary: null, content: "Routine notes" }), cards)).toEqual([]);
  });

  it("does not treat generic business-plan language as a card identity", () => {
    const drive = evidence({
      source: "google_drive",
      sourceId: "drive-business-plan",
      title: "ScanFlow Business Plan",
      summary: "A business plan stored by Noodzakelijk Online",
      content: "General planning notes for another company.",
    });
    expect(matchEvidenceToCards(drive, [{
      id: "card-business-plan",
      name: "Noodzakelijk Online Business Plan",
    }])).toEqual([]);
  });

  it("links Drive files using multiple distinctive title terms", () => {
    const drive = evidence({
      source: "google_drive",
      sourceId: "drive-daylight-therapy",
      title: "Complaint compensation daylight therapy glasses",
      summary: null,
      content: null,
    });
    expect(matchEvidenceToCards(drive, [{
      id: "card-daylight-therapy",
      name: "Daylight therapy glasses complaint",
    }])).toEqual([
      expect.objectContaining({ cardId: "card-daylight-therapy", relevanceScore: 88 }),
    ]);
  });

  it("does not create semantic card-to-card links without an explicit Trello reference", () => {
    const trello = evidence({ source: "trello", sourceId: "card-video-1", title: "Explainer video maken", content: "Create the explainer video" });
    const linked = matchEvidenceToCards(trello, [
      { id: "card-video-1", name: "Explainer video maken" },
      { id: "card-video-2", name: "Client explainer video maken" },
    ]);
    expect(linked).toEqual([expect.objectContaining({ cardId: "card-video-1", relevanceScore: 100 })]);
  });

  it("summarizes source coverage and high-confidence links for APTLSS", () => {
    const signal = buildAptlssExternalEvidenceSignal([
      { ...evidence(), relevanceScore: 92, matchReason: "Full card name" },
      { ...evidence({ id: 2, source: "google_drive", sourceId: "file-1" }), relevanceScore: 98, matchReason: "Explicit ID" },
      { ...evidence({ id: 3, source: "trello", sourceId: "card-acme" }), relevanceScore: 100, matchReason: "Own card" },
    ]);
    expect(signal).toMatchObject({
      total: 3,
      highConfidenceLinks: 3,
      sourceCounts: { gmail: 1, google_drive: 1, trello: 1 },
      latestObservedAt: observedAt.toISOString(),
    });
  });
});
