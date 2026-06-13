CREATE INDEX `idea_comments_idea_idx` ON `idea_comments` (`idea_id`);--> statement-breakpoint
CREATE INDEX `idea_comments_author_idx` ON `idea_comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `idea_likes_idea_idx` ON `idea_likes` (`idea_id`);--> statement-breakpoint
CREATE INDEX `idea_likes_user_idx` ON `idea_likes` (`user_id`);--> statement-breakpoint
CREATE INDEX `ideas_author_idx` ON `ideas` (`author_id`);--> statement-breakpoint
CREATE INDEX `ideas_status_idx` ON `ideas` (`status`);--> statement-breakpoint
CREATE INDEX `project_tags_project_idx` ON `project_tags` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_author_idx` ON `projects` (`author_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_type_idx` ON `projects` (`type`);--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `reports_project_idx` ON `reports` (`project_id`);--> statement-breakpoint
CREATE INDEX `version_ideas_version_idx` ON `version_ideas` (`version_id`);--> statement-breakpoint
CREATE INDEX `version_ideas_idea_idx` ON `version_ideas` (`idea_id`);--> statement-breakpoint
CREATE INDEX `versions_project_idx` ON `versions` (`project_id`);