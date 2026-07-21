ALTER TABLE `idea_comments` ADD `content_format` text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `content_format` text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_comments` ADD `content_format` text DEFAULT 'markdown' NOT NULL;