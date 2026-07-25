export type WorkLaneCategory = "on-hold" | "doing" | "todo" | "other";

const ON_HOLD_LIST_NAMES = new Set(["on-hold", "on hold", "onhold"]);
const DOING_LIST_NAMES = new Set(["doing", "in progress", "in-progress"]);
const TODO_LIST_NAMES = new Set(["to do", "todo", "to-do", "backlog", "inbox", "new", "queue"]);

export const WORK_LANE_ORDER: readonly WorkLaneCategory[] = ["on-hold", "doing", "todo", "other"];

export function getWorkLaneCategory(listName: string): WorkLaneCategory {
  const normalized = listName.trim().toLowerCase();
  if (ON_HOLD_LIST_NAMES.has(normalized)) return "on-hold";
  if (DOING_LIST_NAMES.has(normalized)) return "doing";
  if (TODO_LIST_NAMES.has(normalized)) return "todo";
  return "other";
}

export function getWorkLaneRank(categoryOrListName: string): number {
  const category = WORK_LANE_ORDER.includes(categoryOrListName as WorkLaneCategory)
    ? categoryOrListName as WorkLaneCategory
    : getWorkLaneCategory(categoryOrListName);
  const rank = WORK_LANE_ORDER.indexOf(category);
  return rank === -1 ? WORK_LANE_ORDER.length : rank;
}

export function compareWorkLaneNames(leftListName: string, rightListName: string): number {
  return getWorkLaneRank(leftListName) - getWorkLaneRank(rightListName);
}
