import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Generation history tables
export const generationJobs = mysqlTable('generation_jobs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  totalCards: int('totalCards').notNull(),
  completedCards: int('completedCards').notNull().default(0),
  failedCards: int('failedCards').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull(),
  settings: text('settings'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
  createdBy: varchar('createdBy', { length: 64 }).notNull(),
});

export const generationItems = mysqlTable('generation_items', {
  id: varchar('id', { length: 64 }).primaryKey(),
  jobId: varchar('jobId', { length: 64 }).notNull(),
  cardId: varchar('cardId', { length: 64 }).notNull(),
  cardName: text('cardName').notNull(),
  boardName: varchar('boardName', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull(),
  attempts: int('attempts').notNull().default(0),
  maxAttempts: int('maxAttempts').notNull().default(3),
  error: text('error'),
  result: text('result'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type GenerationJob = typeof generationJobs.$inferSelect;
export type InsertGenerationJob = typeof generationJobs.$inferInsert;
export type GenerationItem = typeof generationItems.$inferSelect;
export type InsertGenerationItem = typeof generationItems.$inferInsert;

// Scheduled jobs table
export const scheduledJobs = mysqlTable('scheduled_jobs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  cardIds: text('cardIds').notNull(), // JSON string array
  scheduledTime: timestamp('scheduledTime').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed, cancelled
  settings: text('settings').notNull(), // JSON string
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
  error: text('error'),
  createdBy: varchar('createdBy', { length: 64 }).notNull(),
});

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobs.$inferInsert;

// User working hours settings table
export const userWorkingHours = mysqlTable('user_working_hours', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(), // References users.id
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(), // References users.openId for easier lookup
  workStartHour: int('workStartHour').notNull().default(9), // 0-23
  workStartMinute: int('workStartMinute').notNull().default(0), // 0-59
  workEndHour: int('workEndHour').notNull().default(18), // 0-23
  workEndMinute: int('workEndMinute').notNull().default(0), // 0-59
  breakfastTime: varchar('breakfastTime', { length: 5 }).default('09:00'), // HH:MM format
  breakfastDuration: int('breakfastDuration').notNull().default(45), // minutes
  lunchTime: varchar('lunchTime', { length: 5 }).default('15:00'), // HH:MM format
  lunchDuration: int('lunchDuration').notNull().default(45), // minutes
  dinnerTime: varchar('dinnerTime', { length: 5 }).default('20:00'), // HH:MM format
  dinnerDuration: int('dinnerDuration').notNull().default(120), // minutes
  enableBreaks: int('enableBreaks').notNull().default(1), // 0=false, 1=true (MySQL doesn't have boolean)
  shortBreakInterval: int('shortBreakInterval').notNull().default(120), // minutes of work before short break
  shortBreakDuration: int('shortBreakDuration').notNull().default(10), // minutes
  longBreakInterval: int('longBreakInterval').notNull().default(240), // minutes of work before long break
  longBreakDuration: int('longBreakDuration').notNull().default(30), // minutes
  // Working days configuration
  workingDays: varchar('workingDays', { length: 50 }).notNull().default('1,2,3,4,5'), // Comma-separated: 0=Sun, 1=Mon, ..., 6=Sat
  // Timezone support
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'), // IANA timezone (e.g., 'America/New_York', 'Europe/Amsterdam')
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type UserWorkingHours = typeof userWorkingHours.$inferSelect;
export type InsertUserWorkingHours = typeof userWorkingHours.$inferInsert;