import { pgTable, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const generationJobs = pgTable('generation_jobs', {
  id: text('id').primaryKey(),
  totalCards: integer('total_cards').notNull(),
  completedCards: integer('completed_cards').notNull().default(0),
  failedCards: integer('failed_cards').notNull().default(0),
  status: text('status').notNull(), // 'running' | 'paused' | 'completed' | 'failed'
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by').notNull(),
});

export const generationItems = pgTable('generation_items', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => generationJobs.id, { onDelete: 'cascade' }),
  cardId: text('card_id').notNull(),
  cardName: text('card_name').notNull(),
  boardName: text('board_name'),
  status: text('status').notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
