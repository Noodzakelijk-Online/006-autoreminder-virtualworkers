ALTER TABLE `user_working_hours` ADD `weeklyHoursMin` int DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_working_hours` ADD `weeklyHoursMax` int DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_working_hours` ADD `dailyHoursMin` decimal(4,2) DEFAULT '8.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_working_hours` ADD `dailyHoursMax` decimal(4,2) DEFAULT '9.00' NOT NULL;