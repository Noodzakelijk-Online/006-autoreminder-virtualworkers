CREATE TABLE `compliance_clarification_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` date NOT NULL,
	`evidenceKey` varchar(256) NOT NULL,
	`kind` enum('message_response','email_processing') NOT NULL,
	`channel` varchar(64) NOT NULL,
	`externalId` varchar(256) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`question` text NOT NULL,
	`status` enum('open','resolved','superseded') NOT NULL DEFAULT 'open',
	`resolution` enum('completed','not_completed','not_required'),
	`response` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`resolvedAt` timestamp,
	`sourceJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_clarification_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `compliance_clarification_date_key_unique` UNIQUE(`snapshotDate`,`evidenceKey`)
);
--> statement-breakpoint
CREATE TABLE `compliance_communication_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` date NOT NULL,
	`evidenceKey` varchar(256) NOT NULL,
	`kind` enum('message_response','email_processing') NOT NULL,
	`channel` varchar(64) NOT NULL,
	`externalId` varchar(256) NOT NULL,
	`title` varchar(1024) NOT NULL,
	`sourceUrl` varchar(1024),
	`occurredAt` timestamp NOT NULL,
	`dueAt` timestamp,
	`outcome` enum('verified','missed','needs_clarification','excluded') NOT NULL,
	`evidenceType` varchar(64) NOT NULL,
	`evidenceAt` timestamp,
	`evidenceJson` text NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_communication_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `compliance_comm_date_key_unique` UNIQUE(`snapshotDate`,`evidenceKey`)
);
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageTotal` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageReplied` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageMissed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageNeedsClarification` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailTotal` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailCompleted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailMissed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailNeedsClarification` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `clarificationOpen` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `compliance_clarification_status_requested_idx` ON `compliance_clarification_requests` (`status`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `compliance_comm_date_kind_outcome_idx` ON `compliance_communication_evidence` (`snapshotDate`,`kind`,`outcome`);--> statement-breakpoint
CREATE INDEX `compliance_comm_external_idx` ON `compliance_communication_evidence` (`channel`,`externalId`);