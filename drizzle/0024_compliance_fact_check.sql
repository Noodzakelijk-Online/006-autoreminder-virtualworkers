CREATE TABLE `compliance_card_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` date NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`boardName` varchar(256) NOT NULL DEFAULT '',
	`listName` varchar(256) NOT NULL DEFAULT '',
	`category` varchar(16) NOT NULL,
	`assignedToJoyce` boolean NOT NULL DEFAULT true,
	`compliant` boolean NOT NULL DEFAULT false,
	`evidenceType` varchar(32) NOT NULL DEFAULT 'none',
	`evidenceActionId` varchar(64),
	`evidenceAt` timestamp,
	`evidenceJson` text NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_card_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `compliance_evidence_date_card_unique` UNIQUE(`snapshotDate`,`cardId`)
);
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `required` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationStatus` varchar(24) DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationCutoffAt` timestamp;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `evidenceCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `compliance_evidence_card_date_idx` ON `compliance_card_evidence` (`cardId`,`snapshotDate`);--> statement-breakpoint
CREATE INDEX `compliance_evidence_date_compliant_idx` ON `compliance_card_evidence` (`snapshotDate`,`compliant`);