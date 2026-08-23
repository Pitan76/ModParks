CREATE TABLE `trusted_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_devices_token_hash_unique` ON `trusted_devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `trusted_devices_user_idx` ON `trusted_devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `trusted_devices_token_idx` ON `trusted_devices` (`token_hash`);