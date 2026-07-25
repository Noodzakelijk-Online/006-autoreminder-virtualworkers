import { describe, expect, it } from "vitest";
import { compareWorkLaneNames, getWorkLaneCategory, getWorkLaneRank } from "@shared/workLanePriority";

describe("mandatory work lane priority", () => {
  it("orders on-hold before doing before to-do", () => {
    const lists = ["To Do", "Doing", "On Hold"].sort(compareWorkLaneNames);
    expect(lists).toEqual(["On Hold", "Doing", "To Do"]);
  });

  it("normalizes supported Trello list aliases", () => {
    expect(getWorkLaneCategory("ON-HOLD")).toBe("on-hold");
    expect(getWorkLaneCategory("In Progress")).toBe("doing");
    expect(getWorkLaneCategory("Backlog")).toBe("todo");
    expect(getWorkLaneRank("Unknown")).toBeGreaterThan(getWorkLaneRank("To Do"));
  });
});
