CREATE TABLE `daily_compliance_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	CONSTRAINT `daily_compliance_snapshots_snapshotDate_unique` UNIQUE(`snapshotDate`)
);
