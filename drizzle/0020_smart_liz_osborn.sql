CREATE TABLE `execution_plan_status_history` (
	`id` varchar(255) NOT NULL,
	`stepId` varchar(255) NOT NULL,
	`executionPlanId` varchar(255) NOT NULL,
	`previousStatus` enum('completed','in-progress','ready','blocked') NOT NULL,
	`newStatus` enum('completed','in-progress','ready','blocked') NOT NULL,
	`changedBy` int NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `execution_plan_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_plan_steps` (
	`id` varchar(255) NOT NULL,
	`executionPlanId` varchar(255) NOT NULL,
	`stepId` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`dependencies` text NOT NULL,
	`parallelizable` int NOT NULL DEFAULT 0,
	`timeEstimateMin` int NOT NULL,
	`timeEstimateMax` int NOT NULL,
	`risks` text NOT NULL,
	`status` enum('completed','in-progress','ready','blocked') NOT NULL DEFAULT 'ready',
	`completedBy` varchar(255),
	`completedAt` timestamp,
	`startedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_plan_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_plans` (
	`id` varchar(255) NOT NULL,
	`cardId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`objective` text NOT NULL,
	`inputs` text NOT NULL,
	`outputs` text NOT NULL,
	`stepsJson` text NOT NULL,
	`iterationFlowsJson` text NOT NULL,
	`totalEstimateMin` int NOT NULL,
	`totalEstimateMax` int NOT NULL,
	`generatedBy` enum('manual','ai') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_plans_id` PRIMARY KEY(`id`)
);
