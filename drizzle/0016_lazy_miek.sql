CREATE TABLE `interview_history` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`phase` int NOT NULL,
	`questionNumber` int NOT NULL,
	`question` text NOT NULL,
	`response` text NOT NULL,
	`isValid` int NOT NULL,
	`validationScore` int NOT NULL DEFAULT 0,
	`validationNotes` text,
	`confidenceScore` int NOT NULL DEFAULT 0,
	`requiresEscalation` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interview_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_results` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`finalGoal` text,
	`finalDeliverable` text,
	`finalAPTLSSChecklist` text,
	`finalConfidence` int NOT NULL DEFAULT 0,
	`clarityScore` int NOT NULL DEFAULT 0,
	`completenessScore` int NOT NULL DEFAULT 0,
	`executionPlan` text,
	`estimatedDuration` int,
	`totalQuestionsAsked` int NOT NULL DEFAULT 0,
	`totalResponsesProvided` int NOT NULL DEFAULT 0,
	`escalationsRequired` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `interview_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
	`currentPhase` int NOT NULL DEFAULT 1,
	`currentQuestion` int NOT NULL DEFAULT 0,
	`preAnalysisSummary` text,
	`questionsAsked` int NOT NULL DEFAULT 0,
	`responsesProvided` int NOT NULL DEFAULT 0,
	`overallConfidence` int NOT NULL DEFAULT 0,
	`sessionData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `interview_sessions_id` PRIMARY KEY(`id`)
);
