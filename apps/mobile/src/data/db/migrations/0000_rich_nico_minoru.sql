CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`detail` text,
	`earned_at` DATETIME,
	`progress` integer DEFAULT 0 NOT NULL,
	`target` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`basis` text NOT NULL,
	`kcal` integer NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real NOT NULL,
	`serving_grams` integer,
	`created_at` DATETIME NOT NULL,
	CONSTRAINT "custom_foods_basis_check" CHECK("custom_foods"."basis" IN ('per100g', 'per_serving'))
);
--> statement-breakpoint
CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_text` text NOT NULL,
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` DATETIME,
	`server_version` integer DEFAULT 0 NOT NULL,
	`accepted_op_id` text,
	`server_updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `diary_entries_user_version_idx` ON `diary_entries` (`user_id`,`server_version`);--> statement-breakpoint
CREATE TABLE `diary_entry_details` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`meal_slot` text NOT NULL,
	`title` text NOT NULL,
	`grams` integer,
	`kcal` integer,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`fiber_g` real,
	`confidence` real,
	`hidden_fat_likely` BOOLEAN DEFAULT false NOT NULL,
	`source` text,
	`unresolved` BOOLEAN DEFAULT false NOT NULL,
	`scan_id` text,
	CONSTRAINT "diary_entry_details_slot_check" CHECK("diary_entry_details"."meal_slot" IN ('breakfast', 'lunch', 'dinner', 'snacks', 'exercise'))
);
--> statement-breakpoint
CREATE TABLE `exercise_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`exercise_type` text NOT NULL,
	`duration_min` integer NOT NULL,
	`kcal_burned` integer,
	`created_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`per100g_kcal` integer NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real NOT NULL,
	`serving_grams` integer,
	`is_custom` BOOLEAN DEFAULT false NOT NULL,
	`created_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE TABLE `insights` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_ops` (
	`op_id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`snapshot` text NOT NULL,
	`client_timestamp` DATETIME NOT NULL,
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`dispatch_attempts` integer DEFAULT 0 NOT NULL,
	`next_retry_at` DATETIME,
	`quarantined` BOOLEAN DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pending_ops_due_idx` ON `pending_ops` (`next_retry_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `saved_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text,
	`kcal` integer NOT NULL,
	`items_json` text NOT NULL,
	`created_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE TABLE `streak_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`freezes_left` integer DEFAULT 1 NOT NULL,
	`freeze_used_on` text,
	`last_logged_day` text,
	CONSTRAINT "streak_state_id_check" CHECK("streak_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`pull_cursor` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sync_state_id_check" CHECK("sync_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `user_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`daily_kcal` integer NOT NULL,
	`protein_g` integer NOT NULL,
	`carbs_g` integer NOT NULL,
	`fat_g` integer NOT NULL,
	`fiber_goal_g` integer NOT NULL,
	`water_glasses` integer DEFAULT 8 NOT NULL,
	`sex` text NOT NULL,
	`height_cm` real,
	`weight_kg` real,
	`goal_weight_kg` real,
	`pace_kg_per_week` real,
	`activity` text NOT NULL,
	`goal` text NOT NULL,
	`updated_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`ml` integer NOT NULL,
	`created_at` DATETIME NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_logs_user_day_idx` ON `water_logs` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `weight_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kg` real NOT NULL,
	`created_at` DATETIME NOT NULL
);
