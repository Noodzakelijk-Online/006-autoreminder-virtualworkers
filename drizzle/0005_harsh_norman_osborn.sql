CREATE TABLE `daily_update_streak` (
	`id` int AUTO_INCREMENT NOT NULL,
	`streakDate` date NOT NULL,
	`completedBeforeDeadline` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`doingCardCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_update_streak_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_update_streak_streakDate_unique` UNIQUE(`streakDate`)
);
