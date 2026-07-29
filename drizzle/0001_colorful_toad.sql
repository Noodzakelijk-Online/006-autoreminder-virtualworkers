CREATE TABLE `generation_items` (
	`id` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` text NOT NULL,
	`boardName` varchar(255),
	`status` varchar(20) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`error` text,
	`result` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` varchar(64) NOT NULL,
	`totalCards` int NOT NULL,
	`completedCards` int NOT NULL DEFAULT 0,
	`failedCards` int NOT NULL DEFAULT 0,
	`status` varchar(20) NOT NULL,
	`settings` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdBy` varchar(64) NOT NULL,
	CONSTRAINT `generation_jobs_id` PRIMARY KEY(`id`)
);
