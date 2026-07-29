CREATE TABLE `time_day_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateKey` varchar(16) NOT NULL,
	`status` enum('open','needs_review','locked') NOT NULL DEFAULT 'open',
	`overtimeReason` text,
	`summaryJson` text,
	`lockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_day_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `time_day_reviews_dateKey_unique` UNIQUE(`dateKey`)
);
--> statement-breakpoint
CREATE TABLE `time_entry_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeEntryId` int NOT NULL,
	`eventType` varchar(32) NOT NULL,
	`reason` text,
	`beforeJson` text,
	`afterJson` text,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_entry_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_reconciliation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dateKey` varchar(16) NOT NULL,
	`fingerprint` varchar(256) NOT NULL,
	`type` varchar(48) NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','resolved','dismissed','superseded') NOT NULL DEFAULT 'open',
	`cardId` varchar(64),
	`cardName` varchar(512),
	`cardUrl` varchar(1024),
	`boardName` varchar(256),
	`listName` varchar(256),
	`timeEntryId` int,
	`planBlockId` varchar(128),
	`title` varchar(512) NOT NULL,
	`detail` text NOT NULL,
	`sourceJson` text NOT NULL,
	`resolution` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_reconciliation_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `time_reconciliation_items_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `source` varchar(32) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `category` varchar(32) DEFAULT 'client_work' NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `planDateKey` varchar(16);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `planBlockId` varchar(128);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `aptlssStepId` int;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `isVoided` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `voidReason` text;--> statement-breakpoint
CREATE INDEX `time_day_reviews_status_date_idx` ON `time_day_reviews` (`status`,`dateKey`);--> statement-breakpoint
CREATE INDEX `time_entry_events_entry_created_idx` ON `time_entry_events` (`timeEntryId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `time_entry_events_type_created_idx` ON `time_entry_events` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `time_reconciliation_date_status_idx` ON `time_reconciliation_items` (`dateKey`,`status`);--> statement-breakpoint
CREATE INDEX `time_reconciliation_entry_idx` ON `time_reconciliation_items` (`timeEntryId`);--> statement-breakpoint
CREATE INDEX `time_entries_plan_block_idx` ON `time_entries` (`planDateKey`,`planBlockId`);--> statement-breakpoint
CREATE INDEX `time_entries_step_idx` ON `time_entries` (`aptlssStepId`);
--> statement-breakpoint
INSERT INTO `time_entry_events` (`timeEntryId`, `eventType`, `reason`, `metadataJson`, `createdAt`)
SELECT entry.`id`, 'legacy_import', 'Existing timer session imported into the immutable ledger', '{"source":"migration_0028"}', COALESCE(entry.`updatedAt`, entry.`createdAt`)
FROM `time_entries` entry
WHERE NOT EXISTS (SELECT 1 FROM `time_entry_events` event WHERE event.`timeEntryId` = entry.`id`);
