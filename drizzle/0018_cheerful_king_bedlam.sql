CREATE TABLE `atis_analysis_sessions` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`status` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`currentPhase` int DEFAULT 3,
	`phasesCompleted` int DEFAULT 0,
	`sessionData` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atis_analysis_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `critical_path_analysis` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`criticalPath` text NOT NULL,
	`totalDurationHours` decimal(10,2) NOT NULL,
	`parallelizationOpportunities` int DEFAULT 0,
	`analysisData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `critical_path_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_mitigations` (
	`id` varchar(36) NOT NULL,
	`riskId` varchar(36) NOT NULL,
	`strategy` varchar(255) NOT NULL,
	`effort` varchar(50),
	`owner` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_mitigations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subtask_dependencies` (
	`id` varchar(36) NOT NULL,
	`subtaskId` varchar(36) NOT NULL,
	`dependsOnSubtaskId` varchar(36) NOT NULL,
	`dependencyType` enum('sequential','parallel','blocking') NOT NULL DEFAULT 'sequential',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subtask_dependencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_documentation_requirements` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`docType` varchar(100) NOT NULL,
	`audience` varchar(255),
	`estimatedEffort` decimal(10,2),
	`contentOutline` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_documentation_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_execution_plan` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`roadmap` text,
	`successMetrics` text,
	`communicationPlan` text,
	`escalationPath` text,
	`preExecutionChecklist` text,
	`aptlssChecklist` text,
	`confidenceScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_execution_plan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_external_dependencies` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`dependencyType` enum('approval','third_party','regulatory') NOT NULL,
	`description` text NOT NULL,
	`owner` varchar(255),
	`dueDate` varchar(10),
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_external_dependencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_milestones` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`dueDate` varchar(10) NOT NULL,
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_qa_strategy` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`strategy` text NOT NULL,
	`testingPhases` text,
	`qualityMetrics` text,
	`acceptanceCriteria` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_qa_strategy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_resource_requirements` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`resourceType` enum('skill','tool','training') NOT NULL,
	`resourceName` varchar(255) NOT NULL,
	`proficiencyLevel` enum('beginner','intermediate','expert'),
	`estimatedCost` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_resource_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_risks` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('technical','resource','schedule','external') NOT NULL,
	`probability` int NOT NULL,
	`impact` int NOT NULL,
	`priority` int NOT NULL,
	`status` enum('identified','mitigated','resolved') NOT NULL DEFAULT 'identified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_risks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_subtasks` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`estimatedHours` decimal(10,2),
	`sequence` int NOT NULL DEFAULT 0,
	`status` enum('pending','in_progress','completed','blocked') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_subtasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_timeline` (
	`id` varchar(36) NOT NULL,
	`taskId` varchar(128) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`bufferDays` int DEFAULT 0,
	`totalDays` int,
	`optimizationData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_timeline_id` PRIMARY KEY(`id`)
);
