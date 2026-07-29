import { pgTable, text, integer, timestamp, jsonb, serial } from 'drizzle-orm/pg-core';

export const scheduledJobs = pgTable('scheduled_jobs', {
  id: serial('id').primaryKey(),
  cardIds: jsonb('card_ids').notNull().$type<string[]>(),
  scheduledTime: timestamp('scheduled_time').notNull(),
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  settings: jsonb('settings').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  error: text('error')
});
