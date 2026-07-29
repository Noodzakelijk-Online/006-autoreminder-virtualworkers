CREATE TABLE `digest_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`notificationCount` int NOT NULL DEFAULT 0,
	`error` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digest_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`notificationType` enum('task_assigned','task_due_soon','task_overdue','task_completed','daily_digest','general') NOT NULL,
	`taskId` varchar(128),
	`taskName` varchar(500),
	`dueDate` timestamp,
	`channel` enum('in_app','email','both') NOT NULL,
	`deliveryStatus` enum('pending','sent','failed','queued_for_digest') NOT NULL DEFAULT 'pending',
	`deliveredAt` timestamp,
	`isRead` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_history_id` PRIMARY KEY(`id`)
);
