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
CREATE INDEX `aptlss_waiting_reasons_card_status_idx` ON `aptlss_waiting_reasons` (`cardId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `aptlss_waiting_reasons_follow_up_idx` ON `aptlss_waiting_reasons` (`status`,`followUpAt`);