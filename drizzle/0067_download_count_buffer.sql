CREATE TABLE `version_download_daily` (
	`version_id` text NOT NULL,
	`project_id` text NOT NULL,
	`date` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`synced_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`version_id`, `date`),
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `version_download_daily_date_idx` ON `version_download_daily` (`date`);