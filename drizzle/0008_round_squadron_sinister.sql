ALTER TABLE `va_profiles` ADD `breakfastTime` int;--> statement-breakpoint
ALTER TABLE `va_profiles` ADD `breakfastDuration` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `va_profiles` ADD `lunchTime` int DEFAULT 12;--> statement-breakpoint
ALTER TABLE `va_profiles` ADD `lunchDuration` int DEFAULT 60;--> statement-breakpoint
ALTER TABLE `va_profiles` ADD `dinnerTime` int;--> statement-breakpoint
ALTER TABLE `va_profiles` ADD `dinnerDuration` int DEFAULT 0;