ALTER TABLE `aptlss_plans` ADD CONSTRAINT `aptlss_plans_card_unique` UNIQUE(`cardId`);--> statement-breakpoint
ALTER TABLE `card_states` ADD CONSTRAINT `card_states_card_unique` UNIQUE(`cardId`);--> statement-breakpoint
ALTER TABLE `priority_scores` ADD CONSTRAINT `priority_scores_card_unique` UNIQUE(`cardId`);--> statement-breakpoint
CREATE INDEX `aptlss_steps_card_status_idx` ON `aptlss_steps` (`cardId`,`status`);--> statement-breakpoint
CREATE INDEX `aptlss_steps_robert_status_idx` ON `aptlss_steps` (`requiresRobert`,`status`);--> statement-breakpoint
CREATE INDEX `aptlss_steps_trello_item_idx` ON `aptlss_steps` (`trelloCheckItemId`);--> statement-breakpoint
CREATE INDEX `auto_follow_up_drafts_status_idx` ON `auto_follow_up_drafts` (`status`);--> statement-breakpoint
CREATE INDEX `card_states_state_idx` ON `card_states` (`state`);--> statement-breakpoint
CREATE INDEX `email_tasks_status_idx` ON `email_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `priority_scores_tier_score_idx` ON `priority_scores` (`tier`,`score`);--> statement-breakpoint
CREATE INDEX `reply_threads_status_idx` ON `reply_threads` (`status`);--> statement-breakpoint
CREATE INDEX `unsigned_message_flags_resolved_idx` ON `unsigned_message_flags` (`resolvedAt`);--> statement-breakpoint
CREATE INDEX `vague_reply_flags_resolved_idx` ON `vague_reply_flags` (`resolvedAt`);