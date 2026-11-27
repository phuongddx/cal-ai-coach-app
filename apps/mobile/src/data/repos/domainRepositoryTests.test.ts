/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/DomainRepositoryTests.swift —
 * one case per Swift test, the same behavior sentences. Every domain write
 * stays out of the outbox (pending ops count stays 0), as the Swift tests
 * assert.
 */
import { foods as foodsTable, insights as insightsTable } from '../db/schema';
import { insertDiaryEntryRow } from './testing/insertHelpers';
import {
  createCatalogRepository,
  customFoodToRow,
  foodToRow,
  type CustomFood,
  type Food,
  type SavedMeal,
} from './catalogRepository';
import { createDiaryDetailRepository } from './diaryDetailRepository';
import type { DiaryEntryDetail } from './diaryEntryRepository';
import { createEngagementRepository, type Badge, type Insight, type StreakState } from './engagementRepository';
import { createTargetRepository, type UserTarget } from './targetRepository';
import { createTrackingRepository, type ExerciseLog, type WeightLog } from './trackingRepository';
import { countPendingOps, createRepoFixture, localDayString, utcDayString, type RepoFixture } from './testing/fixtures';

const USER_ID = '04bbb783-bbe3-4a11-be45-6b77e3d23b20';
const BASE_MS = 1_768_300_000_000;

type Repositories = {
  fixture: RepoFixture;
  target: ReturnType<typeof createTargetRepository>;
  detail: ReturnType<typeof createDiaryDetailRepository>;
  catalog: ReturnType<typeof createCatalogRepository>;
  tracking: ReturnType<typeof createTrackingRepository>;
  engagement: ReturnType<typeof createEngagementRepository>;
};

async function makeRepositories(): Promise<Repositories> {
  const fixture = await createRepoFixture();
  return {
    fixture,
    target: createTargetRepository(fixture.db),
    detail: createDiaryDetailRepository(fixture.db),
    catalog: createCatalogRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    engagement: createEngagementRepository(fixture.db),
  };
}

function makeTarget(): UserTarget {
  return {
    id: '1b0d2f52-8f10-4a2c-9a41-000000000001',
    userId: USER_ID,
    dailyKcal: 2150,
    proteinG: 130,
    carbsG: 220,
    fatG: 70,
    fiberGoalG: 30,
    waterGlasses: 8,
    sex: 'female',
    heightCm: 165,
    weightKg: 82.4,
    goalWeightKg: 74,
    paceKgPerWeek: 0.5,
    activity: 'moderate',
    goal: 'lose',
    updatedAt: new Date(BASE_MS),
  };
}

function makeFood(name: string, id: string): Food {
  return {
    id,
    name,
    brand: null,
    per100gKcal: 145,
    proteinG: 27,
    carbsG: 40,
    fatG: 4,
    fiberG: 2,
    servingGrams: 200,
    isCustom: false,
    createdAt: new Date(BASE_MS),
  };
}

function makeDetail(entryId: string, mealSlot: string): DiaryEntryDetail {
  return {
    entryId,
    mealSlot,
    title: 'Chicken Rice Bowl',
    grams: 320,
    kcal: 464,
    proteinG: 86.4,
    carbsG: 128,
    fatG: 12.8,
    fiberG: 6.4,
    confidence: 0.92,
    hiddenFatLikely: false,
    source: 'cache',
    unresolved: false,
    scanId: null,
  };
}

