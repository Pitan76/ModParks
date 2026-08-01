ALTER TABLE `user_settings` ADD `default_idea_status` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `default_recipes_enabled` integer DEFAULT false NOT NULL;