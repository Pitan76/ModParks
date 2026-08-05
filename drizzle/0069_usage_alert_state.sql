CREATE TABLE `usage_alert_state` (
	`period_key` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`notified_at` integer NOT NULL
);
