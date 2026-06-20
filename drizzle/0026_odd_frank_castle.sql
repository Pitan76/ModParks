PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`target_project_id` text,
	`external_url` text,
	`external_name` text,
	`dependency_type` text DEFAULT 'required' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_dependencies`("id", "project_id", "target_project_id", "external_url", "external_name", "dependency_type", "created_at") SELECT "id", "project_id", "target_project_id", "external_url", "external_name", "dependency_type", "created_at" FROM `project_dependencies`;--> statement-breakpoint
DROP TABLE `project_dependencies`;--> statement-breakpoint
ALTER TABLE `__new_project_dependencies` RENAME TO `project_dependencies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `project_deps_project_idx` ON `project_dependencies` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_deps_target_idx` ON `project_dependencies` (`target_project_id`);