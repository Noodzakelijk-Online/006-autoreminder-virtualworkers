CREATE TABLE `user_notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`notificationMode` enum('disabled','daily_digest','priority_only') NOT NULL DEFAULT 'priority_only',
	`digestTime` varchar(5) NOT NULL DEFAULT '08:00',
	`digestTimezone` varchar(50) NOT NULL DEFAULT 'Europe/Amsterdam',
	`urgentThresholdHours` int NOT NULL DEFAULT 24,
	`emailEnabled` int NOT NULL DEFAULT 1,
	`emailAddress` varchar(320),
	`inAppEnabled` int NOT NULL DEFAULT 1,
	`lastDigestSent` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_notification_preferences_userOpenId_unique` UNIQUE(`userOpenId`)
);
