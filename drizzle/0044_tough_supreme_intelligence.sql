CREATE TABLE `scan_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`version_id` text NOT NULL,
	`appellant_id` text NOT NULL,
	`reviewed_by_id` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appellant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scan_appeals_version_idx` ON `scan_appeals` (`version_id`);--> statement-breakpoint
CREATE INDEX `scan_appeals_status_idx` ON `scan_appeals` (`status`);--> statement-breakpoint
CREATE INDEX `scan_appeals_appellant_idx` ON `scan_appeals` (`appellant_id`);--> statement-breakpoint
ALTER TABLE `versions` ADD `scan_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `versions` ADD `scan_findings` text;--> statement-breakpoint
ALTER TABLE `versions` ADD `scan_at` integer;