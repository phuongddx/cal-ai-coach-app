/**
 * The snapshot read of CoachModel.startObservation's ValueObservation — the
 * weekly review stats and the latest target's daily kcal. The localtime day
 * grouping and the trailing-week/month windows are part of the behavior
 * (CR-02), so the SQL runs exactly as Swift's raw queries did.
 */
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails, weightLogs } from '../../data/db/schema';
import type { SqlDb } from '../../data/repos/sqlDb';
import type { TargetRepository } from '../../data/repos/targetRepository';
import { rowToWeightLog } from '../../data/repos/trackingRepository';

import { addDays, dateFromDay, dayString } from '../progress/progressMath';

/** CoachModel.WeekStats — the weekly review numbers. */
export type WeekStats = {
  daysLogged: number;
  daysOnTarget: number;
  weeksAllLogged: number;
  kgThisWeek: number;
};

export type CoachSnapshotData = {
  stats: WeekStats;
  targetKcal: number | null;
  /** Logged local days of the trailing 28, ascending (the insight day lists). */
  loggedDays: string[];
  /** Local days of the trailing week with a kcal sum, ascending. */
  weekDays: string[];
};

export type CoachSnapshotDeps = {
  db: SqlDb;
  targets: TargetRepository;
  ownerId: string;
};

export function createCoachSnapshotLoader(
  deps: CoachSnapshotDeps,
): (now: Date) => Promise<CoachSnapshotData> {
  return async (now: Date) => {
    const today = dayString(now);
    const weekStart = dayString(addDays(now, -6));
    const monthStart = dayString(addDays(now, -27));
    const todayDate = dateFromDay(today) ?? now;

    const localDay = sql<string>`date(${diaryEntries.createdAt}, 'localtime')`;

    const [target, kcalRows, loggedDayRows, weightRows] = await Promise.all([
      deps.targets.activeTarget(deps.ownerId),
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
        .select()
        .from(weightLogs)
        .where(
          and(
            eq(weightLogs.userId, deps.ownerId),
            gte(weightLogs.day, weekStart),
            lte(weightLogs.day, today),
          ),
        )
        .orderBy(asc(weightLogs.day), asc(weightLogs.createdAt)),
    ]);

    const loggedDays28 = new Set(loggedDayRows.map((row) => row.day));

    const firstWeight = weightRows[0] !== undefined ? rowToWeightLog(weightRows[0]) : null;
    const lastRow = weightRows[weightRows.length - 1];
    const lastWeight = lastRow !== undefined ? rowToWeightLog(lastRow) : null;
    const stats: WeekStats = {
      daysLogged: countDaysLogged(todayDate, loggedDays28),
      daysOnTarget: kcalRows.filter((row) => target !== null && Number(row.kcal) <= target.dailyKcal).length,
      weeksAllLogged: countWeeksAllLogged(todayDate, loggedDays28),
      kgThisWeek:
        firstWeight !== null && lastWeight !== null && weightRows.length >= 2
          ? lastWeight.kg - firstWeight.kg
          : 0,
    };

    return { stats, targetKcal: target?.dailyKcal ?? null, loggedDays: loggedDayRows.map((row) => row.day).sort(), weekDays: kcalRows.map((row) => row.day).sort() };
  };
}

/** The trailing seven local days, counted against the 28-day logged set. */
function countDaysLogged(todayDate: Date, loggedDays28: ReadonlySet<string>): number {
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    if (loggedDays28.has(dayString(addDays(todayDate, -offset)))) {
      count += 1;
    }
  }
  return count;
}

/**
 * Trailing four weeks: a week qualifies when all 7 of its days are logged
 * (Swift: weekDays.allSatisfy(loggedDays28.contains)).
 */
function countWeeksAllLogged(todayDate: Date, loggedDays28: ReadonlySet<string>): number {
  let count = 0;
  for (let week = 0; week < 4; week += 1) {
    const weekDays: string[] = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      weekDays.push(dayString(addDays(todayDate, -(week * 7 + dayOffset))));
    }
    if (weekDays.length > 0 && weekDays.every((day) => loggedDays28.has(day))) {
      count += 1;
    }
  }
  return count;
}
