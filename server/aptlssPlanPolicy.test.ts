import { describe, expect, it } from "vitest";
import { shouldSyncAptlssChecklist } from "./aptlssPlanPolicy";

describe("APTLSS checklist approval policy", () => {
  it("keeps Trello unchanged when checklist sync is omitted or declined", () => {
    expect(shouldSyncAptlssChecklist(undefined, 4)).toBe(false);
    expect(shouldSyncAptlssChecklist(false, 4)).toBe(false);
  });

  it("requires both an explicit request and an enabled autopilot policy", () => {
    expect(shouldSyncAptlssChecklist(true, 0)).toBe(false);
    expect(shouldSyncAptlssChecklist(true, 1)).toBe(true);
  });
});
