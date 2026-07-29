ALTER TABLE `execution_plans` ADD `qualityScore` int DEFAULT 85;--> statement-breakpoint
ALTER TABLE `execution_plans` ADD `validationStatus` enum('initial','validated','needs_review','quality_check_failed') DEFAULT 'initial';--> statement-breakpoint
ALTER TABLE `execution_plans` ADD `qualityFeedback` text;