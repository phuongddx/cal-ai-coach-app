/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/SeedDataManagerTests.swift —
 * one case per Swift test, the same behavior sentences.
 */
import { roundKcal, roundMacro, dayKey } from '@coachcal/core';

import {
  badges as badgesTable,
  customFoods as customFoodsTable,
  diaryEntries as diaryEntriesTable,
  diaryEntryDetails as detailsTable,
  exerciseLogs as exerciseLogsTable,
  foods as foodsTable,
  insights as insightsTable,
  savedMeals as savedMealsTable,
  streakState as streakTable,
  userTargets as targetsTable,
  waterLogs as waterTable,
  weightLogs as weightTable,
} from '../db/schema';
import {
  DEMO_USER_ID,
  SEED_VERSION,
  SEED_VERSION_KEY,
  createSeedDataManager,
  seededFoods,
} from './seedDataManager';
import { readAppSetting } from './engagementRepository';
import { createTrackingRepository } from './trackingRepository';
import { countPendingOps, countTable, createRepoFixture, FIXED_NOW_MS, type RepoFixture } from './testing/fixtures';

type SeedFixture = { fixture: RepoFixture; manager: ReturnType<typeof createSeedDataManager> };

async function makeSeeded(): Promise<SeedFixture> {
  const fixture = await createRepoFixture();
  const manager = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
  return { fixture, manager };
}

