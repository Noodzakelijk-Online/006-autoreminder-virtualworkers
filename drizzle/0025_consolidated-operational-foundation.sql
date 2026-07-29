CREATE TABLE `communication_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` varchar(64) NOT NULL,
	`externalId` varchar(256) NOT NULL,
	`threadId` varchar(256),
	`direction` enum('inbound','outbound','system','unknown') NOT NULL DEFAULT 'unknown',
	`sender` varchar(512),
	`recipientsJson` text,
	`subject` varchar(1024),
	`summary` text,
	`occurredAt` timestamp NOT NULL,
	`responseRequired` boolean NOT NULL DEFAULT false,
	`respondedAt` timestamp,
	`linkedCardId` varchar(64),
	`evidenceItemId` int,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communication_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `communication_evidence_channel_external_unique` UNIQUE(`channel`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `handoff_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateKey` date NOT NULL,
	`handoffType` enum('end_of_day','shift','manual') NOT NULL DEFAULT 'end_of_day',
	`status` enum('draft','reviewed','sent','superseded') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`content` text NOT NULL,
	`checklistJson` text NOT NULL,
	`sourcePlanJson` text,
	`reviewedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handoff_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `handoff_records_date_type_version_unique` UNIQUE(`dateKey`,`handoffType`,`version`)
);
--> statement-breakpoint
CREATE TABLE `operating_holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateKey` date NOT NULL,
	`name` varchar(256) NOT NULL,
	`kind` enum('holiday','leave','exceptional_workday') NOT NULL DEFAULT 'holiday',
	`source` enum('manual','calendar','policy') NOT NULL DEFAULT 'manual',
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operating_holidays_id` PRIMARY KEY(`id`),
	CONSTRAINT `operating_holidays_date_name_unique` UNIQUE(`dateKey`,`name`)
);
--> statement-breakpoint
CREATE TABLE `operating_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileKey` varchar(64) NOT NULL DEFAULT 'joyce',
	`timezone` varchar(64) NOT NULL DEFAULT 'Africa/Nairobi',
	`workStart` varchar(5) NOT NULL DEFAULT '08:00',
	`workEnd` varchar(5) NOT NULL DEFAULT '23:00',
	`workingDaysJson` text NOT NULL,
	`breaksJson` text NOT NULL,
	`weeklyHoursMin` int NOT NULL DEFAULT 50,
	`weeklyHoursMax` int NOT NULL DEFAULT 55,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operating_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `operating_profiles_key_unique` UNIQUE(`profileKey`)
);
--> statement-breakpoint
CREATE TABLE `operator_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(1200) NOT NULL,
	`content` text NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'operational',
	`deliveryStatus` enum('pending','delivered','skipped','failed') NOT NULL DEFAULT 'pending',
	`provider` varchar(64) NOT NULL DEFAULT 'local',
	`providerReference` varchar(512),
	`errorMessage` text,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operator_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_contexts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectKey` varchar(128) NOT NULL,
	`name` varchar(512) NOT NULL,
	`clientName` varchar(512),
	`priority` enum('standard','priority','vip') NOT NULL DEFAULT 'standard',
	`boardIdsJson` text NOT NULL,
	`contactEmail` varchar(320),
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_contexts_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_contexts_key_unique` UNIQUE(`projectKey`)
);
--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`dependsOnCardId` varchar(64) NOT NULL,
	`dependencyType` enum('finish_to_start','start_to_start','finish_to_finish') NOT NULL DEFAULT 'finish_to_start',
	`status` enum('active','resolved','invalid') NOT NULL DEFAULT 'active',
	`source` enum('manual','aptlss','trello') NOT NULL DEFAULT 'aptlss',
	`evidenceJson` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_dependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_dependencies_edge_unique` UNIQUE(`cardId`,`dependsOnCardId`)
);
--> statement-breakpoint
ALTER TABLE `workspace_evidence_items` MODIFY COLUMN `source` enum('gmail','google_drive','trello','communication') NOT NULL;--> statement-breakpoint
CREATE INDEX `communication_evidence_card_occurred_idx` ON `communication_evidence` (`linkedCardId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `communication_evidence_response_idx` ON `communication_evidence` (`responseRequired`,`respondedAt`);--> statement-breakpoint
CREATE INDEX `handoff_records_date_status_idx` ON `handoff_records` (`dateKey`,`status`);--> statement-breakpoint
CREATE INDEX `operating_holidays_date_active_idx` ON `operating_holidays` (`dateKey`,`active`);--> statement-breakpoint
CREATE INDEX `operator_notifications_status_created_idx` ON `operator_notifications` (`deliveryStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operator_notifications_read_created_idx` ON `operator_notifications` (`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `project_contexts_active_priority_idx` ON `project_contexts` (`active`,`priority`);--> statement-breakpoint
CREATE INDEX `task_dependencies_target_status_idx` ON `task_dependencies` (`dependsOnCardId`,`status`);--> statement-breakpoint
CREATE INDEX `task_dependencies_card_status_idx` ON `task_dependencies` (`cardId`,`status`);