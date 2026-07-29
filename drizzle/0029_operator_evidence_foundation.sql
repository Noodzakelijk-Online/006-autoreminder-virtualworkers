CREATE TABLE `aptlss_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL DEFAULT '',
	`engineVersion` varchar(32) NOT NULL,
	`contextHash` varchar(64) NOT NULL,
	`trigger` varchar(32) NOT NULL DEFAULT 'manual',
	`primaryState` varchar(64) NOT NULL,
	`stateReason` text NOT NULL,
	`secondarySignals` text NOT NULL,
	`actionability` varchar(32) NOT NULL,
	`priorityScore` int NOT NULL,
	`priorityTier` varchar(16) NOT NULL,
	`priorityBreakdown` text NOT NULL,
	`confidenceScore` int NOT NULL,
	`confidenceBand` varchar(16) NOT NULL,
	`confidenceReason` text NOT NULL,
	`evidenceCoverage` text NOT NULL,
	`evidenceJson` text NOT NULL,
	`intelligenceJson` text,
	`uncertaintiesJson` text NOT NULL,
	`recommendationsJson` text NOT NULL,
	`lastMeaningfulProgressAt` timestamp,
	`daysSinceMeaningfulProgress` int NOT NULL DEFAULT 0,
	`nextAssessmentAt` timestamp NOT NULL,
	`changeJson` text NOT NULL,
	`evaluationCount` int NOT NULL DEFAULT 1,
	`assessedAt` timestamp NOT NULL,
	`lastEvaluatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aptlss_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aptlss_assessments_card_assessed_idx` ON `aptlss_assessments` (`cardId`,`assessedAt`);
--> statement-breakpoint
CREATE INDEX `aptlss_assessments_next_idx` ON `aptlss_assessments` (`nextAssessmentAt`);
--> statement-breakpoint
CREATE TABLE `aptlss_assessment_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL DEFAULT '',
	`engineVersion` varchar(32) NOT NULL,
	`predictedState` varchar(64) NOT NULL,
	`predictedConfidence` int NOT NULL,
	`verdict` enum('accurate','partial','inaccurate') NOT NULL,
	`correctedState` varchar(64),
	`note` text,
	`createdBy` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aptlss_assessment_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `aptlss_assessment_feedback_assessment_idx` UNIQUE(`assessmentId`)
);
--> statement-breakpoint
CREATE INDEX `aptlss_assessment_feedback_card_created_idx` ON `aptlss_assessment_feedback` (`cardId`,`createdAt`);
--> statement-breakpoint
CREATE TABLE `aptlss_waiting_reasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL DEFAULT '',
	`cardUrl` varchar(1024) NOT NULL DEFAULT '',
	`boardName` varchar(256) NOT NULL DEFAULT '',
	`listName` varchar(256) NOT NULL DEFAULT '',
	`rawReason` text NOT NULL,
	`category` varchar(64) NOT NULL,
	`waitingOn` varchar(32) NOT NULL,
	`waitingOnName` varchar(256),
	`requestedItem` text,
	`nextAction` text NOT NULL,
	`nextStepType` varchar(64) NOT NULL,
	`followUpAt` timestamp,
	`followUpSource` varchar(32) NOT NULL,
	`urgency` varchar(16) NOT NULL,
	`requiresRobert` boolean NOT NULL DEFAULT false,
	`confidenceScore` int NOT NULL,
	`confidenceReason` text NOT NULL,
	`interpretationJson` text NOT NULL,
	`interpreterVersion` varchar(32) NOT NULL,
	`source` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`recordedBy` varchar(128) NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aptlss_waiting_reasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aptlss_waiting_reasons_card_status_idx` ON `aptlss_waiting_reasons` (`cardId`,`status`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `aptlss_waiting_reasons_follow_up_idx` ON `aptlss_waiting_reasons` (`status`,`followUpAt`);
--> statement-breakpoint
CREATE TABLE `decision_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stepId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL DEFAULT '',
	`cardUrl` varchar(1024) NOT NULL DEFAULT '',
	`boardName` varchar(256) NOT NULL DEFAULT '',
	`listName` varchar(256) NOT NULL DEFAULT '',
	`decisionPrompt` text NOT NULL,
	`recommendedDecision` text,
	`outcome` text NOT NULL,
	`resolvedBy` varchar(64) NOT NULL,
	`resolvedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_outcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `decision_outcomes_stepId_unique` UNIQUE(`stepId`)
);
--> statement-breakpoint
CREATE TABLE `workspace_evidence_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('gmail','google_drive','trello','communication') NOT NULL,
	`sourceId` varchar(256) NOT NULL,
	`sourceContainerId` varchar(256),
	`kind` varchar(128) NOT NULL DEFAULT 'record',
	`title` varchar(1024) NOT NULL,
	`summary` text,
	`content` text,
	`sourceUrl` varchar(2048),
	`mimeType` varchar(256),
	`modifiedAt` timestamp,
	`observedAt` timestamp NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`metadataJson` text,
	`reviewStatus` enum('unreviewed','linked','not_work_related') NOT NULL DEFAULT 'unreviewed',
	`reviewedAt` timestamp,
	`reviewedBy` varchar(128),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_evidence_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_evidence_source_id_unique` UNIQUE(`source`,`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `workspace_evidence_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` int NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`relevanceScore` int NOT NULL,
	`matchReason` varchar(512) NOT NULL,
	`linkMethod` enum('automatic','manual') NOT NULL DEFAULT 'automatic',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_evidence_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_evidence_link_unique` UNIQUE(`evidenceId`,`cardId`),
	CONSTRAINT `workspace_evidence_item_fk` FOREIGN KEY (`evidenceId`) REFERENCES `workspace_evidence_items`(`id`) ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_evidence_source_modified_idx` ON `workspace_evidence_items` (`source`,`modifiedAt`);
--> statement-breakpoint
CREATE INDEX `workspace_evidence_active_observed_idx` ON `workspace_evidence_items` (`active`,`observedAt`);
--> statement-breakpoint
CREATE INDEX `workspace_evidence_review_idx` ON `workspace_evidence_items` (`reviewStatus`,`modifiedAt`);
--> statement-breakpoint
CREATE INDEX `workspace_evidence_card_relevance_idx` ON `workspace_evidence_links` (`cardId`,`relevanceScore`);
--> statement-breakpoint
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
CREATE INDEX `communication_evidence_card_occurred_idx` ON `communication_evidence` (`linkedCardId`,`occurredAt`);
--> statement-breakpoint
CREATE INDEX `communication_evidence_response_idx` ON `communication_evidence` (`responseRequired`,`respondedAt`);
--> statement-breakpoint
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
CREATE INDEX `compliance_evidence_card_date_idx` ON `compliance_card_evidence` (`cardId`,`snapshotDate`);
--> statement-breakpoint
CREATE INDEX `compliance_evidence_date_compliant_idx` ON `compliance_card_evidence` (`snapshotDate`,`compliant`);
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
CREATE INDEX `compliance_comm_date_kind_outcome_idx` ON `compliance_communication_evidence` (`snapshotDate`,`kind`,`outcome`);
--> statement-breakpoint
CREATE INDEX `compliance_comm_external_idx` ON `compliance_communication_evidence` (`channel`,`externalId`);
--> statement-breakpoint
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
CREATE INDEX `compliance_clarification_status_requested_idx` ON `compliance_clarification_requests` (`status`,`requestedAt`);
--> statement-breakpoint
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
CREATE INDEX `time_day_reviews_status_date_idx` ON `time_day_reviews` (`status`,`dateKey`);
--> statement-breakpoint
CREATE INDEX `time_entry_events_entry_created_idx` ON `time_entry_events` (`timeEntryId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `time_entry_events_type_created_idx` ON `time_entry_events` (`eventType`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `time_reconciliation_date_status_idx` ON `time_reconciliation_items` (`dateKey`,`status`);
--> statement-breakpoint
CREATE INDEX `time_reconciliation_entry_idx` ON `time_reconciliation_items` (`timeEntryId`);
--> statement-breakpoint
CREATE TABLE `scheduled_job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(96) NOT NULL,
	`trigger` enum('cron','external','manual') NOT NULL DEFAULT 'cron',
	`status` enum('running','success','error','abandoned') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL,
	`finishedAt` timestamp,
	`durationMs` int,
	`recordsProcessed` int NOT NULL DEFAULT 0,
	`detail` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_job_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_job_started_idx` ON `scheduled_job_runs` (`jobKey`,`startedAt`);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_status_started_idx` ON `scheduled_job_runs` (`status`,`startedAt`);
--> statement-breakpoint
CREATE TABLE `scheduled_job_leases` (
	`jobKey` varchar(96) NOT NULL,
	`ownerToken` varchar(64) NOT NULL,
	`acquiredAt` timestamp NOT NULL,
	`heartbeatAt` timestamp NOT NULL,
	`leaseExpiresAt` timestamp NOT NULL,
	CONSTRAINT `scheduled_job_leases_jobKey` PRIMARY KEY(`jobKey`)
);
--> statement-breakpoint
CREATE INDEX `scheduled_job_leases_expiry_idx` ON `scheduled_job_leases` (`leaseExpiresAt`);
--> statement-breakpoint
CREATE TABLE `browser_tab_daily_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` date NOT NULL,
	`status` varchar(32) NOT NULL,
	`totalTabs` int NOT NULL DEFAULT 0,
	`actionableTabs` int NOT NULL DEFAULT 0,
	`allowedTabs` int NOT NULL DEFAULT 0,
	`compliant` boolean NOT NULL DEFAULT false,
	`source` varchar(32) NOT NULL DEFAULT 'auto',
	`evidenceJson` text NOT NULL,
	`capturedAt` timestamp,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browser_tab_daily_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `browser_tab_daily_evidence_snapshotDate_unique` UNIQUE(`snapshotDate`)
);
--> statement-breakpoint
CREATE TABLE `browser_tab_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectorId` varchar(128) NOT NULL,
	`collectorLabel` varchar(128) NOT NULL DEFAULT 'Joyce Chrome',
	`totalTabs` int NOT NULL DEFAULT 0,
	`pinnedTabs` int NOT NULL DEFAULT 0,
	`windowCount` int NOT NULL DEFAULT 0,
	`tabsJson` text NOT NULL,
	`capturedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browser_tab_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `browser_tab_states_collectorId_unique` UNIQUE(`collectorId`)
);
--> statement-breakpoint
CREATE INDEX `browser_tab_daily_status_date_idx` ON `browser_tab_daily_evidence` (`status`,`snapshotDate`);
--> statement-breakpoint
CREATE INDEX `browser_tab_states_captured_idx` ON `browser_tab_states` (`capturedAt`);
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageTotal` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageReplied` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageMissed` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `messageNeedsClarification` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailTotal` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailCompleted` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailMissed` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `emailNeedsClarification` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `clarificationOpen` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `trackedSeconds` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `scheduledTargetSeconds` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `overtimeSeconds` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `timeEntryCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `required` boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationStatus` varchar(24) DEFAULT 'unverified' NOT NULL;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationMethod` varchar(255);
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verificationCutoffAt` timestamp;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `verifiedAt` timestamp;
--> statement-breakpoint
ALTER TABLE `daily_compliance_snapshots` ADD `evidenceCount` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `source` varchar(32) DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `category` varchar(32) DEFAULT 'client_work' NOT NULL;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `planDateKey` varchar(16);
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `planBlockId` varchar(128);
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `aptlssStepId` int;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `isVoided` boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `voidedAt` timestamp;
--> statement-breakpoint
ALTER TABLE `time_entries` ADD `voidReason` text;
--> statement-breakpoint
CREATE INDEX `time_entries_period_idx` ON `time_entries` (`startTime`,`endTime`);
--> statement-breakpoint
CREATE INDEX `time_entries_plan_block_idx` ON `time_entries` (`planDateKey`,`planBlockId`);
--> statement-breakpoint
CREATE INDEX `time_entries_step_idx` ON `time_entries` (`aptlssStepId`);
--> statement-breakpoint
INSERT INTO `time_entry_events` (`timeEntryId`, `eventType`, `reason`, `metadataJson`, `createdAt`)
SELECT entry.`id`, 'legacy_import', 'Existing timer session imported into the immutable ledger', '{"source":"migration_0029"}', COALESCE(entry.`updatedAt`, entry.`createdAt`)
FROM `time_entries` entry
WHERE NOT EXISTS (SELECT 1 FROM `time_entry_events` event WHERE event.`timeEntryId` = entry.`id`);
