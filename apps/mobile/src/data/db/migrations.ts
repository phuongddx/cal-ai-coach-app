/**
 * Bundled Drizzle migrations (spec D4: "Migrations are generated with
 * drizzle-kit and shipped in the app").
 *
 * The SQL text is inlined verbatim from the generated
 * `migrations/0000_lucky_tiger_shark.sql` because Metro cannot `import` a
 * `.sql` file without an `assetExts` config change (which is outside this
 * task's file ownership — see docs/findings/T3-sync.md). The journal is
 * imported from the generated JSON. After regenerating with drizzle-kit,
 * copy the new statements here.
 */
import journal from './migrations/meta/_journal.json';

const m0000 = `CREATE TABLE \`meals\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`eaten_at\` text NOT NULL,
	\`name\` text NOT NULL,
	\`kcal\` real NOT NULL,
	\`protein_g\` real NOT NULL,
	\`carbs_g\` real NOT NULL,
	\`fat_g\` real NOT NULL,
	\`fiber_g\` real NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`deleted\` integer DEFAULT false NOT NULL,
	\`server_version\` integer DEFAULT 0 NOT NULL,
	\`accepted_op_id\` text
);
--> statement-breakpoint
CREATE TABLE \`outbox\` (
	\`op_id\` text PRIMARY KEY NOT NULL,
	\`record_id\` text NOT NULL,
	\`kind\` text NOT NULL,
	\`payload\` text NOT NULL,
	\`created_at\` integer NOT NULL,
	\`queue_seq\` integer NOT NULL,
	\`attempts\` integer DEFAULT 0 NOT NULL,
	\`state\` text DEFAULT 'pending' NOT NULL,
	\`last_error\` text
);
--> statement-breakpoint
CREATE INDEX \`outbox_record_id_idx\` ON \`outbox\` (\`record_id\`);--> statement-breakpoint
CREATE TABLE \`sync_state\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`value\` text NOT NULL
);`;

const migrations = {
  journal,
  migrations: {
    m0000,
  },
};

export default migrations;
