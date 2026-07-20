CREATE TABLE `deleted_records` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_key` text NOT NULL,
	`deleted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deleted_records_lookup_idx` ON `deleted_records` (`table_name`,`record_key`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`pr_url` text,
	`changed_by` text NOT NULL,
	`changed_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
-- changed_by_email は今回の migration で新設する列のため、旧テーブルには存在しない。
-- drizzle-kit の生成そのままだと存在しない列を SELECT して失敗するので NULL で埋める。
INSERT INTO `__new_settings_audit`("id", "scope", "key", "old_value", "new_value", "pr_url", "changed_by", "changed_by_email", "created_at") SELECT "id", "scope", "key", "old_value", "new_value", "pr_url", "changed_by", NULL, "created_at" FROM `settings_audit`;--> statement-breakpoint
DROP TABLE `settings_audit`;--> statement-breakpoint
ALTER TABLE `__new_settings_audit` RENAME TO `settings_audit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `settings_audit_scope_idx` ON `settings_audit` (`scope`,`created_at`);