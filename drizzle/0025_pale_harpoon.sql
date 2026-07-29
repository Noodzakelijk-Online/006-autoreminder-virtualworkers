CREATE TABLE `shift_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vaId` int NOT NULL,
	`founderId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`shiftStart` varchar(5) NOT NULL,
	`shiftEnd` varchar(5) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shift_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `task_assignments` ADD `handoffNotes` text;--> statement-breakpoint
ALTER TABLE `task_assignments` ADD `lastWorkedAt` timestamp;--> statement-breakpoint
ALTER TABLE `task_assignments` ADD `decisionLog` text;--> statement-breakpoint
ALTER TABLE `task_assignments` ADD `externalLinks` text;