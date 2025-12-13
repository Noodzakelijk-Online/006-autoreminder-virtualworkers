ALTER TABLE `user_working_hours` ADD `workingDays` varchar(50) DEFAULT '1,2,3,4,5' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_working_hours` ADD `timezone` varchar(50) DEFAULT 'UTC' NOT NULL;