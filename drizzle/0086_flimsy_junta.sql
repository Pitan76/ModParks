CREATE TABLE `idea_tags` (
	`idea_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`idea_id`, `tag`),
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idea_tags_idea_idx` ON `idea_tags` (`idea_id`);--> statement-breakpoint
ALTER TABLE `ideas` ADD `mc_versions` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `loaders` text;