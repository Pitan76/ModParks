CREATE TABLE `developer_subscriptions` (
	`subscriber_id` text NOT NULL,
	`developer_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`subscriber_id`, `developer_id`),
	FOREIGN KEY (`subscriber_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`developer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `developer_subscriptions_developer_idx` ON `developer_subscriptions` (`developer_id`);--> statement-breakpoint
CREATE INDEX `developer_subscriptions_subscriber_idx` ON `developer_subscriptions` (`subscriber_id`);