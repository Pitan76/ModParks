-- Post 統合フェーズ3: 旧テーブルの削除と、projects / ideas の作り直し。
--
-- ⚠ drizzle-kit の生成結果をそのまま使ってはいけない。必ずこの注意書きを読むこと。
--
-- 【問題】
-- SQLite でテーブル定義を変える標準手順は
--   PRAGMA foreign_keys=OFF → 新テーブル作成 → コピー → DROP 旧 → RENAME
-- だが、PRAGMA foreign_keys は「トランザクション内では no-op」という仕様がある。
-- D1 のマイグレーションはトランザクション内で実行されるため PRAGMA は無視され、
-- FK が有効なまま DROP TABLE projects が走る。
-- DROP TABLE は暗黙の DELETE FROM を伴うので ON DELETE CASCADE が発火し、
-- projects を参照している 10 テーブルの行が巻き添えで全消滅する。
--
-- 実際に本番相当データ（versions 25 / project_tags 111 / project_dependencies 22 …）で
-- 検証したところ、これらが軒並み 0 行になった。
--
-- 【試して駄目だったもの】
--   PRAGMA foreign_keys=OFF      … トランザクション内なので無視される
--   PRAGMA legacy_alter_table=ON … 同様に無視され、FK 参照名が壊れたテーブルを指す
--   PRAGMA defer_foreign_keys=ON … 制約チェックは遅延するがカスケード動作は止まらない
--   wrangler d1 execute --file / --command 分割 … いずれもバッチ＝トランザクション
--
-- 【採用した方法】
-- カスケードを止められないので、消えることを前提に「退避 → 再作成 → 復元」する。
-- 退避先は FK を持たない素のテーブルなのでカスケードの影響を受けない。
-- すべて同一マイグレーション（＝同一トランザクション）内で完結するため、
-- 途中で失敗しても全体がロールバックされ、中途半端な状態は残らない。

-- ---- 1. 統合済みの旧テーブルを削除 ----
-- これらは posts/comments/favorites へ移送済み。他から参照されていないので単純に消せる。
DROP TABLE `idea_comments`;--> statement-breakpoint
DROP TABLE `idea_likes`;--> statement-breakpoint
DROP TABLE `project_comments`;--> statement-breakpoint
DROP TABLE `project_favorites`;--> statement-breakpoint

-- ---- 2. カスケードで消える行を退避 ----
-- CREATE TABLE ... AS SELECT で作った表は FK を持たないため、カスケードの影響を受けない。
CREATE TABLE `__bak_versions` AS SELECT * FROM `versions`;--> statement-breakpoint
CREATE TABLE `__bak_project_tags` AS SELECT * FROM `project_tags`;--> statement-breakpoint
CREATE TABLE `__bak_project_categories` AS SELECT * FROM `project_categories`;--> statement-breakpoint
CREATE TABLE `__bak_project_members` AS SELECT * FROM `project_members`;--> statement-breakpoint
CREATE TABLE `__bak_project_media` AS SELECT * FROM `project_media`;--> statement-breakpoint
CREATE TABLE `__bak_project_hidden_recipes` AS SELECT * FROM `project_hidden_recipes`;--> statement-breakpoint
CREATE TABLE `__bak_project_dependencies` AS SELECT * FROM `project_dependencies`;--> statement-breakpoint
CREATE TABLE `__bak_project_subscriptions` AS SELECT * FROM `project_subscriptions`;--> statement-breakpoint
CREATE TABLE `__bak_collection_items` AS SELECT * FROM `collection_items`;--> statement-breakpoint
CREATE TABLE `__bak_reports` AS SELECT * FROM `reports`;--> statement-breakpoint
CREATE TABLE `__bak_version_ideas` AS SELECT * FROM `version_ideas`;--> statement-breakpoint

-- ---- 3. ideas の作り直し ----
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

-- ---- 4. projects の作り直し ----
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
INSERT INTO `__new_projects`("id", "icon_url", "type", "license", "source_url", "links", "downloads", "modrinth_id", "curseforge_id", "issue_tracker_url", "total_downloads", "external_downloads", "comments_enabled", "recipes_enabled", "recipe_namespaces", "source_idea_id", "github_repo", "discord_webhook_url")
SELECT "id", "icon_url", "type", "license", "source_url", "links", "downloads", "modrinth_id", "curseforge_id", "issue_tracker_url", "total_downloads", "external_downloads", "comments_enabled", "recipes_enabled", "recipe_namespaces", "source_idea_id", "github_repo", "discord_webhook_url"
FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE INDEX `projects_type_idx` ON `projects` (`type`);--> statement-breakpoint
CREATE INDEX `projects_downloads_idx` ON `projects` (`downloads`);--> statement-breakpoint

-- ---- 5. 退避した行を復元 ----
-- この時点で projects / ideas は新スキーマかつ全 id が揃っているため、FK 検証を通る。
INSERT INTO `versions` SELECT * FROM `__bak_versions`;--> statement-breakpoint
INSERT INTO `project_tags` SELECT * FROM `__bak_project_tags`;--> statement-breakpoint
INSERT INTO `project_categories` SELECT * FROM `__bak_project_categories`;--> statement-breakpoint
INSERT INTO `project_members` SELECT * FROM `__bak_project_members`;--> statement-breakpoint
INSERT INTO `project_media` SELECT * FROM `__bak_project_media`;--> statement-breakpoint
INSERT INTO `project_hidden_recipes` SELECT * FROM `__bak_project_hidden_recipes`;--> statement-breakpoint
INSERT INTO `project_dependencies` SELECT * FROM `__bak_project_dependencies`;--> statement-breakpoint
INSERT INTO `project_subscriptions` SELECT * FROM `__bak_project_subscriptions`;--> statement-breakpoint
INSERT INTO `collection_items` SELECT * FROM `__bak_collection_items`;--> statement-breakpoint
INSERT INTO `reports` SELECT * FROM `__bak_reports`;--> statement-breakpoint
INSERT INTO `version_ideas` SELECT * FROM `__bak_version_ideas`;--> statement-breakpoint

-- ---- 6. 退避テーブルを片付ける ----
DROP TABLE `__bak_versions`;--> statement-breakpoint
DROP TABLE `__bak_project_tags`;--> statement-breakpoint
DROP TABLE `__bak_project_categories`;--> statement-breakpoint
DROP TABLE `__bak_project_members`;--> statement-breakpoint
DROP TABLE `__bak_project_media`;--> statement-breakpoint
DROP TABLE `__bak_project_hidden_recipes`;--> statement-breakpoint
DROP TABLE `__bak_project_dependencies`;--> statement-breakpoint
DROP TABLE `__bak_project_subscriptions`;--> statement-breakpoint
DROP TABLE `__bak_collection_items`;--> statement-breakpoint
DROP TABLE `__bak_reports`;--> statement-breakpoint
DROP TABLE `__bak_version_ideas`;
