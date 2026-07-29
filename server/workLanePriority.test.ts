import { describe, expect, it } from "vitest";
import { compareWorkLaneNames, getWorkLaneCategory, WORK_LANE_ORDER } from "../shared/workLanePriority";

describe("operator work lane priority", () => {
  it("keeps the approved on-hold, doing, to-do order", () => {
    expect(WORK_LANE_ORDER).toEqual(["on-hold", "doing", "todo", "other"]);
    expect(["To Do", "Doing", "On-Hold"].sort(compareWorkLaneNames)).toEqual(["On-Hold", "Doing", "To Do"]);
  });

  it("normalizes common list-name variants", () => {
    expect(getWorkLaneCategory("In Progress")).toBe("doing");
    expect(getWorkLaneCategory("on hold")).toBe("on-hold");
    expect(getWorkLaneCategory("Backlog")).toBe("todo");
  });
});
