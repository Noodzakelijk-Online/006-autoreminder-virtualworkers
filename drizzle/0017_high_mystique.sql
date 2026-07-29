CREATE TABLE `batch_operations` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`operationType` enum('re_analyze','reschedule','conflict_resolution','optimization') NOT NULL,
	`description` varchar(255),
	`totalTasks` int NOT NULL,
	`completedTasks` int NOT NULL DEFAULT 0,
	`failedTasks` int NOT NULL DEFAULT 0,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`progress` decimal(5,2) NOT NULL DEFAULT '0.00',
	`currentTaskIndex` int DEFAULT 0,
	`currentTaskName` varchar(255),
	`estimatedTimeSeconds` int,
	`elapsedTimeSeconds` int DEFAULT 0,
	`results` text,
	`errorLog` text,
	`parameters` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyboard_shortcuts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`shortcutKey` varchar(50) NOT NULL,
	`action` varchar(100) NOT NULL,
	`description` varchar(255),
	`isCustom` int NOT NULL DEFAULT 0,
	`isEnabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keyboard_shortcuts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_schedule_history` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`cardTrelloId` varchar(64),
	`previousStartTime` timestamp,
	`previousEndTime` timestamp,
	`newStartTime` timestamp,
	`newEndTime` timestamp,
	`changedBy` varchar(64) NOT NULL,
	`reason` varchar(255),
	`source` enum('manual','auto','batch','conflict_resolution') NOT NULL DEFAULT 'manual',
	`hadConflicts` int NOT NULL DEFAULT 0,
	`conflictDetails` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_schedule_history_id` PRIMARY KEY(`id`)
);
