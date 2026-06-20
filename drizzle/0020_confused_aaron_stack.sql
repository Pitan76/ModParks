ALTER TABLE `projects` ADD `previous_slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_previous_slug_unique` ON `projects` (`previous_slug`);