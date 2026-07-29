ALTER TABLE `workspace_evidence_items` ADD `reviewStatus` enum('unreviewed','linked','not_work_related') DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace_evidence_items` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `workspace_evidence_items` ADD `reviewedBy` varchar(128);--> statement-breakpoint
UPDATE `workspace_evidence_items` AS `item`
SET `item`.`reviewStatus` = 'linked',
    `item`.`reviewedAt` = COALESCE(`item`.`reviewedAt`, `item`.`updatedAt`),
    `item`.`reviewedBy` = 'migration-existing-link'
WHERE EXISTS (
  SELECT 1 FROM `workspace_evidence_links` AS `link`
  WHERE `link`.`evidenceId` = `item`.`id`
);--> statement-breakpoint
CREATE INDEX `workspace_evidence_review_idx` ON `workspace_evidence_items` (`reviewStatus`,`modifiedAt`);
