/**
 * Jest twin of native/App/CoachCalTests/StreakBadgeInsightTests.swift — one
 * case per Swift test, the same behavior sentence. Runs on a fresh seeded
 * sql.js database per test (the Swift tests use a fresh GRDB pool) with the
 * real repositories, the real snapshot loaders and the real streak reconcile.
 */
import { and, gte, lte, sql } from 'drizzle-orm';
import { asc } from 'drizzle-orm';

import { diaryEntries, diaryEntryDetails, streakState, weightLogs } from '../../../data/db/schema';
import { entryToRow } from '../../../data/repos/diaryEntryRepository';
import { createEngagementRepository, streakStateToRow } from '../../../data/repos/engagementRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';
import { kgValue, visibleStats } from '../../../design';

import { createCoachModel, greeting, insightDaysFor } from '../../coach/coachModel';
import { addDays, dayString } from '../progressMath';
import { createProgressModel } from '../progressModel';
import { lockedDaysLeft, streakTitle } from '../screens/AchievementsView';
import { encouragement } from '../../coach/screens/WeeklyReviewCard';
import type { CoachDeps } from '../../coach/coachModel';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

type Harness = {
  fixture: RepoFixture;
  coach: ReturnType<typeof createCoachModel>;
  progress: ReturnType<typeof createProgressModel>;
};

async function makeProgressDeps(fixture: RepoFixture): Promise<ProgressDeps> {
  return {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    engagement: createEngagementRepository(fixture.db),
    ownerId: USER_ID,
    notify: () => undefined,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
}

async function makeCoachedFixtures(): Promise<Harness> {
  const fixture = await createRepoFixture();
  const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
  await seeder.ensureSeeded();
  const coachDeps: CoachDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    engagement: createEngagementRepository(fixture.db),
    ownerId: USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
  };
  const coach = createCoachModel(coachDeps);
  await coach.refresh();
  const progress = createProgressModel(await makeProgressDeps(fixture));
  await progress.refresh();
  return { fixture, coach, progress };
}

