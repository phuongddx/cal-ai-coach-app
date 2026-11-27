/**
 * Drizzle schema for the local SQLite store — one table per GRDB table of
 * `Migrations.swift` (native/Modules/CoachCalPersistence), with the same
 * column names, declared SQLite types, constraints and indexes.
 *
 * - `diary_entries` (+ `diary_entry_details`) mirrors the server; every other
 *   table is local-only (spec I4). Only `diary_entries` rows and their
 *   `pending_ops` participate in sync.
 * - `pending_ops` is the outbox: one row per un-acked operation; a row exists
 *   for a record id = "has pending local intent". `quarantined` rows stay in
 *   the table (the local mutation is never dropped) but leave the due batch.
 * - `sync_state` is the single-row pull cursor (`id = 1`, seeded by migration).
 *
 * GRDB's `.datetime`/`.boolean` declared types are reproduced with custom
 * column builders so `pragma table_info` matches the Swift schema; values are
 * stored the way GRDB stores them (datetimes as text, booleans as 0/1).
 */
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/** GRDB `.datetime`: declared DATETIME, stored as a text timestamp. */
const datetime = customType<{ data: string; driverData: string }>({
  dataType: () => 'DATETIME',
});

/** GRDB `.boolean`: declared BOOLEAN, stored as 1/0. */
const boolean = customType<{ data: boolean; driverData: number }>({
  dataType: () => 'BOOLEAN',
  toDriver: (value) => (value ? 1 : 0),
  fromDriver: (value) => Number(value) !== 0,
});

// ---------------------------------------------------------------------------
// Migration "1__foundation_sync"
// ---------------------------------------------------------------------------

/** The one synced table (mirror rows + tombstones). */
export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    displayText: text('display_text').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: datetime('deleted_at'),
    serverVersion: integer('server_version').notNull().default(0),
    acceptedOpId: text('accepted_op_id'),
    serverUpdatedAt: datetime('server_updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('diary_entries_user_version_idx').on(table.userId, table.serverVersion)],
);

/** The outbox: one row per un-acked local operation. */
export const pendingOps = sqliteTable(
  'pending_ops',
  {
    opId: text('op_id').primaryKey(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    kind: text('kind').notNull(),
    /** JSON of the mirror snapshot (id, displayText, deletedAt, serverVersion, acceptedOpId). */
    snapshot: text('snapshot').notNull(),
    clientTimestamp: datetime('client_timestamp').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    dispatchAttempts: integer('dispatch_attempts').notNull().default(0),
    nextRetryAt: datetime('next_retry_at'),
    quarantined: boolean('quarantined').notNull().default(false),
  },
  (table) => [index('pending_ops_due_idx').on(table.nextRetryAt, table.createdAt)],
);

/** Single-row pull cursor (`id = 1`). */
export const syncState = sqliteTable(
  'sync_state',
  {
    id: integer('id').primaryKey().default(1),
    pullCursor: integer('pull_cursor').notNull().default(0),
  },
  (table) => [check('sync_state_id_check', sql`${table.id} = 1`)],
);

// ---------------------------------------------------------------------------
// Migration "3__domain_core" — the local-only domain tables
// ---------------------------------------------------------------------------

export const userTargets = sqliteTable('user_targets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  dailyKcal: integer('daily_kcal').notNull(),
  proteinG: integer('protein_g').notNull(),
  carbsG: integer('carbs_g').notNull(),
  fatG: integer('fat_g').notNull(),
  fiberGoalG: integer('fiber_goal_g').notNull(),
  waterGlasses: integer('water_glasses').notNull().default(8),
  sex: text('sex').notNull(),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  goalWeightKg: real('goal_weight_kg'),
  paceKgPerWeek: real('pace_kg_per_week'),
  activity: text('activity').notNull(),
  goal: text('goal').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const diaryEntryDetails = sqliteTable(
  'diary_entry_details',
  {
    entryId: text('entry_id').primaryKey(),
    mealSlot: text('meal_slot').notNull(),
    title: text('title').notNull(),
    grams: integer('grams'),
    kcal: integer('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    fiberG: real('fiber_g'),
    confidence: real('confidence'),
    hiddenFatLikely: boolean('hidden_fat_likely').notNull().default(false),
    source: text('source'),
    unresolved: boolean('unresolved').notNull().default(false),
    scanId: text('scan_id'),
  },
  (table) => [
    check(
      'diary_entry_details_slot_check',
      sql`${table.mealSlot} IN ('breakfast', 'lunch', 'dinner', 'snacks', 'exercise')`,
    ),
  ],
);

export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    brand: text('brand'),
    per100gKcal: integer('per100g_kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g').notNull(),
    servingGrams: integer('serving_grams'),
    isCustom: boolean('is_custom').notNull().default(false),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('foods_name_idx').on(table.name)],
);

export const savedMeals = sqliteTable('saved_meals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  symbol: text('symbol'),
  kcal: integer('kcal').notNull(),
  itemsJson: text('items_json').notNull(),
  createdAt: datetime('created_at').notNull(),
});

export const customFoods = sqliteTable(
  'custom_foods',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    basis: text('basis').notNull(),
    kcal: integer('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g').notNull(),
    servingGrams: integer('serving_grams'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    check('custom_foods_basis_check', sql`${table.basis} IN ('per100g', 'per_serving')`),
  ],
);

export const waterLogs = sqliteTable(
  'water_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    day: text('day').notNull(),
    ml: integer('ml').notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('water_logs_user_day_idx').on(table.userId, table.day)],
);

export const weightLogs = sqliteTable('weight_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  day: text('day').notNull(),
  kg: real('kg').notNull(),
  createdAt: datetime('created_at').notNull(),
});

export const exerciseLogs = sqliteTable('exercise_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  day: text('day').notNull(),
  exerciseType: text('exercise_type').notNull(),
  durationMin: integer('duration_min').notNull(),
  kcalBurned: integer('kcal_burned'),
  createdAt: datetime('created_at').notNull(),
});

export const streakState = sqliteTable(
  'streak_state',
  {
    id: integer('id').primaryKey().default(1),
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    freezesLeft: integer('freezes_left').notNull().default(1),
    freezeUsedOn: text('freeze_used_on'),
    lastLoggedDay: text('last_logged_day'),
  },
  (table) => [check('streak_state_id_check', sql`${table.id} = 1`)],
);

export const badges = sqliteTable('badges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  code: text('code').notNull(),
  label: text('label').notNull(),
  detail: text('detail'),
  earnedAt: datetime('earned_at'),
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull().default(1),
});

export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  day: text('day').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: datetime('created_at').notNull(),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
