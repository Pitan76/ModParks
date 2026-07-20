CREATE TABLE `backup_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`backup_key` text,
	`snapshot_key` text,
	`status` text NOT NULL,
	`detail` text,
	`performed_by` text,
	`performed_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backup_audit_action_idx` ON `backup_audit` (`action`,`created_at`);