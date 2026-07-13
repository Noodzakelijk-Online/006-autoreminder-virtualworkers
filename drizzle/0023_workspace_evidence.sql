CREATE TABLE `workspace_evidence_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('gmail','google_drive','trello') NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_evidence_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_evidence_link_unique` UNIQUE(`evidenceId`,`cardId`)
);
--> statement-breakpoint
CREATE INDEX `workspace_evidence_source_modified_idx` ON `workspace_evidence_items` (`source`,`modifiedAt`);--> statement-breakpoint
CREATE INDEX `workspace_evidence_active_observed_idx` ON `workspace_evidence_items` (`active`,`observedAt`);--> statement-breakpoint
CREATE INDEX `workspace_evidence_card_relevance_idx` ON `workspace_evidence_links` (`cardId`,`relevanceScore`);