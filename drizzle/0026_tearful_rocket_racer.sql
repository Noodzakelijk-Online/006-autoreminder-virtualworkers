CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `card_snoozes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`snoozedAt` timestamp NOT NULL DEFAULT (now()),
	`snoozedUntil` date NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `card_snoozes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_card_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_card_updates_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_card_update_idx` UNIQUE(`vaId`,`cardId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `daily_compliance_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`snapshotDate` date NOT NULL,
	`onHoldTotal` int NOT NULL DEFAULT 0,
	`onHoldReviewed` int NOT NULL DEFAULT 0,
	`onHoldMissedCards` text,
	`doingTotal` int NOT NULL DEFAULT 0,
	`doingUpdated` int NOT NULL DEFAULT 0,
	`doingMissedCards` text,
	`d1Instances` int NOT NULL DEFAULT 0,
	`estimatedPenalty` decimal(8,2) NOT NULL DEFAULT '0.00',
	`source` varchar(16) NOT NULL DEFAULT 'auto',
	`weeklyPayLogId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_compliance_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_compliance_snapshot_idx` UNIQUE(`vaId`,`snapshotDate`)
);
--> statement-breakpoint
CREATE TABLE `daily_due_date_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_due_date_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_due_date_assign_idx` UNIQUE(`vaId`,`cardId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `daily_triage_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`triageDate` date NOT NULL,
	`step1Done` boolean NOT NULL DEFAULT false,
	`step2Done` boolean NOT NULL DEFAULT false,
	`step3Done` boolean NOT NULL DEFAULT false,
	`step4Done` boolean NOT NULL DEFAULT false,
	`step5Done` boolean NOT NULL DEFAULT false,
	`focusTasks` text,
	`eveningStep1Done` boolean NOT NULL DEFAULT false,
	`eveningStep2Done` boolean NOT NULL DEFAULT false,
	`eveningStep3Done` boolean NOT NULL DEFAULT false,
	`eveningStep4Done` boolean NOT NULL DEFAULT false,
	`eodReport` text,
	`currentView` varchar(32) NOT NULL DEFAULT 'overview',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_triage_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_triage_date_idx` UNIQUE(`vaId`,`triageDate`)
);
--> statement-breakpoint
CREATE TABLE `daily_update_streak` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`streakDate` date NOT NULL,
	`completedBeforeDeadline` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`doingCardCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_update_streak_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_streak_date_idx` UNIQUE(`vaId`,`streakDate`)
);
--> statement-breakpoint
CREATE TABLE `email_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`gmailMessageId` varchar(128) NOT NULL,
	`gmailThreadId` varchar(128) NOT NULL,
	`subject` varchar(1024) NOT NULL DEFAULT '(no subject)',
	`fromAddress` varchar(320) NOT NULL DEFAULT '',
	`fromName` varchar(256) NOT NULL DEFAULT '',
	`snippet` text,
	`receivedAt` timestamp NOT NULL,
	`category` enum('financial','non_financial') NOT NULL DEFAULT 'non_financial',
	`status` enum('pending','processed','archived') NOT NULL DEFAULT 'pending',
	`deadlineAt` timestamp,
	`trelloCardId` varchar(64),
	`trelloCardName` varchar(512),
	`trelloCardUrl` varchar(1024),
	`suggestedNextAction` text,
	`llmSummary` text,
	`processedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_tasks_gmailMessageId_unique` UNIQUE(`gmailMessageId`)
);
--> statement-breakpoint
CREATE TABLE `on_hold_daily_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`date` date NOT NULL,
	`checked` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `on_hold_daily_checks_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_on_hold_check_idx` UNIQUE(`vaId`,`cardId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `payment_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`founderId` int NOT NULL,
	`cycleStart` date NOT NULL,
	`cycleEnd` date NOT NULL,
	`baseAmount` decimal(8,2) NOT NULL DEFAULT '90.00',
	`isPaid` boolean NOT NULL DEFAULT false,
	`paidAt` timestamp,
	`paidBy` varchar(64),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reply_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`source` enum('trello','upwork') NOT NULL DEFAULT 'trello',
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`boardName` varchar(256) NOT NULL DEFAULT '',
	`listName` varchar(256) NOT NULL DEFAULT '',
	`lastNonJoyceMsgAt` timestamp NOT NULL,
	`lastNonJoyceAuthor` varchar(256) NOT NULL DEFAULT '',
	`lastNonJoyceText` text,
	`lastJoyceReplyAt` timestamp,
	`status` enum('pending','replied','overdue') NOT NULL DEFAULT 'pending',
	`demerited` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reply_threads_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_reply_thread_idx` UNIQUE(`vaId`,`cardId`,`source`)
);
--> statement-breakpoint
CREATE TABLE `sunday_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`sundayDate` date NOT NULL,
	`trelloArchived` boolean NOT NULL DEFAULT false,
	`trelloLabels` boolean NOT NULL DEFAULT false,
	`trelloDeadlines` boolean NOT NULL DEFAULT false,
	`trelloTimers` boolean NOT NULL DEFAULT false,
	`emailInbox` boolean NOT NULL DEFAULT false,
	`whatsappCleared` boolean NOT NULL DEFAULT false,
	`upworkArchived` boolean NOT NULL DEFAULT false,
	`downloadsCleared` boolean NOT NULL DEFAULT false,
	`desktopCleared` boolean NOT NULL DEFAULT false,
	`browserTabsClosed` boolean NOT NULL DEFAULT false,
	`weekReviewed` boolean NOT NULL DEFAULT false,
	`nextWeekPlanned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sunday_checklist_id` PRIMARY KEY(`id`),
	CONSTRAINT `va_sunday_date_idx` UNIQUE(`vaId`,`sundayDate`)
);
--> statement-breakpoint
CREATE TABLE `vague_reply_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`source` enum('trello','upwork') NOT NULL DEFAULT 'trello',
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`actionId` varchar(64) NOT NULL,
	`messageText` text NOT NULL,
	`flaggedAt` timestamp NOT NULL,
	`resolvedAt` timestamp,
	`resolvedBy` enum('manual','auto_demerit'),
	`demeritIssued` boolean NOT NULL DEFAULT false,
	`demeritIssuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vague_reply_flags_id` PRIMARY KEY(`id`),
	CONSTRAINT `vague_reply_flags_actionId_unique` UNIQUE(`actionId`)
);
--> statement-breakpoint
CREATE TABLE `weekly_pay_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`weekStart` date NOT NULL,
	`weekEnd` date NOT NULL,
	`paymentCycleId` int,
	`baseAmount` decimal(8,2) NOT NULL DEFAULT '90.00',
	`meritM1` decimal(8,2) NOT NULL DEFAULT '0.00',
	`meritM2` decimal(8,2) NOT NULL DEFAULT '0.00',
	`meritM3` decimal(8,2) NOT NULL DEFAULT '0.00',
	`meritStreak` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD1` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD2` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD3` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD4` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD5` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD6` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD7` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD8` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD9` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD10` decimal(8,2) NOT NULL DEFAULT '0.00',
	`demeritD11` decimal(8,2) NOT NULL DEFAULT '0.00',
	`totalMerits` decimal(8,2) NOT NULL DEFAULT '0.00',
	`totalDemerits` decimal(8,2) NOT NULL DEFAULT '0.00',
	`projectedPay` decimal(8,2) NOT NULL DEFAULT '90.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_pay_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `cardId` varchar(64);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `cardName` varchar(512);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `cardUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `boardName` varchar(256) DEFAULT 'Unknown Board';--> statement-breakpoint
ALTER TABLE `time_entries` ADD `listName` varchar(256) DEFAULT 'Unknown';--> statement-breakpoint
ALTER TABLE `time_entries` ADD `durationSeconds` int;