CREATE TABLE `github_installations` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_login` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
