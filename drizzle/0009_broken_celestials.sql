CREATE TABLE `reply_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('trello','upwork') NOT NULL DEFAULT 'trello',
	`cardId` varchar(64) NOT NULL,
	`cardName` varchar(512) NOT NULL,
	`cardUrl` varchar(1024) NOT NULL,
	`boardName` varchar(256) NOT NULL DEFAULT '',
	`listName` varchar(256) NOT NULL DEFAULT '',
	`lastNonJoyceMsgAt` timestamp NOT NULL,
	`lastNonJoyceAuthor` varchar(256) NOT NULL DEFAULT '',
	`lastNonJoyceText` text,
	`lastJoyceReplyAt` timestamp,
	`status` enum('pending','replied','overdue') NOT NULL DEFAULT 'pending',
	`demerited` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reply_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vague_reply_flags` (
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
	`demeritIssued` boolean NOT NULL DEFAULT false,
	`demeritIssuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vague_reply_flags_id` PRIMARY KEY(`id`),
	CONSTRAINT `vague_reply_flags_actionId_unique` UNIQUE(`actionId`)
);