describe('SeedDataManagerTests twins', () => {
  it('a fresh seed renders the demo persona with an empty outbox', async () => {
    const { fixture, manager } = await makeSeeded();

    await manager.ensureSeeded();

    expect(await countPendingOps(fixture)).toBe(0);
    expect(await countTable(fixture, 'user_targets')).toBe(1);
    expect(await countTable(fixture, 'diary_entries')).toBe(7);
    expect(await countTable(fixture, 'diary_entry_details')).toBe(7);
    expect(await countTable(fixture, 'foods')).toBe(30);
    expect(await countTable(fixture, 'saved_meals')).toBe(2);
    expect(await countTable(fixture, 'custom_foods')).toBe(1);
    expect(await countTable(fixture, 'water_logs')).toBe(5);
    expect(await countTable(fixture, 'weight_logs')).toBe(8);
    expect(await countTable(fixture, 'exercise_logs')).toBe(2);
    expect(await countTable(fixture, 'badges')).toBe(5);
    expect(await countTable(fixture, 'insights')).toBe(3);
    expect(await readAppSetting(fixture.db, SEED_VERSION_KEY)).toBe(SEED_VERSION);

    const targets = await fixture.db.select().from(targetsTable);
    const target = targets.find((row) => row.userId === DEMO_USER_ID);
    expect(target?.dailyKcal).toBe(2150);
    expect(target?.proteinG).toBe(130);
    expect(target?.carbsG).toBe(220);
    expect(target?.fatG).toBe(70);
    expect(target?.fiberGoalG).toBe(30);
    expect(target?.waterGlasses).toBe(8);
    expect(target?.goal).toBe('lose');
    expect(target?.paceKgPerWeek).toBe(0.5);

    const longNameRows = fixture.client.exec("SELECT COUNT(*) FROM foods WHERE LENGTH(name) >= 60");
    expect(Number(longNameRows[0]?.values[0]?.[0] ?? 0)).toBe(1);

    const fixedNow = new Date(FIXED_NOW_MS);
    const tracking = createTrackingRepository(fixture.db, { newId: fixture.newId });
    expect(await tracking.water(dayKey(fixedNow))).toBe(1250);

    const streakRows = await fixture.db.select().from(streakTable);
    const streak = streakRows[0];
    expect(streak?.currentStreak).toBe(12);
    expect(streak?.bestStreak).toBe(18);
    expect(streak?.freezesLeft).toBe(1);
    expect(streak?.lastLoggedDay).toBe(dayKey(new Date(FIXED_NOW_MS - 86_400_000)));

    const earned = Number(fixture.client.exec('SELECT COUNT(*) FROM badges WHERE earned_at IS NOT NULL')[0]?.values[0]?.[0] ?? 0);
    const lockedCount = Number(fixture.client.exec('SELECT COUNT(*) FROM badges WHERE earned_at IS NULL')[0]?.values[0]?.[0] ?? 0);
    expect(earned).toBe(3);
    expect(lockedCount).toBe(2);
  });

  it('seeded nutrition comes from the core kcal arithmetic', async () => {
    const { fixture, manager } = await makeSeeded();
    await manager.ensureSeeded();

    // WR-07: seed rows must derive nutrition through the core arithmetic
    // (the single formula source), not a private copy that can drift.
    const details = await fixture.db.select().from(detailsTable);
    const byTitle = new Map(details.map((detail) => [detail.title, detail]));
    expect(byTitle.get('Oatmeal with Blueberries')?.kcal).toBe(roundKcal(150, 250));
    expect(byTitle.get('Chicken Rice Bowl')?.kcal).toBe(roundKcal(145, 320));
    expect(byTitle.get('Chicken Rice Bowl')?.proteinG).toBe(roundMacro(27, 320));
    expect(byTitle.get('Caesar Salad with Dressing')?.fatG).toBe(roundMacro(12, 280));
  });

  it('seeded saved meals emit a per-item kcal payload', async () => {
    const { fixture, manager } = await makeSeeded();
    await manager.ensureSeeded();

    // WR-10: seeded rail meals must ship the current payload shape so the
    // re-log writes real per-item kcal rows, never 0-kcal rows.
    const meals = await fixture.db.select().from(savedMealsTable);
    expect(meals).toHaveLength(2);

    interface PayloadItem {
      name: string;
      grams: number;
      kcal: number;
    }

    const chicken = meals.find((meal) => meal.name === 'Chicken Rice Bowl');
    expect(chicken).toBeDefined();
    const chickenItems = JSON.parse(chicken!.itemsJson) as PayloadItem[];
    expect(chickenItems[0]?.grams).toBe(320);
    expect(chickenItems[0]?.kcal).toBe(roundKcal(145, 320));
    expect(chicken?.kcal).toBe(chickenItems[0]?.kcal);

    const oats = meals.find((meal) => meal.name === 'Protein Oats');
    expect(oats).toBeDefined();
    const oatsItems = JSON.parse(oats!.itemsJson) as PayloadItem[];
    expect(oatsItems[0]?.grams).toBe(250);
    expect(oatsItems[0]?.kcal).toBe(roundKcal(152, 250));
    expect(oats?.kcal).toBe(oatsItems[0]?.kcal);
  });

  it('a second ensureSeeded is idempotent', async () => {
    const { fixture, manager } = await makeSeeded();
    await manager.ensureSeeded();

    const tables = [
      'user_targets', 'diary_entries', 'diary_entry_details', 'foods',
      'saved_meals', 'custom_foods', 'water_logs', 'weight_logs',
      'exercise_logs', 'badges', 'insights',
    ];
    const before = new Map<string, number>();
    for (const table of tables) {
      before.set(table, await countTable(fixture, table));
    }

    await manager.ensureSeeded();

    for (const table of tables) {
      expect(await countTable(fixture, table)).toBe(before.get(table));
    }
    expect(await readAppSetting(fixture.db, SEED_VERSION_KEY)).toBe(SEED_VERSION);
  });

  it('seeded confidence covers all badge tiers with one hidden-fat item', async () => {
    const { fixture, manager } = await makeSeeded();
    await manager.ensureSeeded();

    const details = await fixture.db.select().from(detailsTable);
    expect(details).toHaveLength(7);

    const confidences = details.map((detail) => detail.confidence).filter((value): value is number => value !== null);
    expect(confidences.some((value) => value >= 0.85)).toBe(true);
    expect(confidences.some((value) => value >= 0.7 && value < 0.85)).toBe(true);
    expect(confidences.some((value) => value < 0.7)).toBe(true);

    const hiddenFat = details.filter((detail) => detail.hiddenFatLikely);
    expect(hiddenFat).toHaveLength(1);
    expect(hiddenFat[0]?.title.includes('Dressing')).toBe(true);

    expect(details.every((detail) => !detail.unresolved)).toBe(true);
    expect(details.every((detail) => detail.source === 'cache')).toBe(true);

    const diaryEntriesRows = await fixture.db.select().from(diaryEntriesTable);
    expect(diaryEntriesRows).toHaveLength(7);
    expect(diaryEntriesRows.every((row) => row.deletedAt === null)).toBe(true);
    expect(diaryEntriesRows.every((row) => row.acceptedOpId !== null)).toBe(true);
    expect(new Set(diaryEntriesRows.map((row) => row.serverVersion)).size).toBe(7);
  });

  it('seed without targets leaves targets empty but seeds everything else', async () => {
    const { fixture, manager } = await makeSeeded();

    await manager.ensureSeeded(false);

    expect(await countTable(fixture, 'user_targets')).toBe(0);
    expect(await countTable(fixture, 'diary_entries')).toBe(7);
    expect(await countTable(fixture, 'foods')).toBe(30);
    expect(await countTable(fixture, 'badges')).toBe(5);
    expect(await readAppSetting(fixture.db, SEED_VERSION_KEY)).toBe(SEED_VERSION);

    await manager.ensureSeeded(false);

    expect(await countTable(fixture, 'diary_entries')).toBe(7);
    expect(await countTable(fixture, 'user_targets')).toBe(0);
  });

  it('the seed food rows match the Swift SeedDataManager list', async () => {
    expect(seededFoods).toHaveLength(30);
    expect(seededFoods[0]?.name).toBe('Grilled Chicken Burrito Bowl with Cilantro Lime Rice and Black Beans');
    expect(seededFoods[0]?.per100gKcal).toBe(145);
    expect(seededFoods[26]?.brand).toBe('Synthetic Nutrition');
    expect(seededFoods[29]?.name).toBe('Dark Chocolate, 70%');
    expect(seededFoods[29]?.per100gKcal).toBe(598);
  });
});
