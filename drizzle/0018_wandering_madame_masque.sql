CREATE TABLE `collection_follows` (
	`user_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `collection_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_follows_user_idx` ON `collection_follows` (`user_id`);--> statement-breakpoint
CREATE INDEX `collection_follows_collection_idx` ON `collection_follows` (`collection_id`);--> statement-breakpoint
CREATE TABLE `project_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_comments_project_idx` ON `project_comments` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_comments_author_idx` ON `project_comments` (`author_id`);--> statement-breakpoint
CREATE TABLE `user_follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_follows_follower_idx` ON `user_follows` (`follower_id`);--> statement-breakpoint
CREATE INDEX `user_follows_following_idx` ON `user_follows` (`following_id`);--> statement-breakpoint
ALTER TABLE `collections` ADD `icon_url` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `visibility` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `modrinth_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `curseforge_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `issue_tracker_url` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `external_downloads` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `comments_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `source_idea_id` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `modrinth_api_key` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `curseforge_api_key` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `default_comments_enabled` integer DEFAULT false NOT NULL;