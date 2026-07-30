SET @operator_worker_id = COALESCE(
  (
    SELECT `id`
    FROM `users`
    WHERE `role` = 'worker'
    ORDER BY CASE WHEN LOWER(COALESCE(`name`, '')) = 'joyce' THEN 0 ELSE 1 END, `id`
    LIMIT 1
  ),
  0
);
--> statement-breakpoint
ALTER TABLE `aptlss_waiting_reasons`
  ADD COLUMN `vaId` int NULL AFTER `id`;
--> statement-breakpoint
UPDATE `aptlss_waiting_reasons`
SET `vaId` = @operator_worker_id
WHERE `vaId` IS NULL;
--> statement-breakpoint
ALTER TABLE `aptlss_waiting_reasons`
  MODIFY COLUMN `vaId` int NOT NULL;
--> statement-breakpoint
CREATE INDEX `aptlss_waiting_reasons_va_status_idx`
  ON `aptlss_waiting_reasons` (`vaId`, `status`, `createdAt`);
--> statement-breakpoint
ALTER TABLE `decision_outcomes`
  ADD COLUMN `vaId` int NULL AFTER `id`;
--> statement-breakpoint
UPDATE `decision_outcomes` AS `outcome`
LEFT JOIN `aptlss_steps` AS `step` ON `step`.`id` = `outcome`.`stepId`
SET `outcome`.`vaId` = COALESCE(`step`.`vaId`, @operator_worker_id)
WHERE `outcome`.`vaId` IS NULL;
--> statement-breakpoint
ALTER TABLE `decision_outcomes`
  MODIFY COLUMN `vaId` int NOT NULL;
--> statement-breakpoint
CREATE INDEX `decision_outcomes_va_resolved_idx`
  ON `decision_outcomes` (`vaId`, `resolvedAt`);
--> statement-breakpoint
ALTER TABLE `browser_tab_states`
  ADD COLUMN `vaId` int NULL AFTER `id`,
  ALTER COLUMN `collectorLabel` SET DEFAULT 'Worker browser';
--> statement-breakpoint
UPDATE `browser_tab_states`
SET `vaId` = @operator_worker_id
WHERE `vaId` IS NULL;
--> statement-breakpoint
ALTER TABLE `browser_tab_states`
  MODIFY COLUMN `vaId` int NOT NULL;
--> statement-breakpoint
CREATE INDEX `browser_tab_states_va_captured_idx`
  ON `browser_tab_states` (`vaId`, `capturedAt`);
--> statement-breakpoint
ALTER TABLE `browser_tab_daily_evidence`
  ADD COLUMN `vaId` int NULL AFTER `id`;
--> statement-breakpoint
UPDATE `browser_tab_daily_evidence`
SET `vaId` = @operator_worker_id
WHERE `vaId` IS NULL;
--> statement-breakpoint
ALTER TABLE `browser_tab_daily_evidence`
  MODIFY COLUMN `vaId` int NOT NULL,
  DROP INDEX `browser_tab_daily_evidence_snapshotDate_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `browser_tab_daily_va_date_idx`
  ON `browser_tab_daily_evidence` (`vaId`, `snapshotDate`);
--> statement-breakpoint
INSERT INTO `app_settings` (`vaId`, `key`, `value`)
SELECT
  @operator_worker_id,
  CONCAT(`key`, ':', @operator_worker_id),
  `value`
FROM `app_settings`
WHERE `key` IN ('browserTabPolicy', 'browserTabCollectorToken')
  AND @operator_worker_id > 0
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `vaId` = VALUES(`vaId`);
