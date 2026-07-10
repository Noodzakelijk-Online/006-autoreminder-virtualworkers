DELETE older FROM `reply_threads` older
INNER JOIN `reply_threads` newer
  ON older.`source` = newer.`source`
 AND older.`cardId` = newer.`cardId`
 AND older.`id` < newer.`id`;
--> statement-breakpoint
ALTER TABLE `reply_threads`
  ADD CONSTRAINT `reply_threads_source_card_unique` UNIQUE (`source`, `cardId`);
--> statement-breakpoint
CREATE TABLE `unsigned_message_flags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `source` enum('trello','upwork') NOT NULL DEFAULT 'trello',
  `cardId` varchar(64) NOT NULL,
  `cardName` varchar(512) NOT NULL,
  `cardUrl` varchar(1024) NOT NULL,
  `actionId` varchar(64) NOT NULL,
  `messageText` text NOT NULL,
  `flaggedAt` timestamp NOT NULL,
  `resolvedAt` timestamp,
  `resolvedBy` enum('manual','auto_demerit'),
  `resolutionNote` text,
  `demeritIssued` boolean NOT NULL DEFAULT false,
  `demeritIssuedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `unsigned_message_flags_id` PRIMARY KEY (`id`),
  CONSTRAINT `unsigned_message_flags_actionId_unique` UNIQUE (`actionId`)
);
--> statement-breakpoint
CREATE TABLE `reply_monitor_status` (
  `id` int NOT NULL DEFAULT 1,
  `state` enum('never','running','success','error') NOT NULL DEFAULT 'never',
  `lastStartedAt` timestamp,
  `lastCompletedAt` timestamp,
  `lastSuccessfulAt` timestamp,
  `threadsScanned` int NOT NULL DEFAULT 0,
  `errorMessage` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `reply_monitor_status_id` PRIMARY KEY (`id`)
);
