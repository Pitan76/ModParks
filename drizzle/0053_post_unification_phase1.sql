CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`content_format` text DEFAULT 'markdown' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_post_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `comments_author_idx` ON `comments` (`author_id`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorites_post_idx` ON `favorites` (`post_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_idx` ON `favorites` (`user_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`previous_slug` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`body_format` text DEFAULT 'markdown' NOT NULL,
	`visibility` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_kind_slug_unique` ON `posts` (`kind`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_kind_previous_slug_unique` ON `posts` (`kind`,`previous_slug`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_kind_visibility_created_idx` ON `posts` (`kind`,`visibility`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_updated_at_idx` ON `posts` (`updated_at`);