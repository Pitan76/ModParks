-- drizzle-kit の ADD COLUMN は ON DELETE を落とすため、手で補っている。
-- 付けないとバージョン削除が外部キー違反で失敗する（依存行が残るため）。
ALTER TABLE `project_dependencies` ADD `version_id` text REFERENCES versions(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `project_deps_version_idx` ON `project_dependencies` (`version_id`);
