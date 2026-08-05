CREATE TABLE `usage_rollup_state` (
	`state_key` text PRIMARY KEY NOT NULL,
	`last_slice_time` integer NOT NULL,
	`updated_at` integer NOT NULL
);
