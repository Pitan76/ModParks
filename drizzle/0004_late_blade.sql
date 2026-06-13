CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_categories` (
	`project_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `category_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_categories_project_idx` ON `project_categories` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_categories_category_idx` ON `project_categories` (`category_id`);--> statement-breakpoint
CREATE TABLE `version_loaders` (
	`version_id` text NOT NULL,
	`loader` text NOT NULL,
	PRIMARY KEY(`version_id`, `loader`),
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `version_loaders_version_idx` ON `version_loaders` (`version_id`);--> statement-breakpoint
CREATE INDEX `version_loaders_loader_idx` ON `version_loaders` (`loader`);--> statement-breakpoint
CREATE TABLE `version_mc_versions` (
	`version_id` text NOT NULL,
	`mc_version` text NOT NULL,
	PRIMARY KEY(`version_id`, `mc_version`),
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `version_mc_versions_version_idx` ON `version_mc_versions` (`version_id`);--> statement-breakpoint
CREATE INDEX `version_mc_versions_mc_version_idx` ON `version_mc_versions` (`mc_version`);--> statement-breakpoint
CREATE INDEX `projects_downloads_idx` ON `projects` (`downloads`);--> statement-breakpoint
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);