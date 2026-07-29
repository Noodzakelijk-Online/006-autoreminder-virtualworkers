CREATE TABLE `batch_operation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`defaultOperationType` varchar(50) NOT NULL DEFAULT 're_analyze',
	`defaultPriority` varchar(20) NOT NULL DEFAULT 'normal',
	`autoStartOnQueue` int NOT NULL DEFAULT 0,
	`maxConcurrentOperations` int NOT NULL DEFAULT 3,
	`retryFailedTasks` int NOT NULL DEFAULT 1,
	`maxRetries` int NOT NULL DEFAULT 2,
	`notifyOnCompletion` int NOT NULL DEFAULT 1,
	`notifyOnFailure` int NOT NULL DEFAULT 1,
	`version` int NOT NULL DEFAULT 1,
	`lastModified` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_operation_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conflict_detection_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`warningThresholdMinutes` int NOT NULL DEFAULT 15,
	`autoResolve` int NOT NULL DEFAULT 0,
	`notifyOnConflict` int NOT NULL DEFAULT 1,
	`conflictTypes` text NOT NULL DEFAULT ('{"timeOverlap":true,"resourceConflict":true,"dependencyConflict":true}'),
	`version` int NOT NULL DEFAULT 1,
	`lastModified` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conflict_detection_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyboard_shortcuts_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`shortcuts` text NOT NULL DEFAULT ('[]'),
	`version` int NOT NULL DEFAULT 1,
	`lastModified` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keyboard_shortcuts_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_metrics_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`totalOperations` int NOT NULL DEFAULT 0,
	`successfulOperations` int NOT NULL DEFAULT 0,
	`failedOperations` int NOT NULL DEFAULT 0,
	`averageExecutionTime` decimal(10,2) NOT NULL DEFAULT '0.00',
	`averageTasksPerOperation` decimal(10,2) NOT NULL DEFAULT '0.00',
	`conflictsDetected` int NOT NULL DEFAULT 0,
	`conflictsResolved` int NOT NULL DEFAULT 0,
	`trends` text NOT NULL DEFAULT ('{"successRate":0,"executionTimeTrend":"stable","operationsTrend":"stable"}'),
	`version` int NOT NULL DEFAULT 1,
	`lastModified` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `performance_metrics_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`settingsType` varchar(50) NOT NULL,
	`action` varchar(20) NOT NULL,
	`previousVersion` int,
	`newVersion` int,
	`deviceId` varchar(128),
	`clientVersion` varchar(20),
	`hadConflict` int NOT NULL DEFAULT 0,
	`conflictResolution` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settings_sync_log_id` PRIMARY KEY(`id`)
);
