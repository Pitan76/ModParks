CREATE TABLE `moderation_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text,
	`performed_by` text NOT NULL,
	`performed_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_audit_action_idx` ON `moderation_audit` (`action`,`created_at`);