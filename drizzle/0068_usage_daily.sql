CREATE TABLE `usage_daily` (
	`date` integer PRIMARY KEY NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`bot_requests` integer DEFAULT 0 NOT NULL,
	`bot_downloads` integer DEFAULT 0 NOT NULL,
	`downloads_counted` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ddos_slices` ADD `bot_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ddos_slices` ADD `bot_download_count` integer DEFAULT 0 NOT NULL;