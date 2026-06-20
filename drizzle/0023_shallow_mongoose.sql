CREATE TABLE `project_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`target_project_id` text NOT NULL,
	`dependency_type` text DEFAULT 'required' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_deps_project_idx` ON `project_dependencies` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_deps_target_idx` ON `project_dependencies` (`target_project_id`);