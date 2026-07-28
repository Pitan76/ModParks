CREATE TABLE `ddos_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`state` text NOT NULL,
	`detail` text,
	`performed_by` text,
	`performed_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ddos_audit_action_idx` ON `ddos_audit` (`action`,`created_at`);