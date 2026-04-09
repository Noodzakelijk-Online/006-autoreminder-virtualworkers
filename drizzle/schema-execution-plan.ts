import { mysqlTable, varchar, text, json, timestamp, int, enum as mysqlEnum, index, primaryKey } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ExecutionPlans table - stores execution plan metadata
export const executionPlans = mysqlTable('execution_plans', {
  id: varchar('id', { length: 255 }).primaryKey(),
  cardId: varchar('card_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  objective: text('objective').notNull(),
  inputs: json('inputs').$type<string[]>().notNull(),
  outputs: json('outputs').$type<string[]>().notNull(),
  stepsJson: json('steps_json').$type<any[]>().notNull(),
  iterationFlowsJson: json('iteration_flows_json').$type<any[]>().notNull(),
  totalEstimateMin: int('total_estimate_min').notNull(),
  totalEstimateMax: int('total_estimate_max').notNull(),
  generatedBy: mysqlEnum('generated_by', ['manual', 'ai']).notNull().default('manual'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  cardIdIdx: index('idx_card_id').on(table.cardId),
  userIdIdx: index('idx_user_id').on(table.userId),
}));

// ExecutionPlanSteps table - stores individual step statuses
export const executionPlanSteps = mysqlTable('execution_plan_steps', {
  id: varchar('id', { length: 255 }).primaryKey(),
  executionPlanId: varchar('execution_plan_id', { length: 255 }).notNull(),
  stepId: varchar('step_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  dependencies: json('dependencies').$type<string[]>().notNull(),
  parallelizable: int('parallelizable', { mode: 'boolean' }).notNull(),
  timeEstimateMin: int('time_estimate_min').notNull(),
  timeEstimateMax: int('time_estimate_max').notNull(),
  risks: json('risks').$type<string[]>().notNull(),
  status: mysqlEnum('status', ['completed', 'in-progress', 'ready', 'blocked']).notNull().default('ready'),
  completedBy: varchar('completed_by', { length: 255 }),
  completedAt: timestamp('completed_at'),
  startedAt: timestamp('started_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  planIdIdx: index('idx_plan_id').on(table.executionPlanId),
  statusIdx: index('idx_status').on(table.status),
  stepIdIdx: index('idx_step_id').on(table.stepId),
}));

// ExecutionPlanStatusHistory table - audit trail for status changes
export const executionPlanStatusHistory = mysqlTable('execution_plan_status_history', {
  id: varchar('id', { length: 255 }).primaryKey(),
  stepId: varchar('step_id', { length: 255 }).notNull(),
  executionPlanId: varchar('execution_plan_id', { length: 255 }).notNull(),
  previousStatus: mysqlEnum('previous_status', ['completed', 'in-progress', 'ready', 'blocked']).notNull(),
  newStatus: mysqlEnum('new_status', ['completed', 'in-progress', 'ready', 'blocked']).notNull(),
  changedBy: varchar('changed_by', { length: 255 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  planIdIdx: index('idx_history_plan_id').on(table.executionPlanId),
  stepIdIdx: index('idx_history_step_id').on(table.stepId),
  changedByIdx: index('idx_changed_by').on(table.changedBy),
}));

// Relations
export const executionPlansRelations = relations(executionPlans, ({ many }) => ({
  steps: many(executionPlanSteps),
  statusHistory: many(executionPlanStatusHistory),
}));

export const executionPlanStepsRelations = relations(executionPlanSteps, ({ one, many }) => ({
  plan: one(executionPlans, {
    fields: [executionPlanSteps.executionPlanId],
    references: [executionPlans.id],
  }),
  statusHistory: many(executionPlanStatusHistory),
}));

export const executionPlanStatusHistoryRelations = relations(executionPlanStatusHistory, ({ one }) => ({
  plan: one(executionPlans, {
    fields: [executionPlanStatusHistory.executionPlanId],
    references: [executionPlans.id],
  }),
  step: one(executionPlanSteps, {
    fields: [executionPlanStatusHistory.stepId],
    references: [executionPlanSteps.id],
  }),
}));
