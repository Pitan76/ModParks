ALTER TABLE `users` ADD `default_project_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `default_license` text DEFAULT 'All Rights Reserved' NOT NULL;