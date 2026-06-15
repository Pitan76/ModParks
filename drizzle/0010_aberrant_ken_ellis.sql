ALTER TABLE `projects` ADD `links` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locale` text DEFAULT 'ja' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `links` text;