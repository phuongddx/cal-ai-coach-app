/**
 * EngagementRecords.swift / EngagementRepository.swift — streak state (the
 * single-row table), badges and daily insights (all local-only).
 */
import { asc, desc, eq } from 'drizzle-orm';

import { appSettings, badges, insights, streakState } from '../db/schema';
import { fromIso, toIso, type SqlDb } from './sqlDb';

export interface StreakState {
  id: number;
  currentStreak: number;
  bestStreak: number;
  freezesLeft: number;
  freezeUsedOn: string | null;
  lastLoggedDay: string | null;
}

export interface Badge {
  id: string;
  userId: string;
  code: string;
  label: string;
  detail: string | null;
  earnedAt: Date | null;
  progress: number;
  target: number;
}

export interface Insight {
  id: string;
  userId: string;
  day: string;
  kind: string;
  title: string;
  body: string;
  createdAt: Date;
}

export interface AppSettings {
  key: string;
  value: string;
}

export function streakStateToRow(state: StreakState) {
  return { ...state };
}

export function rowToStreakState(row: typeof streakState.$inferSelect): StreakState {
  return {
    id: row.id,
    currentStreak: row.currentStreak,
    bestStreak: row.bestStreak,
    freezesLeft: row.freezesLeft,
    freezeUsedOn: row.freezeUsedOn,
    lastLoggedDay: row.lastLoggedDay,
  };
}

export function badgeToRow(badge: Badge) {
  return {
    ...badge,
    earnedAt: badge.earnedAt === null ? null : toIso(badge.earnedAt),
  };
}

export function rowToBadge(row: typeof badges.$inferSelect): Badge {
  return {
    id: row.id,
    userId: row.userId,
    code: row.code,
    label: row.label,
    detail: row.detail,
    earnedAt: row.earnedAt === null ? null : fromIso(row.earnedAt),
    progress: row.progress,
    target: row.target,
  };
}

export function insightToRow(insight: Insight) {
  return { ...insight, createdAt: toIso(insight.createdAt) };
}

export function rowToInsight(row: typeof insights.$inferSelect): Insight {
  return {
    id: row.id,
    userId: row.userId,
    day: row.day,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: fromIso(row.createdAt),
  };
}

export function createEngagementRepository(db: SqlDb) {
  return {
    /** The single streak row (id = 1), or null before the first save. */
    async streakState(): Promise<StreakState | null> {
      const rows = await db.select().from(streakState).limit(1);
      return rows[0] === undefined ? null : rowToStreakState(rows[0]);
    },

    async saveStreakState(state: StreakState): Promise<void> {
      const row = streakStateToRow(state);
      await db.insert(streakState).values(row).onConflictDoUpdate({ target: streakState.id, set: row });
    },

    /** Badges ordered by code (Swift: order by code). */
    async badges(): Promise<Badge[]> {
      const rows = await db.select().from(badges).orderBy(asc(badges.code));
      return rows.map(rowToBadge);
    },

    async awardBadge(badge: Badge): Promise<void> {
      await db.insert(badges).values(badgeToRow(badge));
    },

    /** A day's insights, newest first. */
    async insights(forDay: string): Promise<Insight[]> {
      const rows = await db
        .select()
        .from(insights)
        .where(eq(insights.day, forDay))
        .orderBy(desc(insights.createdAt));
      return rows.map(rowToInsight);
    },
  };
}

export type EngagementRepository = ReturnType<typeof createEngagementRepository>;

/** app_settings key/value reads (SeedDataManager's seed-version flag lives here). */
export async function readAppSetting(db: SqlDb, key: string): Promise<string | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function writeAppSetting(db: SqlDb, key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}
