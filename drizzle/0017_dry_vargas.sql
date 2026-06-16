CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`bio` text,
	`links` text,
	`previous_username` text,
	`github_username` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_username_unique` ON `user_profiles` (`username`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'ja' NOT NULL,
	`default_project_status` text DEFAULT 'draft' NOT NULL,
	`default_license` text DEFAULT 'All Rights Reserved' NOT NULL,
	`custom` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `user_profiles` (`user_id`, `username`, `display_name`, `avatar_url`, `bio`, `links`, `previous_username`, `github_username`)
SELECT `id`, IFNULL(`username`, `id`), `display_name`, `avatar_url`, `bio`, `links`, `previous_username`, `github_username` FROM `users`;
--> statement-breakpoint
INSERT INTO `user_settings` (`user_id`, `locale`, `default_project_status`, `default_license`, `custom`)
SELECT `id`, `locale`, `default_project_status`, `default_license`, `custom` FROM `users`;
--> statement-breakpoint
DROP INDEX `users_username_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `display_name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `avatar_url`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `bio`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `locale`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `links`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `previous_username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `github_username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `custom`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `default_project_status`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `default_license`;