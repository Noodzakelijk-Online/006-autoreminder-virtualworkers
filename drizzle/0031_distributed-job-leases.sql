CREATE TABLE `scheduled_job_leases` (
	`jobKey` varchar(96) NOT NULL,
	`ownerToken` varchar(64) NOT NULL,
	`acquiredAt` timestamp NOT NULL,
	`heartbeatAt` timestamp NOT NULL,
	`leaseExpiresAt` timestamp NOT NULL,
	CONSTRAINT `scheduled_job_leases_jobKey` PRIMARY KEY(`jobKey`)
);
--> statement-breakpoint
CREATE INDEX `scheduled_job_leases_expiry_idx` ON `scheduled_job_leases` (`leaseExpiresAt`);