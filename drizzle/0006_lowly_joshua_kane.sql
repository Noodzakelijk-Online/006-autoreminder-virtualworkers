CREATE TABLE `on_hold_daily_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`checked` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `on_hold_daily_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`boardName` varchar(256) NOT NULL DEFAULT 'Unknown Board',
	`listName` varchar(256) NOT NULL DEFAULT 'Unknown',
	`startedAt` timestamp NOT NULL,
	`stoppedAt` timestamp,
	`durationSeconds` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `daily_onhold_review`;