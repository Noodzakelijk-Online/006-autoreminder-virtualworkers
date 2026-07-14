ALTER TABLE `daily_compliance_snapshots` ADD `trackedSeconds` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `scheduledTargetSeconds` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `overtimeSeconds` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `timeEntryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `time_entries_period_idx` ON `time_entries` (`startedAt`,`stoppedAt`);