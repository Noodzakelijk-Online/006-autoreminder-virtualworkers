CREATE TABLE `holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(2) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `holidays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_working_hours` ADD `country` varchar(2) DEFAULT 'US' NOT NULL;