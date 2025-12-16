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
  role: mysqlEnum("role", ["user", "admin", "worker"]).default("user").notNull(),
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
  // Holiday integration
  country: varchar('country', { length: 2 }).notNull().default('US'), // ISO 3166-1 alpha-2 country code for holidays
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type UserWorkingHours = typeof userWorkingHours.$inferSelect;
export type InsertUserWorkingHours = typeof userWorkingHours.$inferInsert;

// Holidays table for country-specific holidays
export const holidays = mysqlTable('holidays', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD format
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 2 }).notNull(), // ISO 3166-1 alpha-2 country code
  isActive: int('isActive').notNull().default(1), // 0=disabled, 1=enabled
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = typeof holidays.$inferInsert;

// Trello data cache tables
export const trelloCacheMetadata = mysqlTable('trello_cache_metadata', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  cacheKey: varchar('cacheKey', { length: 255 }).notNull(), // e.g., 'boards', 'tasks', 'cards:{boardId}'
  lastFetched: timestamp('lastFetched').defaultNow().notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  ttlSeconds: int('ttlSeconds').notNull().default(300), // 5 minutes default
  hitCount: int('hitCount').notNull().default(0),
  missCount: int('missCount').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const trelloCachedTasks = mysqlTable('trello_cached_tasks', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  taskData: text('taskData').notNull(), // JSON serialized task data
  cachedAt: timestamp('cachedAt').defaultNow().notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
});

export const trelloCachedBoards = mysqlTable('trello_cached_boards', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  boardId: varchar('boardId', { length: 64 }).notNull(),
  boardData: text('boardData').notNull(), // JSON serialized board data
  cachedAt: timestamp('cachedAt').defaultNow().notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
});

export const trelloCachedCards = mysqlTable('trello_cached_cards', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  boardId: varchar('boardId', { length: 64 }).notNull(),
  cardId: varchar('cardId', { length: 64 }).notNull(),
  cardData: text('cardData').notNull(), // JSON serialized card data
  cachedAt: timestamp('cachedAt').defaultNow().notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
});

export type TrelloCacheMetadata = typeof trelloCacheMetadata.$inferSelect;
export type InsertTrelloCacheMetadata = typeof trelloCacheMetadata.$inferInsert;
export type TrelloCachedTask = typeof trelloCachedTasks.$inferSelect;
export type InsertTrelloCachedTask = typeof trelloCachedTasks.$inferInsert;
export type TrelloCachedBoard = typeof trelloCachedBoards.$inferSelect;
export type InsertTrelloCachedBoard = typeof trelloCachedBoards.$inferInsert;
export type TrelloCachedCard = typeof trelloCachedCards.$inferSelect;
export type InsertTrelloCachedCard = typeof trelloCachedCards.$inferInsert;

// ============================================
// VA MANAGEMENT TABLES
// ============================================

