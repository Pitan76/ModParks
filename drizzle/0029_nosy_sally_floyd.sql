CREATE INDEX `projects_created_at_idx` ON `projects` (`created_at`);--> statement-breakpoint
CREATE INDEX `versions_project_created_at_idx` ON `versions` (`project_id`,`created_at`);