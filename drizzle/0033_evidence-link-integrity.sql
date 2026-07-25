ALTER TABLE `workspace_evidence_links` ADD CONSTRAINT `workspace_evidence_item_fk` FOREIGN KEY (`evidenceId`) REFERENCES `workspace_evidence_items`(`id`) ON DELETE cascade ON UPDATE cascade;
