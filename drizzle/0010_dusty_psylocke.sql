CREATE TABLE `atis_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloId` varchar(64) NOT NULL,
	`cardId` int NOT NULL,
	`cardTrelloId` varchar(64) NOT NULL,
	`filename` varchar(512),
	`mimeType` varchar(128),
	`fileType` varchar(32),
	`url` varchar(1024),
	`bytes` int,
	`extractionStatus` enum('pending','processing','success','failed','unreadable') NOT NULL DEFAULT 'pending',
	`extractedContent` text,
	`extractionError` text,
	`extractedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atis_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloId` varchar(64) NOT NULL,
	`workspaceId` int,
	`workspaceTrelloId` varchar(64),
	`name` varchar(255) NOT NULL,
	`url` varchar(512),
	`isOpen` int DEFAULT 1,
	`cardCount` int DEFAULT 0,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `atis_boards_trelloId_unique` UNIQUE(`trelloId`)
);
--> statement-breakpoint
CREATE TABLE `atis_card_understanding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`cardTrelloId` varchar(64) NOT NULL,
	`goal` text,
	`deliverable` text,
	`taskType` varchar(64),
	`entities` text,
	`deadlines` text,
	`estimatedMinutes` int,
	`dependencies` text,
	`produces` text,
	`domain` varchar(128),
	`complexity` enum('simple','medium','complex') DEFAULT 'medium',
	`clarityScore` int,
	`missingInfo` text,
	`confidenceScore` int,
	`status` enum('pending','processing','complete','needs_review','insufficient_info') NOT NULL DEFAULT 'pending',
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_card_understanding_id` PRIMARY KEY(`id`),
	CONSTRAINT `atis_card_understanding_cardId_unique` UNIQUE(`cardId`),
	CONSTRAINT `atis_card_understanding_cardTrelloId_unique` UNIQUE(`cardTrelloId`)
);
--> statement-breakpoint
CREATE TABLE `atis_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloId` varchar(64) NOT NULL,
	`boardId` int NOT NULL,
	`boardTrelloId` varchar(64) NOT NULL,
	`listName` varchar(255),
	`listId` varchar(64),
	`name` varchar(512) NOT NULL,
	`description` text,
	`url` varchar(512),
	`dueDate` timestamp,
	`dueComplete` int DEFAULT 0,
	`isArchived` int DEFAULT 0,
	`isClosed` int DEFAULT 0,
	`labels` text,
	`memberIds` text,
	`checklistCount` int DEFAULT 0,
	`attachmentCount` int DEFAULT 0,
	`commentCount` int DEFAULT 0,
	`rawData` text,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `atis_cards_trelloId_unique` UNIQUE(`trelloId`)
);
--> statement-breakpoint
CREATE TABLE `atis_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloId` varchar(64) NOT NULL,
	`cardId` int NOT NULL,
	`cardTrelloId` varchar(64) NOT NULL,
	`authorId` varchar(64),
	`authorName` varchar(255),
	`text` text NOT NULL,
	`commentDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atis_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atis_ingestion_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('full_sync','incremental','workspace','board','card') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`targetId` varchar(64),
	`totalItems` int DEFAULT 0,
	`processedItems` int DEFAULT 0,
	`failedItems` int DEFAULT 0,
	`errorLog` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `atis_ingestion_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `atis_workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayName` varchar(255),
	`url` varchar(512),
	`boardCount` int DEFAULT 0,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `atis_workspaces_trelloId_unique` UNIQUE(`trelloId`)
);
