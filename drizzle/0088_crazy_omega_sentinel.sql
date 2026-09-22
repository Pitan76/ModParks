CREATE TABLE `comment_translations` (
	`comment_id` text NOT NULL,
	`locale` text NOT NULL,
	`body` text NOT NULL,
	`body_format` text NOT NULL,
	`source_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`comment_id`, `locale`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `translation_runs` ADD `comment_id` text;