CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`display_text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`server_version` integer DEFAULT 0 NOT NULL,
	`accepted_op_id` text,
	`synced_at` text
);
--> statement-breakpoint
CREATE INDEX `diary_entries_owner_idx` ON `diary_entries` (`owner_id`);--> statement-breakpoint
CREATE TABLE `pending_ops` (
	`op_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_seq` integer NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`client_timestamp` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_ops_owner_seq_idx` ON `pending_ops` (`owner_id`,`owner_seq`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`owner_id` text NOT NULL,
	`stream` text NOT NULL,
	`pull_cursor` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_id`, `stream`)
);
