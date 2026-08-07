CREATE TABLE `project_recipe_names` (
	`project_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`custom_name` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`project_id`, `recipe_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_recipe_names_project_idx` ON `project_recipe_names` (`project_id`);