describe('StreakBadgeInsightTests twins', () => {
  // testSeededInsightsRenderThreeDailyTips — insights render only from seeded
  // data, no adaptive nudges (COA2-01 v2).
  it('seeded insights render three daily tips', async () => {
    const { coach } = await makeCoachedFixtures();

    expect(coach.getSnapshot().insights).toHaveLength(3);
    expect(coach.getSnapshot().insights.map((insight) => insight.title)).toEqual([
      '12-day streak going strong',
      'Hydration is behind',
      'Protein pacing looks good',
    ]); // insights follow the seeded rows, newest first
  });

  it('weekly review stats match diary and weight fixtures', async () => {
    const { coach, fixture } = await makeCoachedFixtures();

    // Independent derivation from the raw fixtures:
    const clock = fixture.clock();
    const weekStart = dayString(addDays(clock, -6));
    const today = dayString(clock);
    const kcalRows = await fixture.db
      .select({
        day: sql<string>`date(${diaryEntries.createdAt}, 'localtime')`,
        kcal: sql<number>`COALESCE(SUM(${diaryEntryDetails.kcal}), 0)`,
      })
      .from(diaryEntries)
      .innerJoin(diaryEntryDetails, sql`diary_entry_details.entry_id = ${diaryEntries.id}`)
      .where(
        sql`${diaryEntries.deletedAt} IS NULL AND date(${diaryEntries.createdAt}, 'localtime') >= ${weekStart}`,
      )
      .groupBy(sql`date(${diaryEntries.createdAt}, 'localtime')`);
    expect(kcalRows).toHaveLength(7); // seed logs exactly one meal per day for 7 days

    const target = await createTargetRepository(fixture.db).activeTarget(USER_ID);
    const targetKcal = target?.dailyKcal ?? null;
    const expectedOnTarget = kcalRows.filter(
      (row) => targetKcal !== null && row.kcal <= targetKcal,
    ).length;
    expect(expectedOnTarget).toBe(7);

    const weekWeightRows = await fixture.db
      .select({ kg: weightLogs.kg })
      .from(weightLogs)
      .where(and(gte(weightLogs.day, weekStart), lte(weightLogs.day, today)))
      .orderBy(asc(weightLogs.day));
    const expectedKgDelta =
      weekWeightRows.length >= 2
        ? (weekWeightRows[weekWeightRows.length - 1]?.kg ?? 0) - (weekWeightRows[0]?.kg ?? 0)
        : 0;

    const stats = coach.getSnapshot().weekStats;
    expect(stats.daysLogged).toBe(7);
    expect(stats.daysOnTarget).toBe(expectedOnTarget);
    expect(stats.weeksAllLogged).toBe(1); // only the current week is fully logged
    expect(stats.kgThisWeek).toBeCloseTo(expectedKgDelta, 3);
    expect(coach.getSnapshot().targetKcal).toBe(2150);

    // Visible stats (non-ED-Safe): 100% on target, habit encouragement.
    // (Pure core lives in the DS component; the feature holds no policy branch.)
    const visible = visibleStats(stats.daysLogged, stats.daysOnTarget, stats.weeksAllLogged, stats.kgThisWeek, false);
    expect(visible.some((stat) => stat.label === '% on target' && stat.value === '100%')).toBe(true);
    expect(visible.some((stat) => stat.label === 'kg this week' && stat.value === kgValue(expectedKgDelta))).toBe(true);
    expect(encouragement(7)).toBe('You logged every day this week — great consistency!');
  });

  // testEdSafeSwapsKcalDerivedStatsForWeeksStat — the mode swaps the two
  // kcal-derived stats for "weeks with all meals logged".
  it('ED-safe swaps kcal-derived stats for weeks stat', async () => {
    const { coach } = await makeCoachedFixtures();
    const stats = coach.getSnapshot().weekStats;

    const normal = visibleStats(stats.daysLogged, stats.daysOnTarget, stats.weeksAllLogged, stats.kgThisWeek, false);
    expect(normal.some((stat) => stat.label === 'Days logged')).toBe(true);
    expect(normal.some((stat) => stat.label === '% on target')).toBe(true);
    expect(normal.some((stat) => stat.label === 'kg this week')).toBe(true);
    expect(normal.some((stat) => stat.label === 'Weeks with all meals logged')).toBe(false);

    const hidden = visibleStats(stats.daysLogged, stats.daysOnTarget, stats.weeksAllLogged, stats.kgThisWeek, true);
    expect(hidden.some((stat) => stat.label === 'Days logged')).toBe(true);
    expect(hidden.some((stat) => stat.label === 'Weeks with all meals logged' && stat.value === '1')).toBe(true);
    expect(hidden.some((stat) => stat.label === '% on target')).toBe(false);
    expect(hidden.some((stat) => stat.label === 'kg this week')).toBe(false);
  });

  // testGreetingBucketsUnderFixedClocks — buckets at 08:00 / 14:00 / 21:00,
  // pinned to UTC as the fixture (the UI passes the process zone). The frame
  // drops the emoji and the exclamation, so the strings are plain.
  it('greeting buckets under fixed clocks', () => {
    expect(greeting(new Date('2026-09-15T08:00:00Z'), 'UTC')).toBe('Good morning');
    expect(greeting(new Date('2026-09-15T14:00:00Z'), 'UTC')).toBe('Good afternoon');
    expect(greeting(new Date('2026-09-15T21:00:00Z'), 'UTC')).toBe('Good evening');
  });

  // The days behind an insight (frame 12's "See the days"): the streak's
  // consecutive logged days, the weekly kinds' logged days, none for a kind
  // the snapshot holds no days for.
  it('insight days come from the logged series by kind', () => {
    const loggedDays = ['2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12'];
    const weekDays = ['2026-01-07', '2026-01-08', '2026-01-12'];

    expect(insightDaysFor('streak', '2026-01-12', loggedDays, weekDays)).toEqual([
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
    ]); // the consecutive logged days ending today, oldest first
    expect(insightDaysFor('streak', '2026-01-12', [], weekDays)).toEqual([]); // no logged days, no list
    expect(insightDaysFor('protein', '2026-01-12', loggedDays, weekDays)).toEqual([
      '2026-01-07',
      '2026-01-08',
      '2026-01-12',
    ]); // the week's logged days behind the average
    expect(insightDaysFor('hydration', '2026-01-12', loggedDays, weekDays)).toEqual([]); // water is not in the read yet
    expect(insightDaysFor('unknown', '2026-01-12', loggedDays, weekDays)).toEqual([]); // a kind without days shows no row
  });

  // testSeededStreakBadgesRenderAfterReconcile — the seeded 12-day streak
  // renders through the StreakEngine reconcile, the freeze stays available,
  // and the badge grids derive earned/locked + days-left copy.
  it('seeded streak badges render after reconcile', async () => {
    const { progress } = await makeCoachedFixtures();

    const streak = progress.getSnapshot().streak;
    expect(streak).not.toBeNull();
    expect(streak?.currentStreak).toBe(12); // the seeded 12-day streak renders
    expect(streak?.bestStreak).toBe(18);
    expect(streak?.freezesLeft).toBe(1);
    expect(streakTitle(streak?.currentStreak ?? 0, streak?.bestStreak ?? 0)).toBe('Personal best: 18 days');
    // "Day 1 streak started!" surfaces from current == 1.
    expect(streakTitle(1, 18)).toBe('Day 1 streak started!');

    const earned = progress.getSnapshot().badges.filter((badge) => badge.earnedAt !== null);
    const locked = progress.getSnapshot().badges.filter((badge) => badge.earnedAt === null);
    expect(earned).toHaveLength(3);
    expect(locked).toHaveLength(2);
    const streak30 = locked.find((badge) => badge.code === 'streak-30');
    expect(streak30).toBeDefined();
    expect(lockedDaysLeft(streak30 as NonNullable<typeof streak30>)).toBe(18); // 30-Day badge shows 18 days left
  });

  // testStreakReconcileCountsBeyondTheThirtyDayStatsWindow — the reconcile
  // window must span the engine's full recount (730 days); a 30-day window
  // capped a 40-day streak at ~31 forever (WR-04).
  it('streak reconcile counts beyond the thirty day stats window', async () => {
    const fixture = await createRepoFixture();
    const clock = fixture.clock();

    await fixture.db.insert(streakState).values(
      streakStateToRow({
        id: 1,
        currentStreak: 5,
        bestStreak: 18,
        freezesLeft: 0,
        freezeUsedOn: null,
        lastLoggedDay: dayString(clock),
      }),
    );
    // 40 consecutive logged days including today, via local calendar-day
    // arithmetic so DST shifts cannot collapse two entries onto one day.
    for (let dayOffset = 0; dayOffset < 40; dayOffset += 1) {
      const loggedAt = addDays(clock, -dayOffset);
      await fixture.db.insert(diaryEntries).values(
        entryToRow({
          id: fixture.newId(),
          userId: USER_ID,
          displayText: `Streak fill ${dayOffset}`,
          createdAt: loggedAt,
          updatedAt: loggedAt,
          deletedAt: null,
          serverVersion: 0,
          acceptedOpId: null,
          serverUpdatedAt: loggedAt,
        }),
      );
    }

    const progress = createProgressModel(await makeProgressDeps(fixture));
    await progress.refresh();

    expect(progress.getSnapshot().streakDiaryDays.size).toBe(40);
    expect(progress.getSnapshot().streak?.currentStreak).toBe(40); // 40 logged days must reconcile to a 40-day streak
    expect(progress.getSnapshot().streak?.bestStreak).toBe(40);
  });
});
