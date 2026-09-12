import journal from './migrations/meta/_journal.json';
import migration0000 from './migrations/0000_foundation.sql';

/**
 * Committed bundled migrations — the exact artifact shipped in the app binary
 * and consumed by drizzle-orm/expo-sqlite's migrator. SQL files are inlined at
 * build time via babel-plugin-inline-import (Metro) and the jest .sql
 * transformer (tests). NEVER edit generated SQL by hand: change src/db/schema.ts
 * and re-run `npm run db:generate`.
 */

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const typedJournal = journal as MigrationJournal;

export const migrationsBundle = {
  journal: typedJournal,
  migrations: {
    [`m${typedJournal.entries[0].idx.toString().padStart(4, '0')}`]:
      migration0000,
  },
} as const;
