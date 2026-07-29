ALTER TABLE `reply_monitor_status` ADD `upworkState` enum('never','running','success','error','disabled') DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkLastStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkLastSuccessfulAt` timestamp;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkRoomsScanned` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkPending` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkOverdue` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reply_monitor_status` ADD `upworkErrorMessage` text;