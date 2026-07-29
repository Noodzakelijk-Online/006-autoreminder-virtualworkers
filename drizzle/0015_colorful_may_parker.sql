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
