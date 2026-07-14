CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE TABLE `project_subscriptions` (
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `project_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_subscriptions_project_idx` ON `project_subscriptions` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_subscriptions_user_idx` ON `project_subscriptions` (`user_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `discord_webhook_url` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `notification_prefs` text;