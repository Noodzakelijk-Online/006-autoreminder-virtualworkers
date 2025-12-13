CREATE TABLE `scheduled_jobs` (
	`id` varchar(64) NOT NULL,
	`cardIds` text NOT NULL,
	`scheduledTime` timestamp NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`settings` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`error` text,
	`createdBy` varchar(64) NOT NULL,
	CONSTRAINT `scheduled_jobs_id` PRIMARY KEY(`id`)
);
