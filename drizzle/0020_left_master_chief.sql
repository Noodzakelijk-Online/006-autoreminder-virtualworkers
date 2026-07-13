CREATE TABLE `scheduled_job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(96) NOT NULL,
	`trigger` enum('cron','external','manual') NOT NULL DEFAULT 'cron',
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL,
	`finishedAt` timestamp,
	`durationMs` int,
	`recordsProcessed` int NOT NULL DEFAULT 0,
	`detail` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_job_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `unsigned_message_flags` MODIFY COLUMN `resolvedBy` enum('manual','auto_demerit','system');--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_job_started_idx` ON `scheduled_job_runs` (`jobKey`,`startedAt`);--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_status_started_idx` ON `scheduled_job_runs` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `time_entries_running_idx` ON `time_entries` (`stoppedAt`,`startedAt`);