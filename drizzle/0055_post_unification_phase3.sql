-- Post 統合フェーズ3: 旧テーブルの削除と、projects / ideas の作り直し。
--
-- drizzle-kit の生成結果から 1 箇所手を入れている。
-- 生成時点では ideas の再作成直後に PRAGMA foreign_keys=ON が入り、その後の
-- projects の作り直し（DROP TABLE projects）が FK 有効なまま実行されていた。
-- projects は versions など 12 テーブルから参照されているため、参照行がある
-- 本番ではここで FK 違反になる。ローカルは versions が空で通ってしまい気づけない。
-- そのため foreign_keys=ON はファイル末尾へ移動している。
DROP TABLE `idea_comments`;--> statement-breakpoint
DROP TABLE `idea_likes`;--> statement-breakpoint
DROP TABLE `project_comments`;--> statement-breakpoint
DROP TABLE `project_favorites`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ideas`("id", "status") SELECT "id", "status" FROM `ideas`;--> statement-breakpoint
DROP TABLE `ideas`;--> statement-breakpoint
ALTER TABLE `__new_ideas` RENAME TO `ideas`;--> statement-breakpoint
CREATE INDEX `ideas_status_idx` ON `ideas` (`status`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`icon_url` text,
	`type` text NOT NULL,
	`license` text NOT NULL,
	`source_url` text,
	`links` text,
	`downloads` integer DEFAULT 0 NOT NULL,
	`modrinth_id` text,
	`curseforge_id` text,
	`issue_tracker_url` text,
	`total_downloads` integer DEFAULT 0 NOT NULL,
	`external_downloads` text DEFAULT '{}' NOT NULL,
	`comments_enabled` integer DEFAULT false NOT NULL,
	`recipes_enabled` integer DEFAULT false NOT NULL,
	`recipe_namespaces` text DEFAULT '[]' NOT NULL,
	`source_idea_id` text,
	`github_repo` text,
	`discord_webhook_url` text,
	FOREIGN KEY (`id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "icon_url", "type", "license", "source_url", "links", "downloads", "modrinth_id", "curseforge_id", "issue_tracker_url", "total_downloads", "external_downloads", "comments_enabled", "recipes_enabled", "recipe_namespaces", "source_idea_id", "github_repo", "discord_webhook_url") SELECT "id", "icon_url", "type", "license", "source_url", "links", "downloads", "modrinth_id", "curseforge_id", "issue_tracker_url", "total_downloads", "external_downloads", "comments_enabled", "recipes_enabled", "recipe_namespaces", "source_idea_id", "github_repo", "discord_webhook_url" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE INDEX `projects_type_idx` ON `projects` (`type`);--> statement-breakpoint
CREATE INDEX `projects_downloads_idx` ON `projects` (`downloads`);--> statement-breakpoint
PRAGMA foreign_keys=ON;