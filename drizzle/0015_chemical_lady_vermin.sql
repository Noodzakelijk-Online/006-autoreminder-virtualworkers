CREATE TABLE `chatbot_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`totalCommands` int NOT NULL DEFAULT 0,
	`statusCommands` int NOT NULL DEFAULT 0,
	`checkinCommands` int NOT NULL DEFAULT 0,
	`remindCommands` int NOT NULL DEFAULT 0,
	`timeCommands` int NOT NULL DEFAULT 0,
	`progressCommands` int NOT NULL DEFAULT 0,
	`helpCommands` int NOT NULL DEFAULT 0,
	`unknownCommands` int NOT NULL DEFAULT 0,
	`successfulResponses` int NOT NULL DEFAULT 0,
	`failedResponses` int NOT NULL DEFAULT 0,
	`avgResponseTimeMs` int,
	`checkinsSent` int NOT NULL DEFAULT 0,
	`checkinsResponded` int NOT NULL DEFAULT 0,
	`avgCheckinResponseMinutes` int,
	`uniqueWorkers` int NOT NULL DEFAULT 0,
	`uniqueCards` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_checkin_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`cardTrelloId` varchar(64) NOT NULL,
	`workerTrelloId` varchar(64),
	`workerName` varchar(255),
	`workerId` int,
	`responseCommentId` varchar(64),
	`responseText` text,
	`reportedProgress` text,
	`reportedBlockers` text,
	`estimatedCompletion` varchar(100),
	`checkinSentAt` timestamp NOT NULL,
	`responseReceivedAt` timestamp NOT NULL,
	`responseTimeMinutes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatbot_checkin_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardTrelloId` varchar(64) NOT NULL,
	`cardName` varchar(500),
	`boardTrelloId` varchar(64),
	`command` varchar(50) NOT NULL,
	`commandArgs` text,
	`authorTrelloId` varchar(64),
	`authorName` varchar(255),
	`incomingCommentId` varchar(64),
	`responseCommentId` varchar(64),
	`responseText` text,
	`responseStatus` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`responseError` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`responseTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatbot_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trelloWebhookId` varchar(64) NOT NULL,
	`modelId` varchar(64) NOT NULL,
	`modelType` enum('board','workspace') NOT NULL DEFAULT 'board',
	`description` varchar(255),
	`callbackUrl` varchar(512) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`lastEventAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_webhooks_id` PRIMARY KEY(`id`),
	CONSTRAINT `chatbot_webhooks_trelloWebhookId_unique` UNIQUE(`trelloWebhookId`)
);