describe('DomainRepositoryTests twins', () => {
  it('target save and read roundtrip', async () => {
    const repos = await makeRepositories();
    const target = makeTarget();

    await repos.target.saveTarget(target);
    const stored = await repos.target.activeTarget(USER_ID);
    expect(stored).toEqual(target);

    const updated = { ...target, dailyKcal: 1900 };
    await repos.target.saveTarget(updated);
    const reRead = await repos.target.activeTarget(USER_ID);
    expect(reRead?.dailyKcal).toBe(1900);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('water adds accumulate per day', async () => {
    const repos = await makeRepositories();
    const day = utcDayString(new Date(BASE_MS));

    await repos.tracking.addWater(250, day, USER_ID, new Date(BASE_MS));
    await repos.tracking.addWater(250, day, USER_ID, new Date(BASE_MS));
    await repos.tracking.addWater(750, day, USER_ID, new Date(BASE_MS));

    expect(await repos.tracking.water(day)).toBe(1250);
    expect(await repos.tracking.water('1999-01-01')).toBe(0);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('weights return the most recent, ascending', async () => {
    const repos = await makeRepositories();

    const kgByOffset = [82.5, 82.25, 82.0];
    for (const offset of [0, 1, 2]) {
      const log: WeightLog = {
        id: repos.fixture.newId(),
        userId: USER_ID,
        day: utcDayString(new Date(BASE_MS + offset * 86_400_000)),
        kg: kgByOffset[offset]!,
        createdAt: new Date(BASE_MS + offset * 86_400_000),
      };
      await repos.tracking.addWeight(log);
    }

    const recentTwo = await repos.tracking.weights(2);
    expect(recentTwo).toHaveLength(2);
    expect(recentTwo.map((log) => log.kg)).toEqual([82.25, 82.0]);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('saved meals insert, list and delete', async () => {
    const repos = await makeRepositories();

    const first: SavedMeal = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      name: 'Chicken Rice Bowl',
      symbol: 'fork.knife',
      kcal: 464,
      itemsJson: '[{"name":"Chicken Rice Bowl","grams":320}]',
      createdAt: new Date(BASE_MS),
    };
    const second: SavedMeal = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      name: 'Protein Oats',
      symbol: null,
      kcal: 380,
      itemsJson: '[]',
      createdAt: new Date(BASE_MS + 60_000),
    };

    await repos.catalog.saveMeal(first);
    await repos.catalog.saveMeal(second);

    let meals = await repos.catalog.savedMeals();
    expect(meals).toHaveLength(2);
    expect(meals[0]?.name).toBe('Protein Oats');

    await repos.catalog.deleteSavedMeal(first.id);
    meals = await repos.catalog.savedMeals();
    expect(meals.map((meal) => meal.id)).toEqual([second.id]);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('custom foods save and list', async () => {
    const repos = await makeRepositories();

    const custom: CustomFood = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      name: 'Homemade Protein Shake',
      basis: 'per_serving',
      kcal: 240,
      proteinG: 30,
      carbsG: 18,
      fatG: 4,
      fiberG: 2,
      servingGrams: 400,
      createdAt: new Date(BASE_MS),
    };
    await repos.catalog.saveCustomFood(custom);

    const foods = await repos.catalog.customFoods();
    expect(foods).toEqual([custom]);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('search foods matches seeded names ordered by name', async () => {
    const repos = await makeRepositories();

    const foods = [
      makeFood('Chicken Burrito', repos.fixture.newId()),
      makeFood('chicken soup', repos.fixture.newId()),
      makeFood('Beef Stew', repos.fixture.newId()),
      makeFood('Grilled Chicken', repos.fixture.newId()),
    ];
    for (const food of foods) {
      await repos.fixture.db.insert(foodsTable).values(foodToRow(food));
    }

    const chicken = await repos.catalog.searchFoods('CHICKEN');
    expect(chicken.map((food) => food.name)).toEqual(['Chicken Burrito', 'Grilled Chicken', 'chicken soup']);

    const percentQuery = await repos.catalog.searchFoods('100%chick_en');
    expect(percentQuery).toEqual([]);

    const recent = await repos.catalog.recentFoods(2);
    expect(recent).toHaveLength(2);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('detail upsert and the join respect soft-deleted diary entries', async () => {
    const repos = await makeRepositories();
    const liveEntryId = repos.fixture.newId();
    const deletedEntryId = repos.fixture.newId();

    // Day grouping follows the local calendar; anchoring at local noon keeps
    // the UTC-vs-local boundary out of the assertion for any host timezone.
    const noon = new Date(BASE_MS);
    noon.setHours(12, 0, 0, 0);

    await insertDiaryEntryRow(repos.fixture, { id: liveEntryId, userId: USER_ID, displayText: 'Chicken Rice Bowl', createdAt: noon, deletedAt: null });
    await insertDiaryEntryRow(repos.fixture, {
      id: deletedEntryId,
      userId: USER_ID,
      displayText: 'Chicken Rice Bowl',
      createdAt: new Date(noon.getTime() + 3_600_000),
      deletedAt: new Date(noon.getTime() + 3_600_000),
    });

    const liveDetail = makeDetail(liveEntryId, 'lunch');
    const deletedDetail = makeDetail(deletedEntryId, 'dinner');
    await repos.detail.upsert(liveDetail);
    await repos.detail.upsert(deletedDetail);

    const day = localDayString(noon);
    const lunch = await repos.detail.details(day, 'lunch');
    expect(lunch).toEqual([liveDetail]);

    const dinner = await repos.detail.details(day, 'dinner');
    expect(dinner).toEqual([]);

    const single = await repos.detail.detail(liveEntryId);
    expect(single).toEqual(liveDetail);

    await repos.detail.delete(liveEntryId);
    const deleted = await repos.detail.detail(liveEntryId);
    expect(deleted).toBeNull();

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });

  it('engagement roundtrips streak, badges and insights', async () => {
    const repos = await makeRepositories();
    const day = utcDayString(new Date(BASE_MS));

    const streak: StreakState = {
      id: 1,
      currentStreak: 12,
      bestStreak: 18,
      freezesLeft: 1,
      freezeUsedOn: null,
      lastLoggedDay: day,
    };
    await repos.engagement.saveStreakState(streak);
    expect(await repos.engagement.streakState()).toEqual(streak);

    await repos.engagement.saveStreakState({ ...streak, currentStreak: 13 });
    expect((await repos.engagement.streakState())?.currentStreak).toBe(13);

    const earned: Badge = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      code: 'first-scan',
      label: 'First Scan',
      detail: 'Logged your first meal',
      earnedAt: new Date(BASE_MS),
      progress: 1,
      target: 1,
    };
    const locked: Badge = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      code: 'streak-30',
      label: '30-Day Streak',
      detail: null,
      earnedAt: null,
      progress: 12,
      target: 30,
    };
    await repos.engagement.awardBadge(earned);
    await repos.engagement.awardBadge(locked);
    const badges = await repos.engagement.badges();
    expect(badges).toHaveLength(2);
    expect(new Set(badges.map((badge) => badge.code))).toEqual(new Set(['first-scan', 'streak-30']));

    const insight: Insight = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      day,
      kind: 'hydration',
      title: 'Hydration is behind',
      body: 'Aim for 2L by evening.',
      createdAt: new Date(BASE_MS),
    };
    await repos.fixture.db.insert(insightsTable).values({
      id: insight.id,
      userId: insight.userId,
      day: insight.day,
      kind: insight.kind,
      title: insight.title,
      body: insight.body,
      createdAt: insight.createdAt.toISOString(),
    });
    expect(await repos.engagement.insights(day)).toEqual([insight]);
    expect(await repos.engagement.insights('1999-01-01')).toEqual([]);

    const exercise: ExerciseLog = {
      id: repos.fixture.newId(),
      userId: USER_ID,
      day,
      exerciseType: 'running',
      durationMin: 30,
      kcalBurned: 300,
      createdAt: new Date(BASE_MS),
    };
    await repos.tracking.addExercise(exercise);
    expect(await repos.tracking.exercises(day)).toEqual([exercise]);

    expect(await countPendingOps(repos.fixture)).toBe(0);
  });
});
