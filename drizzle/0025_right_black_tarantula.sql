PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`previous_slug` text,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon_url` text,
	`type` text NOT NULL,
	`license` text NOT NULL,
	`source_url` text,
	`links` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_id` text NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`modrinth_id` text,
	`curseforge_id` text,
	`issue_tracker_url` text,
	`total_downloads` integer DEFAULT 0 NOT NULL,
	`external_downloads` text DEFAULT '{}' NOT NULL,
	`comments_enabled` integer DEFAULT false NOT NULL,
	`source_idea_id` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "slug", "previous_slug", "name", "description", "icon_url", "type", "license", "source_url", "links", "status", "author_id", "downloads", "created_at", "updated_at", "modrinth_id", "curseforge_id", "issue_tracker_url", "total_downloads", "external_downloads", "comments_enabled", "source_idea_id") SELECT "id", "slug", "previous_slug", "name", "description", "icon_url", "type", "license", "source_url", "links", "status", "author_id", "downloads", "created_at", "updated_at", "modrinth_id", "curseforge_id", "issue_tracker_url", ("downloads" + coalesce("external_downloads", 0) + coalesce("modrinth_downloads", 0) + coalesce("curseforge_downloads", 0)), CASE WHEN coalesce("modrinth_downloads", 0) > 0 OR coalesce("curseforge_downloads", 0) > 0 THEN json_object('modrinth', "modrinth_downloads", 'curseforge', "curseforge_downloads") ELSE '{}' END, "comments_enabled", "source_idea_id" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_previous_slug_unique` ON `projects` (`previous_slug`);--> statement-breakpoint
CREATE INDEX `projects_author_idx` ON `projects` (`author_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_type_idx` ON `projects` (`type`);--> statement-breakpoint
CREATE INDEX `projects_downloads_idx` ON `projects` (`downloads`);--> statement-breakpoint
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);