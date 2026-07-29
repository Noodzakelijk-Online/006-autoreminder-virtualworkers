CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`founderId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`priority` enum('standard','priority','vip') NOT NULL DEFAULT 'standard',
	`trelloBoardIds` text,
	`contactEmail` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communication_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128),
	`fromUserId` int NOT NULL,
	`toUserId` int,
	`messageType` enum('question','decision','update','handoff','feedback') NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communication_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_briefings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`briefingDate` varchar(10) NOT NULL,
	`briefingType` enum('morning','end_of_day','weekly') NOT NULL,
	`content` text NOT NULL,
	`sentAt` timestamp,
	`sentTo` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_briefings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `founder_priority_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`founderId` int NOT NULL,
	`priority` enum('normal','high','urgent','drop_everything') NOT NULL DEFAULT 'normal',
	`reason` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `founder_priority_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handoff_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`fromVaId` int NOT NULL,
	`toVaId` int,
	`founderId` int NOT NULL,
	`whereLeftOff` text NOT NULL,
	`nextSteps` text,
	`blockers` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handoff_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`status` enum('pending_review','approved','needs_revision','rejected') NOT NULL DEFAULT 'pending_review',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`feedback` text,
	`revisionCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int NOT NULL,
	`status` enum('assigned','in_progress','completed','blocked','ready_for_review') NOT NULL DEFAULT 'assigned',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`blockedByTaskId` varchar(128) NOT NULL,
	`founderId` int NOT NULL,
	`dependencyType` enum('finish_to_start','start_to_start','finish_to_finish') NOT NULL DEFAULT 'finish_to_start',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_dependencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`durationMinutes` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `va_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`founderId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`timezone` varchar(50) NOT NULL DEFAULT 'Asia/Manila',
	`skills` text,
	`hourlyRate` int,
	`currency` varchar(3) DEFAULT 'USD',
	`workStartHour` int NOT NULL DEFAULT 9,
	`workEndHour` int NOT NULL DEFAULT 18,
	`workingDays` varchar(50) NOT NULL DEFAULT '1,2,3,4,5',
	`status` enum('active','inactive','on_leave') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `va_profiles_id` PRIMARY KEY(`id`)
);
