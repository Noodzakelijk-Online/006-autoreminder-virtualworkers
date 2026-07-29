CREATE TABLE `admin_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`syncType` varchar(32) NOT NULL,
	`success` boolean NOT NULL,
	`cardsProcessed` int NOT NULL DEFAULT 0,
	`actionsTaken` int NOT NULL DEFAULT 0,
	`cardsSkippedLowConfidence` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aptlss_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL DEFAULT '',
	`action` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`payload` text,
	`confidenceScore` int,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`approved` boolean,
	`source` varchar(32) NOT NULL DEFAULT 'maintenance_job',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aptlss_audit_log_id` PRIMARY KEY(`id`)
);
