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
ALTER TABLE `aptlss_assessments` ADD `intelligenceJson` text;--> statement-breakpoint
CREATE INDEX `aptlss_assessment_feedback_card_created_idx` ON `aptlss_assessment_feedback` (`cardId`,`createdAt`);