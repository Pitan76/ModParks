CREATE TABLE `settings_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`pr_url` text,
	`changed_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `settings_audit_scope_idx` ON `settings_audit` (`scope`,`created_at`);