ALTER TABLE `va_profiles`
  ADD COLUMN `trelloMemberId` varchar(64);
--> statement-breakpoint
CREATE INDEX `va_profiles_trello_member_idx` ON `va_profiles` (`trelloMemberId`);
--> statement-breakpoint
ALTER TABLE `reply_threads`
  ADD COLUMN `lastNonWorkerMsgAt` timestamp NULL,
  ADD COLUMN `lastNonWorkerAuthor` varchar(256) NOT NULL DEFAULT '',
  ADD COLUMN `lastNonWorkerText` text,
  ADD COLUMN `lastWorkerReplyAt` timestamp NULL;
--> statement-breakpoint
UPDATE `reply_threads`
SET
  `lastNonWorkerMsgAt` = `lastNonJoyceMsgAt`,
  `lastNonWorkerAuthor` = COALESCE(`lastNonJoyceAuthor`, ''),
  `lastNonWorkerText` = `lastNonJoyceText`,
  `lastWorkerReplyAt` = `lastJoyceReplyAt`
WHERE `lastNonWorkerMsgAt` IS NULL;
--> statement-breakpoint
ALTER TABLE `reply_threads`
  MODIFY COLUMN `lastNonWorkerMsgAt` timestamp NOT NULL;
--> statement-breakpoint
CREATE TABLE `unsigned_message_flags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `vaId` int NOT NULL,
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
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `unsigned_message_flags_id` PRIMARY KEY (`id`),
  CONSTRAINT `unsigned_message_flags_actionId_unique` UNIQUE (`actionId`)
);
