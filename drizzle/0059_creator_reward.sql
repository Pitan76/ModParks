CREATE TABLE `cost_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`category` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`recurring` integer DEFAULT false NOT NULL,
	`note` text,
	`recorded_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cost_entries_period_idx` ON `cost_entries` (`period`);--> statement-breakpoint
CREATE TABLE `payout_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`destination` text NOT NULL,
	`display_hint` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payout_methods_user_idx` ON `payout_methods` (`user_id`);--> statement-breakpoint
CREATE TABLE `payout_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`method_id` text NOT NULL,
	`points` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`fee_minor` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`external_ref` text,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`processed_at` integer,
	`processed_by_email` text,
	`reject_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`method_id`) REFERENCES `payout_methods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payout_requests_status_idx` ON `payout_requests` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `payout_requests_user_idx` ON `payout_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `point_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`lifetime_earned` integer DEFAULT 0 NOT NULL,
	`lifetime_spent` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`period_id` text,
	`payout_request_id` text,
	`reason` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_transactions_idempotency_key_unique` ON `point_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `point_transactions_user_idx` ON `point_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_metric_daily` (
	`project_id` text NOT NULL,
	`date` integer NOT NULL,
	`viewer_tier` text NOT NULL,
	`page_views` integer DEFAULT 0 NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`project_id`, `date`, `viewer_tier`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_metric_daily_date_idx` ON `project_metric_daily` (`date`);--> statement-breakpoint
CREATE TABLE `project_reward_shares` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`share_bps` integer NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `revenue_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`source` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`settled_at` integer NOT NULL,
	`currency` text DEFAULT 'JPY' NOT NULL,
	`note` text,
	`external_ref` text,
	`recorded_by_email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `revenue_entries_period_idx` ON `revenue_entries` (`period`,`source`);--> statement-breakpoint
CREATE INDEX `revenue_entries_external_ref_idx` ON `revenue_entries` (`external_ref`);--> statement-breakpoint
CREATE TABLE `revenue_pools` (
	`period_id` text NOT NULL,
	`source` text NOT NULL,
	`net_minor` integer DEFAULT 0 NOT NULL,
	`payout_ratio` real NOT NULL,
	`pool_minor` integer DEFAULT 0 NOT NULL,
	`allocation_metric` text NOT NULL,
	PRIMARY KEY(`period_id`, `source`),
	FOREIGN KEY (`period_id`) REFERENCES `reward_periods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reward_allocations` (
	`period_id` text NOT NULL,
	`user_id` text NOT NULL,
	`points` integer NOT NULL,
	`breakdown` text,
	PRIMARY KEY(`period_id`, `user_id`),
	FOREIGN KEY (`period_id`) REFERENCES `reward_periods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reward_allocations_user_idx` ON `reward_allocations` (`user_id`);--> statement-breakpoint
CREATE TABLE `reward_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`pool_total_minor` integer DEFAULT 0 NOT NULL,
	`carried_in_minor` integer DEFAULT 0 NOT NULL,
	`carried_out_minor` integer DEFAULT 0 NOT NULL,
	`weights` text,
	`calculated_at` integer,
	`approved_at` integer,
	`distributed_at` integer,
	`approved_by_email` text,
	`failure_reason` text
);
--> statement-breakpoint
CREATE INDEX `reward_periods_status_idx` ON `reward_periods` (`status`);--> statement-breakpoint
CREATE TABLE `reward_treasury` (
	`treasury_key` text PRIMARY KEY NOT NULL,
	`cash_minor` integer DEFAULT 0 NOT NULL,
	`reserve_minor` integer DEFAULT 0 NOT NULL,
	`liability_minor` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
