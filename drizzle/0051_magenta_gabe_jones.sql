CREATE TABLE `ddos_slices` (
	`slice_time` integer NOT NULL,
	`isolate_id` text NOT NULL,
	`request_count` integer NOT NULL,
	`download_count` integer NOT NULL,
	`unique_ip_count` integer NOT NULL,
	`unique_country_count` integer NOT NULL,
	`top_slug` text,
	`top_slug_count` integer,
	PRIMARY KEY(`slice_time`, `isolate_id`)
);
--> statement-breakpoint
CREATE TABLE `ddos_state` (
	`state_key` text PRIMARY KEY NOT NULL,
	`current_state` text NOT NULL,
	`attack_detected_at` integer NOT NULL,
	`under_attack_enabled_at` integer NOT NULL,
	`scheduled_disable_at` integer NOT NULL,
	`cooldown_until` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`protection_duration` integer NOT NULL,
	`last_normal_at` integer NOT NULL
);
