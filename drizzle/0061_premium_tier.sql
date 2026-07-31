ALTER TABLE `users` ADD `premium_tier` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `premium_until` integer;