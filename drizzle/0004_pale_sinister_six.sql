CREATE TABLE `daily_card_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_card_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_due_date_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_due_date_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_onhold_review` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`movedCards` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_onhold_review_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_onhold_review_date_unique` UNIQUE(`date`)
);