// Virtual Worker profiles (formerly Virtual Assistant)
export const vaProfiles = mysqlTable('va_profiles', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(), // References users.id (the VA's user account)
  founderId: int('founderId').notNull(), // References users.id (the founder who manages this VA)
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Manila'), // Default to Philippines
  skills: text('skills'), // JSON array of skills
  hourlyRate: int('hourlyRate'), // In cents
  currency: varchar('currency', { length: 3 }).default('USD'),
  workStartHour: int('workStartHour').notNull().default(9),
  workEndHour: int('workEndHour').notNull().default(18),
  workingDays: varchar('workingDays', { length: 50 }).notNull().default('1,2,3,4,5'),
  // Meal times (stored as hour in 24h format, e.g., 12 = 12:00 PM)
  breakfastTime: int('breakfastTime'), // Optional breakfast break
  breakfastDuration: int('breakfastDuration').default(0), // In minutes
  lunchTime: int('lunchTime').default(12), // Default 12:00 PM
  lunchDuration: int('lunchDuration').default(60), // Default 1 hour
  dinnerTime: int('dinnerTime'), // Optional dinner break
  dinnerDuration: int('dinnerDuration').default(0), // In minutes
  status: mysqlEnum('status', ['active', 'inactive', 'on_leave']).default('active').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Task assignments linking tasks to VAs
export const taskAssignments = mysqlTable('task_assignments', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(), // Composite: cardId:checklistId:checkItemId
  vaId: int('vaId').notNull(), // References vaProfiles.id
  founderId: int('founderId').notNull(), // References users.id
  assignedAt: timestamp('assignedAt').defaultNow().notNull(),
  assignedBy: int('assignedBy').notNull(), // References users.id (who assigned)
  status: mysqlEnum('status', ['assigned', 'in_progress', 'completed', 'blocked', 'ready_for_review']).default('assigned').notNull(),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Task dependencies
export const taskDependencies = mysqlTable('task_dependencies', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(), // The task that is blocked
  blockedByTaskId: varchar('blockedByTaskId', { length: 128 }).notNull(), // The task that blocks it
  founderId: int('founderId').notNull(),
  dependencyType: mysqlEnum('dependencyType', ['finish_to_start', 'start_to_start', 'finish_to_finish']).default('finish_to_start').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Founder priority overrides
export const founderPriorityOverrides = mysqlTable('founder_priority_overrides', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(),
  founderId: int('founderId').notNull(),
  priority: mysqlEnum('priority', ['normal', 'high', 'urgent', 'drop_everything']).default('normal').notNull(),
  reason: text('reason'),
  expiresAt: timestamp('expiresAt'), // Optional expiry for temporary priorities
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Client/Project context
export const clients = mysqlTable('clients', {
  id: int('id').primaryKey().autoincrement(),
  founderId: int('founderId').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  priority: mysqlEnum('priority', ['standard', 'priority', 'vip']).default('standard').notNull(),
  trelloBoardIds: text('trelloBoardIds'), // JSON array of associated board IDs
  contactEmail: varchar('contactEmail', { length: 320 }),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Communication/Decision log
export const communicationLog = mysqlTable('communication_log', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }),
  fromUserId: int('fromUserId').notNull(), // VA or Founder
  toUserId: int('toUserId'), // Can be null for general notes
  messageType: mysqlEnum('messageType', ['question', 'decision', 'update', 'handoff', 'feedback']).notNull(),
  message: text('message').notNull(),
  context: text('context'), // JSON with task context
  isRead: int('isRead').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Daily briefings
export const dailyBriefings = mysqlTable('daily_briefings', {
  id: int('id').primaryKey().autoincrement(),
  vaId: int('vaId').notNull(),
  founderId: int('founderId').notNull(),
  briefingDate: varchar('briefingDate', { length: 10 }).notNull(), // YYYY-MM-DD
  briefingType: mysqlEnum('briefingType', ['morning', 'end_of_day', 'weekly']).notNull(),
  content: text('content').notNull(), // JSON with briefing data
  sentAt: timestamp('sentAt'),
  sentTo: varchar('sentTo', { length: 320 }), // Email address
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Quality checkpoints / Review queue
export const reviewQueue = mysqlTable('review_queue', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(),
  vaId: int('vaId').notNull(),
  founderId: int('founderId').notNull(),
  status: mysqlEnum('status', ['pending_review', 'approved', 'needs_revision', 'rejected']).default('pending_review').notNull(),
  submittedAt: timestamp('submittedAt').defaultNow().notNull(),
  reviewedAt: timestamp('reviewedAt'),
  feedback: text('feedback'),
  revisionCount: int('revisionCount').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Time tracking entries
export const timeEntries = mysqlTable('time_entries', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(),
  vaId: int('vaId').notNull(),
  founderId: int('founderId').notNull(),
  startTime: timestamp('startTime').notNull(),
  endTime: timestamp('endTime'),
  durationMinutes: int('durationMinutes'), // Calculated when stopped
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Handoff notes
export const handoffNotes = mysqlTable('handoff_notes', {
  id: int('id').primaryKey().autoincrement(),
  taskId: varchar('taskId', { length: 128 }).notNull(),
  fromVaId: int('fromVaId').notNull(),
  toVaId: int('toVaId'),
  founderId: int('founderId').notNull(),
  whereLeftOff: text('whereLeftOff').notNull(),
  nextSteps: text('nextSteps'),
  blockers: text('blockers'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Export types
export type VAProfile = typeof vaProfiles.$inferSelect;
export type InsertVAProfile = typeof vaProfiles.$inferInsert;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type InsertTaskAssignment = typeof taskAssignments.$inferInsert;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type InsertTaskDependency = typeof taskDependencies.$inferInsert;
export type FounderPriorityOverride = typeof founderPriorityOverrides.$inferSelect;
export type InsertFounderPriorityOverride = typeof founderPriorityOverrides.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type CommunicationLogEntry = typeof communicationLog.$inferSelect;
export type InsertCommunicationLogEntry = typeof communicationLog.$inferInsert;
export type DailyBriefing = typeof dailyBriefings.$inferSelect;
export type InsertDailyBriefing = typeof dailyBriefings.$inferInsert;
export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type InsertReviewQueueItem = typeof reviewQueue.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;
export type HandoffNote = typeof handoffNotes.$inferSelect;
export type InsertHandoffNote = typeof handoffNotes.$inferInsert;
