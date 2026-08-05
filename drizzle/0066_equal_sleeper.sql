CREATE TABLE `reports_new` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text DEFAULT 'project' NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reporter_id` text NOT NULL,
	`project_id` text,
	`idea_id` text,
	`comment_id` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `reports_new` ("id", "target_type", "reason", "detail", "status", "reporter_id", "project_id", "idea_id", "comment_id", "user_id", "created_at") SELECT "id", 'project', "reason", "detail", "status", "reporter_id", "project_id", NULL, NULL, NULL, "created_at" FROM `reports`;--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `reports_new` RENAME TO `reports`;--> statement-breakpoint
CREATE INDEX `reports_reporter_idx` ON `reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `reports_project_idx` ON `reports` (`project_id`);--> statement-breakpoint
CREATE INDEX `reports_idea_idx` ON `reports` (`idea_id`);--> statement-breakpoint
CREATE INDEX `reports_comment_idx` ON `reports` (`comment_id`);--> statement-breakpoint
CREATE INDEX `reports_user_idx` ON `reports` (`user_id`);
