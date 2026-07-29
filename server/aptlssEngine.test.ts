import { describe, expect, it } from "vitest";
import { isFinalSummaryComment } from "./aptlssEngine";

describe("APTLSS final-summary detection", () => {
  it.each([
    "Final summary: Files delivered and linked.",
    "Done - Client received the document.",
    "Completed \u2013 Evidence archived.",
    "Completion summary \u2014 all acceptance checks passed.",
  ])("accepts an explicit completion marker: %s", (comment) => {
    expect(isFinalSummaryComment(comment)).toBe(true);
  });

  it.each([
    "Not completed - waiting for the signed form.",
    "This still needs to be completed tomorrow.",
    "Almost done, but the final review remains open.",
    "Progress update: draft prepared.",
  ])("rejects progress wording that is not a final summary: %s", (comment) => {
    expect(isFinalSummaryComment(comment)).toBe(false);
  });
});
