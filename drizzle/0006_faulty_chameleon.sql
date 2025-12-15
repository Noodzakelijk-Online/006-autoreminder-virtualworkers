CREATE TABLE `trello_cache_metadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`cacheKey` varchar(255) NOT NULL,
	`lastFetched` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`ttlSeconds` int NOT NULL DEFAULT 300,
	`hitCount` int NOT NULL DEFAULT 0,
	`missCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trello_cache_metadata_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trello_cached_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`boardId` varchar(64) NOT NULL,
	`boardData` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `trello_cached_boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trello_cached_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`boardId` varchar(64) NOT NULL,
	`cardId` varchar(64) NOT NULL,
	`cardData` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `trello_cached_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trello_cached_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`taskData` text NOT NULL,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `trello_cached_tasks_id` PRIMARY KEY(`id`)
);
