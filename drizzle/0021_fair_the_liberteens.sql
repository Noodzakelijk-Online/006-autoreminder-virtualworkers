DELETE duplicate
FROM `weekly_pay_log` AS duplicate
INNER JOIN `weekly_pay_log` AS keeper
  ON duplicate.`weekStart` = keeper.`weekStart`
  AND duplicate.`id` < keeper.`id`;
--> statement-breakpoint
ALTER TABLE `weekly_pay_log` ADD CONSTRAINT `weekly_pay_log_weekStart_unique` UNIQUE(`weekStart`);
