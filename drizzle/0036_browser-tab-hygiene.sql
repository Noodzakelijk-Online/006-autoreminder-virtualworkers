CREATE TABLE `browser_tab_daily_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` date NOT NULL,
	`status` varchar(32) NOT NULL,
	`totalTabs` int NOT NULL DEFAULT 0,
	`actionableTabs` int NOT NULL DEFAULT 0,
	`allowedTabs` int NOT NULL DEFAULT 0,
	`compliant` boolean NOT NULL DEFAULT false,
	`source` varchar(32) NOT NULL DEFAULT 'auto',
	`evidenceJson` text NOT NULL,
	`capturedAt` timestamp,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browser_tab_daily_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `browser_tab_daily_evidence_snapshotDate_unique` UNIQUE(`snapshotDate`)
);
--> statement-breakpoint
CREATE TABLE `browser_tab_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectorId` varchar(128) NOT NULL,
	`collectorLabel` varchar(128) NOT NULL DEFAULT 'Joyce Chrome',
	`totalTabs` int NOT NULL DEFAULT 0,
	`pinnedTabs` int NOT NULL DEFAULT 0,
	`windowCount` int NOT NULL DEFAULT 0,
	`tabsJson` text NOT NULL,
	`capturedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browser_tab_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `browser_tab_states_collectorId_unique` UNIQUE(`collectorId`)
);
--> statement-breakpoint
CREATE INDEX `browser_tab_daily_status_date_idx` ON `browser_tab_daily_evidence` (`status`,`snapshotDate`);--> statement-breakpoint
CREATE INDEX `browser_tab_states_captured_idx` ON `browser_tab_states` (`capturedAt`);