CREATE TABLE `post_translations` (
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`body_format` text NOT NULL,
	`state` text NOT NULL,
	`source_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`post_id`, `locale`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_translations_locale_idx` ON `post_translations` (`locale`);--> statement-breakpoint
CREATE TABLE `translation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_chars` integer NOT NULL,
	`output_chars` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `translation_runs_user_created_idx` ON `translation_runs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `translation_runs_post_locale_created_idx` ON `translation_runs` (`post_id`,`locale`,`created_at`);--> statement-breakpoint
CREATE INDEX `translation_runs_created_idx` ON `translation_runs` (`created_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `source_locale` text DEFAULT 'ja' NOT NULL;