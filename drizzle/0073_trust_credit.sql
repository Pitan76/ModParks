CREATE TABLE `trust_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`delta` integer NOT NULL,
	`decays` integer DEFAULT false NOT NULL,
	`subject_type` text DEFAULT 'none' NOT NULL,
	`subject_id` text DEFAULT '' NOT NULL,
	`reverses_event_id` text,
	`reason` text,
	`actor_email` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trust_events_subject_uniq` ON `trust_events` (`user_id`,`kind`,`subject_id`);--> statement-breakpoint
CREATE INDEX `trust_events_user_idx` ON `trust_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `trust_events_reverses_idx` ON `trust_events` (`reverses_event_id`);--> statement-breakpoint
CREATE TABLE `user_trust` (
	`user_id` text PRIMARY KEY NOT NULL,
	`score` integer DEFAULT 50 NOT NULL,
	`tier` text DEFAULT 'new' NOT NULL,
	`frozen` integer DEFAULT false NOT NULL,
	`tier_override` text,
	`tier_override_until` integer,
	`computed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_trust_computed_idx` ON `user_trust` (`computed_at`);--> statement-breakpoint
CREATE INDEX `user_trust_tier_idx` ON `user_trust` (`tier`);