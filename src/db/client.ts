import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

/**
 * The single Expo SQLite handle for the app. `enableChangeListener` powers
 * Drizzle's useLiveQuery so screens re-render from local writes. The database
 * is the durable source of truth on device — repositories are the only writers.
 */
export const sqlite = openDatabaseSync('coachcal.db', {
  enableChangeListener: true,
});

export const db = drizzle(sqlite);

export type AppDatabase = typeof db;
