CREATE TABLE `project_hidden_recipes` (
	`project_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`hidden_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`project_id`, `recipe_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hidden_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_hidden_recipes_project_idx` ON `project_hidden_recipes` (`project_id`);