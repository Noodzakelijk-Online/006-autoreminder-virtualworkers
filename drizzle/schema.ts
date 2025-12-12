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