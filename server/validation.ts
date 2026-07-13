import { z } from "zod";
import { addDaysToDateKey, assertDateKey } from "../shared/eatTime";

export const dateKeySchema = z.string().superRefine((value, context) => {
  try {
    assertDateKey(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Invalid date",
    });
  }
});

export const sundayDateKeySchema = dateKeySchema.refine(
  (value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 0,
  "Date must be a Sunday",
);

export const mondayDateKeySchema = dateKeySchema.refine(
  (value) => new Date(`${value}T00:00:00Z`).getUTCDay() === 1,
  "Date must be a Monday",
);

export const weekDateRangeSchema = z.object({
  startDate: mondayDateKeySchema,
  endDate: sundayDateKeySchema,
}).refine(
  ({ startDate, endDate }) => addDaysToDateKey(startDate, 6) === endDate,
  { message: "Week range must cover one Monday-through-Sunday week", path: ["endDate"] },
);

export const payWeekRangeSchema = z.object({
  weekStart: mondayDateKeySchema,
  weekEnd: sundayDateKeySchema,
}).refine(
  ({ weekStart, weekEnd }) => addDaysToDateKey(weekStart, 6) === weekEnd,
  { message: "Pay week must cover one Monday-through-Sunday week", path: ["weekEnd"] },
);

export const trelloCardIdSchema = z.string().trim().min(1).max(128);
export const timerStartInputSchema = z.object({
  cardId: trelloCardIdSchema,
  cardName: z.string().trim().min(1).max(1_000),
  cardUrl: z.string().trim().url().max(2_048),
  boardName: z.string().trim().min(1).max(500).default("Unknown Board"),
  listName: z.string().trim().min(1).max(500).default("Unknown"),
});
