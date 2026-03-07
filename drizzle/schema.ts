import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

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
  // Weekly hours target (for scheduling optimization)
  weeklyHoursMin: int('weeklyHoursMin').notNull().default(40), // Minimum target hours per week
  weeklyHoursMax: int('weeklyHoursMax').notNull().default(45), // Maximum target hours per week
  // Daily hours flexibility (allows scheduling to vary day-to-day)
  dailyHoursMin: decimal('dailyHoursMin', { precision: 4, scale: 2 }).notNull().default('8.00'), // Minimum hours per day (e.g., 9.5)
  dailyHoursMax: decimal('dailyHoursMax', { precision: 4, scale: 2 }).notNull().default('9.00'), // Maximum hours per day (e.g., 11.5)
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


// ============================================
// ATIS (Adaptive Task Intelligence System) TABLES
// Knowledge-first design for accurate task breakdowns
// ============================================

// Trello workspaces (organizations)
export const atisWorkspaces = mysqlTable('atis_workspaces', {
  id: int('id').primaryKey().autoincrement(),
  trelloId: varchar('trelloId', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('displayName', { length: 255 }),
  url: varchar('url', { length: 512 }),
  boardCount: int('boardCount').default(0),
  lastSyncedAt: timestamp('lastSyncedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Trello boards
export const atisBoards = mysqlTable('atis_boards', {
  id: int('id').primaryKey().autoincrement(),
  trelloId: varchar('trelloId', { length: 64 }).notNull().unique(),
  workspaceId: int('workspaceId'), // References atisWorkspaces.id (nullable for personal boards)
  workspaceTrelloId: varchar('workspaceTrelloId', { length: 64 }),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }),
  isOpen: int('isOpen').default(1), // 1=open, 0=closed
  cardCount: int('cardCount').default(0),
  lastSyncedAt: timestamp('lastSyncedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Trello cards with full data
export const atisCards = mysqlTable('atis_cards', {
  id: int('id').primaryKey().autoincrement(),
  trelloId: varchar('trelloId', { length: 64 }).notNull().unique(),
  boardId: int('boardId').notNull(), // References atisBoards.id
  boardTrelloId: varchar('boardTrelloId', { length: 64 }).notNull(),
  listName: varchar('listName', { length: 255 }),
  listId: varchar('listId', { length: 64 }),
  name: varchar('name', { length: 512 }).notNull(),
  description: text('description'),
  url: varchar('url', { length: 512 }),
  dueDate: timestamp('dueDate'),
  dueComplete: int('dueComplete').default(0),
  isArchived: int('isArchived').default(0),
  isClosed: int('isClosed').default(0),
  labels: text('labels'), // JSON array of labels
  memberIds: text('memberIds'), // JSON array of assigned member IDs
  checklistCount: int('checklistCount').default(0),
  attachmentCount: int('attachmentCount').default(0),
  commentCount: int('commentCount').default(0),
  rawData: text('rawData'), // Full JSON from Trello API
  lastSyncedAt: timestamp('lastSyncedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Attachments with extracted content
export const atisAttachments = mysqlTable('atis_attachments', {
  id: int('id').primaryKey().autoincrement(),
  trelloId: varchar('trelloId', { length: 64 }).notNull(),
  cardId: int('cardId').notNull(), // References atisCards.id
  cardTrelloId: varchar('cardTrelloId', { length: 64 }).notNull(),
  filename: varchar('filename', { length: 512 }),
  mimeType: varchar('mimeType', { length: 128 }),
  fileType: varchar('fileType', { length: 32 }), // pdf, docx, xlsx, image, link, email, other
  url: varchar('url', { length: 1024 }),
  bytes: int('bytes'),
  // Extraction status and content
  extractionStatus: mysqlEnum('extractionStatus', ['pending', 'processing', 'success', 'failed', 'unreadable']).default('pending').notNull(),
  extractedContent: text('extractedContent'), // Extracted text/description
  extractionError: text('extractionError'),
  extractedAt: timestamp('extractedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Comments from Trello cards
export const atisComments = mysqlTable('atis_comments', {
  id: int('id').primaryKey().autoincrement(),
  trelloId: varchar('trelloId', { length: 64 }).notNull(),
  cardId: int('cardId').notNull(), // References atisCards.id
  cardTrelloId: varchar('cardTrelloId', { length: 64 }).notNull(),
  authorId: varchar('authorId', { length: 64 }),
  authorName: varchar('authorName', { length: 255 }),
  text: text('text').notNull(),
  commentDate: timestamp('commentDate'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// AI-generated understanding of each card
export const atisCardUnderstanding = mysqlTable('atis_card_understanding', {
  id: int('id').primaryKey().autoincrement(),
  cardId: int('cardId').notNull().unique(), // References atisCards.id
  cardTrelloId: varchar('cardTrelloId', { length: 64 }).notNull().unique(),
  // Core understanding
  goal: text('goal'), // What is this card trying to achieve?
  deliverable: text('deliverable'), // What tangible output marks completion?
  taskType: varchar('taskType', { length: 64 }), // communication, research, creation, meeting, review, admin, etc.
  // Extracted entities
  entities: text('entities'), // JSON: {people: [], organizations: [], cases: [], systems: [], documents: []}
  // Timing
  deadlines: text('deadlines'), // JSON: [{date, source, description}]
  estimatedMinutes: int('estimatedMinutes'),
  // Dependencies and relationships
  dependencies: text('dependencies'), // JSON: What must happen before this?
  produces: text('produces'), // JSON: What does completing this enable?
  // Classification
  domain: varchar('domain', { length: 128 }), // Area of work
  complexity: mysqlEnum('complexity', ['simple', 'medium', 'complex']).default('medium'),
  // Quality assessment
  clarityScore: int('clarityScore'), // 1-10, how clear is what needs to be done?
  missingInfo: text('missingInfo'), // What's unclear or would help to know?
  confidenceScore: int('confidenceScore'), // 1-100, AI confidence in understanding
  // APTLSS Checklist - AI-generated steps to complete the task
  aptlssChecklist: text('aptlssChecklist'), // JSON array of checklist items
  // Status
  status: mysqlEnum('status', ['pending', 'processing', 'complete', 'needs_review', 'insufficient_info']).default('pending').notNull(),
  generatedAt: timestamp('generatedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Ingestion job tracking
export const atisIngestionJobs = mysqlTable('atis_ingestion_jobs', {
  id: int('id').primaryKey().autoincrement(),
  jobType: mysqlEnum('jobType', ['full_sync', 'incremental', 'workspace', 'board', 'card']).notNull(),
  status: mysqlEnum('status', ['pending', 'running', 'completed', 'failed']).default('pending').notNull(),
  targetId: varchar('targetId', { length: 64 }), // Trello ID of target (workspace, board, or card)
  totalItems: int('totalItems').default(0),
  processedItems: int('processedItems').default(0),
  failedItems: int('failedItems').default(0),
  errorLog: text('errorLog'), // JSON array of errors
  startedAt: timestamp('startedAt'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Export ATIS types
export type ATISWorkspace = typeof atisWorkspaces.$inferSelect;
export type InsertATISWorkspace = typeof atisWorkspaces.$inferInsert;
export type ATISBoard = typeof atisBoards.$inferSelect;
export type InsertATISBoard = typeof atisBoards.$inferInsert;
export type ATISCard = typeof atisCards.$inferSelect;
export type InsertATISCard = typeof atisCards.$inferInsert;
export type ATISAttachment = typeof atisAttachments.$inferSelect;
export type InsertATISAttachment = typeof atisAttachments.$inferInsert;
export type ATISComment = typeof atisComments.$inferSelect;
export type InsertATISComment = typeof atisComments.$inferInsert;
export type ATISCardUnderstanding = typeof atisCardUnderstanding.$inferSelect;
export type InsertATISCardUnderstanding = typeof atisCardUnderstanding.$inferInsert;
export type ATISIngestionJob = typeof atisIngestionJobs.$inferSelect;
export type InsertATISIngestionJob = typeof atisIngestionJobs.$inferInsert;


// User notification preferences
export const userNotificationPreferences = mysqlTable('user_notification_preferences', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull().unique(),
  
  // Notification mode: 'disabled' | 'daily_digest' | 'priority_only'
  notificationMode: mysqlEnum('notificationMode', ['disabled', 'daily_digest', 'priority_only']).default('priority_only').notNull(),
  
  // Daily digest settings
  digestTime: varchar('digestTime', { length: 5 }).default('08:00').notNull(), // HH:MM format
  digestTimezone: varchar('digestTimezone', { length: 50 }).default('Europe/Amsterdam').notNull(),
  
  // Priority only settings - what counts as "urgent"
  urgentThresholdHours: int('urgentThresholdHours').default(24).notNull(), // Tasks due within X hours are urgent
  
  // Email notification settings
  emailEnabled: int('emailEnabled').default(1).notNull(), // 0=false, 1=true
  emailAddress: varchar('emailAddress', { length: 320 }),
  
  // In-app notification settings
  inAppEnabled: int('inAppEnabled').default(1).notNull(),
  
  // Last digest sent timestamp
  lastDigestSent: timestamp('lastDigestSent'),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;


// Notification history for tracking sent notifications
export const notificationHistory = mysqlTable('notification_history', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  
  // Notification details
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  notificationType: mysqlEnum('notificationType', [
    'task_assigned',
    'task_due_soon', 
    'task_overdue',
    'task_completed',
    'daily_digest',
    'general'
  ]).notNull(),
  
  // Related task info (optional)
  taskId: varchar('taskId', { length: 128 }),
  taskName: varchar('taskName', { length: 500 }),
  dueDate: timestamp('dueDate'),
  
  // Delivery status
  channel: mysqlEnum('channel', ['in_app', 'email', 'both']).notNull(),
  deliveryStatus: mysqlEnum('deliveryStatus', ['pending', 'sent', 'failed', 'queued_for_digest']).default('pending').notNull(),
  deliveredAt: timestamp('deliveredAt'),
  
  // Read status for in-app notifications
  isRead: int('isRead').default(0).notNull(), // 0=unread, 1=read
  readAt: timestamp('readAt'),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = typeof notificationHistory.$inferInsert;

// Digest job tracking
export const digestJobs = mysqlTable('digest_jobs', {
  id: int('id').primaryKey().autoincrement(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  scheduledFor: timestamp('scheduledFor').notNull(),
  status: mysqlEnum('status', ['pending', 'processing', 'completed', 'failed']).default('pending').notNull(),
  notificationCount: int('notificationCount').default(0).notNull(),
  error: text('error'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type DigestJob = typeof digestJobs.$inferSelect;
export type InsertDigestJob = typeof digestJobs.$inferInsert;


// ============================================
// TRELLO CHATBOT TABLES
// ============================================

// Registered webhooks for chatbot
export const chatbotWebhooks = mysqlTable('chatbot_webhooks', {
  id: int('id').primaryKey().autoincrement(),
  trelloWebhookId: varchar('trelloWebhookId', { length: 64 }).notNull().unique(),
  modelId: varchar('modelId', { length: 64 }).notNull(), // Board or workspace ID
  modelType: mysqlEnum('modelType', ['board', 'workspace']).default('board').notNull(),
  description: varchar('description', { length: 255 }),
  callbackUrl: varchar('callbackUrl', { length: 512 }).notNull(),
  isActive: int('isActive').default(1).notNull(), // 0=inactive, 1=active
  lastEventAt: timestamp('lastEventAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Chatbot conversation history
export const chatbotConversations = mysqlTable('chatbot_conversations', {
  id: int('id').primaryKey().autoincrement(),
  cardTrelloId: varchar('cardTrelloId', { length: 64 }).notNull(),
  cardName: varchar('cardName', { length: 500 }),
  boardTrelloId: varchar('boardTrelloId', { length: 64 }),
  
  // Command details
  command: varchar('command', { length: 50 }).notNull(), // status, checkin, remind, etc.
  commandArgs: text('commandArgs'), // JSON array of arguments
  
  // Author info
  authorTrelloId: varchar('authorTrelloId', { length: 64 }),
  authorName: varchar('authorName', { length: 255 }),
  
  // Comment IDs
  incomingCommentId: varchar('incomingCommentId', { length: 64 }),
  responseCommentId: varchar('responseCommentId', { length: 64 }),
  
  // Response details
  responseText: text('responseText'),
  responseStatus: mysqlEnum('responseStatus', ['success', 'failed', 'pending']).default('pending').notNull(),
  responseError: text('responseError'),
  
  // Timing
  receivedAt: timestamp('receivedAt').defaultNow().notNull(),
  respondedAt: timestamp('respondedAt'),
  responseTimeMs: int('responseTimeMs'), // How long it took to respond
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Worker check-in responses (when workers reply to bot check-ins)
export const chatbotCheckinResponses = mysqlTable('chatbot_checkin_responses', {
  id: int('id').primaryKey().autoincrement(),
  conversationId: int('conversationId').notNull(), // References chatbotConversations.id
  cardTrelloId: varchar('cardTrelloId', { length: 64 }).notNull(),
  
  // Worker info
  workerTrelloId: varchar('workerTrelloId', { length: 64 }),
  workerName: varchar('workerName', { length: 255 }),
  workerId: int('workerId'), // References vaProfiles.id if matched
  
  // Response content
  responseCommentId: varchar('responseCommentId', { length: 64 }),
  responseText: text('responseText'),
  
  // Parsed response data
  reportedProgress: text('reportedProgress'), // What they said they accomplished
  reportedBlockers: text('reportedBlockers'), // Any blockers mentioned
  estimatedCompletion: varchar('estimatedCompletion', { length: 100 }), // ETA if provided
  
  // Timing
  checkinSentAt: timestamp('checkinSentAt').notNull(),
  responseReceivedAt: timestamp('responseReceivedAt').notNull(),
  responseTimeMinutes: int('responseTimeMinutes'), // How long worker took to respond
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Chatbot analytics aggregates (daily rollups)
export const chatbotAnalytics = mysqlTable('chatbot_analytics', {
  id: int('id').primaryKey().autoincrement(),
  date: timestamp('date').notNull(),
  
  // Command counts
  totalCommands: int('totalCommands').default(0).notNull(),
  statusCommands: int('statusCommands').default(0).notNull(),
  checkinCommands: int('checkinCommands').default(0).notNull(),
  remindCommands: int('remindCommands').default(0).notNull(),
  timeCommands: int('timeCommands').default(0).notNull(),
  progressCommands: int('progressCommands').default(0).notNull(),
  helpCommands: int('helpCommands').default(0).notNull(),
  unknownCommands: int('unknownCommands').default(0).notNull(),
  
  // Response metrics
  successfulResponses: int('successfulResponses').default(0).notNull(),
  failedResponses: int('failedResponses').default(0).notNull(),
  avgResponseTimeMs: int('avgResponseTimeMs'),
  
  // Check-in metrics
  checkinsSent: int('checkinsSent').default(0).notNull(),
  checkinsResponded: int('checkinsResponded').default(0).notNull(),
  avgCheckinResponseMinutes: int('avgCheckinResponseMinutes'),
  
  // Worker engagement
  uniqueWorkers: int('uniqueWorkers').default(0).notNull(),
  uniqueCards: int('uniqueCards').default(0).notNull(),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ChatbotWebhook = typeof chatbotWebhooks.$inferSelect;
export type InsertChatbotWebhook = typeof chatbotWebhooks.$inferInsert;
export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type InsertChatbotConversation = typeof chatbotConversations.$inferInsert;
export type ChatbotCheckinResponse = typeof chatbotCheckinResponses.$inferSelect;
export type InsertChatbotCheckinResponse = typeof chatbotCheckinResponses.$inferInsert;
export type ChatbotAnalytics = typeof chatbotAnalytics.$inferSelect;
export type InsertChatbotAnalytics = typeof chatbotAnalytics.$inferInsert;

// Interview System Tables (ATIS Phases 1-10)
export const interviewSessions = mysqlTable('interview_sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  cardId: varchar('cardId', { length: 64 }).notNull(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  
  // Interview state
  status: mysqlEnum('status', ['active', 'completed', 'abandoned']).notNull().default('active'),
  currentPhase: int('currentPhase').notNull().default(1), // ATIS phases 1-10
  currentQuestion: int('currentQuestion').notNull().default(0),
  
  // Pre-analysis results
  preAnalysisSummary: text('preAnalysisSummary'),
  
  // Interview progress
  questionsAsked: int('questionsAsked').notNull().default(0),
  responsesProvided: int('responsesProvided').notNull().default(0),
  overallConfidence: int('overallConfidence').notNull().default(0), // 0-100
  
  // Session data (JSON)
  sessionData: text('sessionData'), // JSON serialized interview state
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp('completedAt'),
});

export const interviewHistory = mysqlTable('interview_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sessionId: varchar('sessionId', { length: 64 }).notNull(),
  cardId: varchar('cardId', { length: 64 }).notNull(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  
  // Question and response
  phase: int('phase').notNull(), // Which ATIS phase
  questionNumber: int('questionNumber').notNull(),
  question: text('question').notNull(),
  response: text('response').notNull(),
  
  // Validation results
  isValid: int('isValid').notNull(), // 0=false, 1=true
  validationScore: int('validationScore').notNull().default(0), // 0-100
  validationNotes: text('validationNotes'),
  
  // Confidence tracking
  confidenceScore: int('confidenceScore').notNull().default(0), // 0-100
  requiresEscalation: int('requiresEscalation').notNull().default(0), // 0=false, 1=true
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const interviewResults = mysqlTable('interview_results', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sessionId: varchar('sessionId', { length: 64 }).notNull(),
  cardId: varchar('cardId', { length: 64 }).notNull(),
  userId: int('userId').notNull(),
  userOpenId: varchar('userOpenId', { length: 64 }).notNull(),
  
  // Final results from all phases
  finalGoal: text('finalGoal'),
  finalDeliverable: text('finalDeliverable'),
  finalAPTLSSChecklist: text('finalAPTLSSChecklist'), // JSON
  
  // Confidence and quality metrics
  finalConfidence: int('finalConfidence').notNull().default(0), // 0-100
  clarityScore: int('clarityScore').notNull().default(0), // 0-100
  completenessScore: int('completenessScore').notNull().default(0), // 0-100
  
  // Execution plan
  executionPlan: text('executionPlan'), // JSON
  estimatedDuration: int('estimatedDuration'), // minutes
  
  // Quality metrics
  totalQuestionsAsked: int('totalQuestionsAsked').notNull().default(0),
  totalResponsesProvided: int('totalResponsesProvided').notNull().default(0),
  escalationsRequired: int('escalationsRequired').notNull().default(0),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
});

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type InsertInterviewSession = typeof interviewSessions.$inferInsert;
export type InterviewHistory = typeof interviewHistory.$inferSelect;
export type InsertInterviewHistory = typeof interviewHistory.$inferInsert;
export type InterviewResult = typeof interviewResults.$inferSelect;
export type InsertInterviewResult = typeof interviewResults.$inferInsert;

// ============================================
// ADVANCED SCHEDULING TABLES
// ============================================

// Task schedule history - track all rescheduling events
export const taskScheduleHistory = mysqlTable('task_schedule_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  taskId: varchar('taskId', { length: 128 }).notNull(),
  cardTrelloId: varchar('cardTrelloId', { length: 64 }),
  
  // Previous schedule
  previousStartTime: timestamp('previousStartTime'),
  previousEndTime: timestamp('previousEndTime'),
  
  // New schedule
  newStartTime: timestamp('newStartTime'),
  newEndTime: timestamp('newEndTime'),
  
  // Change details
  changedBy: varchar('changedBy', { length: 64 }).notNull(), // User openId
  reason: varchar('reason', { length: 255 }), // Why was it rescheduled?
  source: mysqlEnum('source', ['manual', 'auto', 'batch', 'conflict_resolution']).default('manual').notNull(),
  
  // Conflict info
  hadConflicts: int('hadConflicts').default(0).notNull(), // 0=false, 1=true
  conflictDetails: text('conflictDetails'), // JSON array of conflicts
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// Batch operations tracking
export const batchOperations = mysqlTable('batch_operations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('userId', { length: 64 }).notNull(), // User openId
  
  // Operation details
  operationType: mysqlEnum('operationType', ['re_analyze', 'reschedule', 'conflict_resolution', 'optimization']).notNull(),
  description: varchar('description', { length: 255 }),
  
  // Task scope
  totalTasks: int('totalTasks').notNull(),
  completedTasks: int('completedTasks').notNull().default(0),
  failedTasks: int('failedTasks').notNull().default(0),
  
  // Progress tracking
  status: mysqlEnum('status', ['pending', 'running', 'completed', 'failed', 'cancelled']).default('pending').notNull(),
  progress: decimal('progress', { precision: 5, scale: 2 }).default('0.00').notNull(), // 0-100%
  currentTaskIndex: int('currentTaskIndex').default(0),
  currentTaskName: varchar('currentTaskName', { length: 255 }),
  
  // Timing
  estimatedTimeSeconds: int('estimatedTimeSeconds'),
  elapsedTimeSeconds: int('elapsedTimeSeconds').default(0),
  
  // Results
  results: text('results'), // JSON with operation results
  errorLog: text('errorLog'), // JSON array of errors
  
  // Metadata
  parameters: text('parameters'), // JSON with operation parameters
  
  startedAt: timestamp('startedAt'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

// Keyboard shortcuts configuration
export const keyboardShortcuts = mysqlTable('keyboard_shortcuts', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('userId', { length: 64 }).notNull(), // User openId
  
  // Shortcut details
  shortcutKey: varchar('shortcutKey', { length: 50 }).notNull(), // e.g., 'Ctrl+D', 'Ctrl+R'
  action: varchar('action', { length: 100 }).notNull(), // e.g., 'open_calendar', 'batch_reanalyze'
  description: varchar('description', { length: 255 }),
  
  // Customization
  isCustom: int('isCustom').default(0).notNull(), // 0=default, 1=custom
  isEnabled: int('isEnabled').default(1).notNull(), // 0=disabled, 1=enabled
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type TaskScheduleHistory = typeof taskScheduleHistory.$inferSelect;
export type InsertTaskScheduleHistory = typeof taskScheduleHistory.$inferInsert;
export type BatchOperation = typeof batchOperations.$inferSelect;
export type InsertBatchOperation = typeof batchOperations.$inferInsert;
export type KeyboardShortcut = typeof keyboardShortcuts.$inferSelect;
export type InsertKeyboardShortcut = typeof keyboardShortcuts.$inferInsert;
