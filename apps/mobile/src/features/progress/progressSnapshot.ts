/**
 * The snapshot read of ProgressModel.startObservation's ValueObservation —
 * the target, the last 50 weight logs, the week kcal rows, the streak row,
 * the badges and the two diary day-sets (30-day stats window, 730-day streak
 * window). One loader built over the injected handles; the route wires the
 * real ones, Jest sql.js. The localtime day grouping is part of the behavior
 * (CR-02), so the SQL runs exactly as Swift's raw queries did.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails } from '../../data/db/schema';
import type { Badge, EngagementRepository, StreakState } from '../../data/repos/engagementRepository';
import type { SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository, UserTarget } from '../../data/repos/targetRepository';
import type { TrackingRepository, WeightLog } from '../../data/repos/trackingRepository';

import { addDays, dayString } from './progressMath';

/** ProgressModel.DayKcal — one day column of the weekly energy bars. */
export type DayKcal = { day: string; kcal: number | null };

export type ProgressSnapshotData = {
  target: UserTarget | null;
  weights: WeightLog[];
  weekKcals: DayKcal[];
  streak: StreakState | null;
  badges: Badge[];
  /** Logged local days of the trailing 30 (stats surfaces). */
  diaryDays: Set<string>;
  /**
   * Logged local days of the trailing StreakEngine.maxLookbackDays — wide
   * enough for the engine's full recount (a 30-day set would cap the streak
   * at ~31 days).
   */
  streakDiaryDays: Set<string>;
};

export type ProgressSnapshotDeps = {
  db: SqlDb;
  targets: TargetRepository;
  tracking: TrackingRepository;
  engagement: EngagementRepository;
  ownerId: string;
};

export function createProgressSnapshotLoader(
  deps: ProgressSnapshotDeps,
): (now: Date) => Promise<ProgressSnapshotData> {
  return async (now: Date) => {
    const weekStart = dayString(addDays(now, -6));
    const monthStart = dayString(addDays(now, -29));
    const streakStart = dayString(addDays(now, -730));

    const localDay = sql<string>`date(${diaryEntries.createdAt}, 'localtime')`;

    const [target, weights, streak, badges, kcalRows, diaryDayRows, streakDayRows] = await Promise.all([
      deps.targets.activeTarget(deps.ownerId),
      deps.tracking.weights(50),
      deps.engagement.streakState(),
      deps.engagement.badges(),
      deps.db
        .select({ day: localDay, kcal: sql<number>`COALESCE(SUM(${diaryEntryDetails.kcal}), 0)` })
        .from(diaryEntries)
        .innerJoin(diaryEntryDetails, eq(diaryEntryDetails.entryId, diaryEntries.id))
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            eq(diaryEntries.userId, deps.ownerId),
            sql`date(${diaryEntries.createdAt}, 'localtime') >= ${weekStart}`,
          ),
        )
        .groupBy(localDay),
      deps.db
        .selectDistinct({ day: localDay })
        .from(diaryEntries)
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            eq(diaryEntries.userId, deps.ownerId),
            sql`date(${diaryEntries.createdAt}, 'localtime') >= ${monthStart}`,
          ),
        ),
      deps.db
        .selectDistinct({ day: localDay })
        .from(diaryEntries)
        .where(
          and(
            isNull(diaryEntries.deletedAt),
            eq(diaryEntries.userId, deps.ownerId),
            sql`date(${diaryEntries.createdAt}, 'localtime') >= ${streakStart}`,
          ),
        ),
    ]);

    const kcalByDay = new Map<string, number>();
    for (const row of kcalRows) {
      kcalByDay.set(row.day, Number(row.kcal));
    }
    // The seven trailing days, oldest first (Swift: (0..<7).reversed()).
    const weekKcals: DayKcal[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = dayString(addDays(now, -offset));
      weekKcals.push({ day, kcal: kcalByDay.get(day) ?? null });
    }

    return {
      target,
      weights,
      weekKcals,
      streak,
      badges,
      diaryDays: new Set(diaryDayRows.map((row) => row.day)),
      streakDiaryDays: new Set(streakDayRows.map((row) => row.day)),
    };
  };
}
