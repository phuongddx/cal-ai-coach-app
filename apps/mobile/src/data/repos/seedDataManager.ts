/**
 * SeedDataManager.swift — the demo persona seed (WR-07/WR-10): one target,
 * seven diary entries with details (nutrition derived through the core
 * arithmetic, never a private copy), the food catalog rows from
 * seed/foods.json, rail meals in the current per-item payload shape, tracking
 * logs, streak, badges and insights. Idempotent through the `seed_version`
 * app setting; seed writes never enqueue sync operations.
 */
import { roundKcal, roundMacro, dayKey } from '@coachcal/core';

import {
  badges,
  customFoods,
  diaryEntryDetails,
  diaryEntries,
  exerciseLogs,
  foods,
  insights,
  savedMeals,
  streakState,
  userTargets,
  waterLogs,
  weightLogs,
} from '../db/schema';
import { readAppSetting, writeAppSetting, badgeToRow, insightToRow, streakStateToRow } from './engagementRepository';
import { targetToRow } from './targetRepository';
import { customFoodToRow, foodToRow, savedMealToRow } from './catalogRepository';
import { detailToRow, entryToRow } from './diaryEntryRepository';
import { inTransaction, toIso, type Clock, type IdGenerator, type SqlDb, type SqlTx } from './sqlDb';
import { newUuid } from '../sync/uuid';
import FOOD_SEED from '../db/seed/foods.json';

export const SEED_VERSION_KEY = 'seed_version';
export const SEED_VERSION = 'demo_v1';

/** SeedDataManager.demoUserId — DE000000-0000-4000-8000-000000000001. */
export const DEMO_USER_ID = 'de000000-0000-4000-8000-000000000001';

export interface SeededFoodRow {
  name: string;
  brand: string | null;
  per100gKcal: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  servingGrams: number | null;
}

/** The rows of SeedDataManager.swift's `seededFoods`, unchanged. */
export const seededFoods = FOOD_SEED as readonly SeededFoodRow[];

const DAY_SECONDS = 86_400;
const HOUR_MS = 3_600_000;
const DAY_MS = DAY_SECONDS * 1_000;

interface SeededMeal {
  slot: string;
  title: string;
  grams: number;
  per100gKcal: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  confidence: number;
  hiddenFatLikely: boolean;
}

// The rows of SeedDataManager.swift's `seededMeals`, unchanged.
const seededMeals: SeededMeal[] = [
  { slot: 'breakfast', title: 'Oatmeal with Blueberries', grams: 250, per100gKcal: 150, proteinPer100g: 6, carbsPer100g: 30, fatPer100g: 3, fiberPer100g: 4, confidence: 0.92, hiddenFatLikely: false },
  { slot: 'lunch', title: 'Chicken Rice Bowl', grams: 320, per100gKcal: 145, proteinPer100g: 27, carbsPer100g: 40, fatPer100g: 4, fiberPer100g: 2, confidence: 0.92, hiddenFatLikely: false },
  { slot: 'dinner', title: 'Salmon with Quinoa', grams: 300, per100gKcal: 180, proteinPer100g: 22, carbsPer100g: 28, fatPer100g: 6, fiberPer100g: 3, confidence: 0.76, hiddenFatLikely: false },
  { slot: 'snacks', title: 'Greek Yogurt with Almonds', grams: 180, per100gKcal: 120, proteinPer100g: 10, carbsPer100g: 8, fatPer100g: 5, fiberPer100g: 1, confidence: 0.76, hiddenFatLikely: false },
  { slot: 'breakfast', title: 'Avocado Toast with Egg', grams: 200, per100gKcal: 210, proteinPer100g: 8, carbsPer100g: 18, fatPer100g: 13, fiberPer100g: 5, confidence: 0.61, hiddenFatLikely: false },
  { slot: 'lunch', title: 'Caesar Salad with Dressing', grams: 280, per100gKcal: 160, proteinPer100g: 9, carbsPer100g: 10, fatPer100g: 12, fiberPer100g: 2, confidence: 0.92, hiddenFatLikely: true },
  { slot: 'dinner', title: 'Spaghetti Bolognese', grams: 350, per100gKcal: 155, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 5, fiberPer100g: 2, confidence: 0.61, hiddenFatLikely: false },
];

interface SeededRailItem {
  name: string;
  grams: number;
  per100gKcal: number;
}

/** SavedMealItemPayload wire shape: [{name, grams, kcal}] — per-item kcal. */
function savedMealItemsJson(items: SeededRailItem[]): string {
  return JSON.stringify(
    items.map((item) => ({ name: item.name, grams: item.grams, kcal: roundKcal(item.per100gKcal, item.grams) })),
  );
}

function railKcal(items: SeededRailItem[]): number {
  return items.reduce((total, item) => total + roundKcal(item.per100gKcal, item.grams), 0);
}

export type SeedDataManagerDeps = {
  now?: Clock;
  newId?: IdGenerator;
};

export function createSeedDataManager(db: SqlDb, deps: SeedDataManagerDeps = {}) {
  const now: Clock = deps.now ?? (() => new Date());
  const newId: IdGenerator = deps.newId ?? newUuid;

  return {
    /** Seeds the demo persona once; a second call is a no-op. */
    async ensureSeeded(seedTargets = true): Promise<void> {
      await inTransaction(db, async (tx) => {
        const seeded = await readAppSetting(tx, SEED_VERSION_KEY);
        if (seeded === SEED_VERSION) {
          return;
        }

        const current = now();
        const user = DEMO_USER_ID;

        if (seedTargets) {
          await tx.insert(userTargets).values(
            targetToRow({
              id: newId(),
              userId: user,
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
              updatedAt: current,
            }),
          );
        }

        for (const [offset, meal] of seededMeals.entries()) {
          const createdAt = new Date(current.getTime() - (6 - offset) * DAY_MS);
          const entryId = newId();
          await tx.insert(diaryEntries).values(
            entryToRow({
              id: entryId,
              userId: user,
              displayText: meal.title,
              createdAt,
              updatedAt: createdAt,
              deletedAt: null,
              serverVersion: 100 + offset,
              acceptedOpId: newId(),
              serverUpdatedAt: createdAt,
            }),
          );
          await tx.insert(diaryEntryDetails).values(
            detailToRow({
              entryId,
              mealSlot: meal.slot,
              title: meal.title,
              grams: meal.grams,
              kcal: roundKcal(meal.per100gKcal, meal.grams),
              proteinG: roundMacro(meal.proteinPer100g, meal.grams),
              carbsG: roundMacro(meal.carbsPer100g, meal.grams),
              fatG: roundMacro(meal.fatPer100g, meal.grams),
              fiberG: roundMacro(meal.fiberPer100g, meal.grams),
              confidence: meal.confidence,
              hiddenFatLikely: meal.hiddenFatLikely,
              source: 'cache',
              unresolved: false,
              scanId: null,
            }),
          );
        }

        for (const [offset, food] of seededFoods.entries()) {
          const createdAt = new Date(current.getTime() - offset * HOUR_MS);
          await tx.insert(foods).values(
            foodToRow({
              id: newId(),
              name: food.name,
              brand: food.brand,
              per100gKcal: food.per100gKcal,
              proteinG: food.proteinPer100g,
              carbsG: food.carbsPer100g,
              fatG: food.fatPer100g,
              fiberG: food.fiberPer100g,
              servingGrams: food.servingGrams,
              isCustom: false,
              createdAt,
            }),
          );
        }

        // Rail fixtures in the current payload shape (per-item kcal via the
        // core arithmetic) so the demo re-log exercises the same path as
        // scan-saved meals.
        const chickenItems: SeededRailItem[] = [{ name: 'Chicken Rice Bowl', grams: 320, per100gKcal: 145 }];
        const oatsItems: SeededRailItem[] = [{ name: 'Protein Oats', grams: 250, per100gKcal: 152 }];
        const savedMealsToSeed = [
          {
            id: newId(),
            userId: user,
            name: 'Chicken Rice Bowl',
            symbol: 'fork.knife',
            kcal: railKcal(chickenItems),
            itemsJson: savedMealItemsJson(chickenItems),
            createdAt: current,
          },
          {
            id: newId(),
            userId: user,
            name: 'Protein Oats',
            symbol: null,
            kcal: railKcal(oatsItems),
            itemsJson: savedMealItemsJson(oatsItems),
            createdAt: new Date(current.getTime() - 600_000),
          },
        ];
        for (const meal of savedMealsToSeed) {
          await tx.insert(savedMeals).values(savedMealToRow(meal));
        }

        await tx.insert(customFoods).values(
          customFoodToRow({
            id: newId(),
            userId: user,
            name: 'Homemade Protein Shake',
            basis: 'per_serving',
            kcal: 240,
            proteinG: 30,
            carbsG: 18,
            fatG: 4,
            fiberG: 2,
            servingGrams: 400,
            createdAt: current,
          }),
        );

        const today = dayKey(current);
        for (let index = 0; index < 5; index += 1) {
          await tx.insert(waterLogs).values({
            id: newId(),
            userId: user,
            day: today,
            ml: 250,
            createdAt: toIso(current),
          });
        }

        for (let index = 0; index < 8; index += 1) {
          const offsetMs = (7 - index) * 7 * DAY_MS;
          const at = new Date(current.getTime() + offsetMs);
          await tx.insert(weightLogs).values({
            id: newId(),
            userId: user,
            day: dayKey(at),
            kg: 82.4 - index * 0.35,
            createdAt: toIso(at),
          });
        }

        await tx.insert(exerciseLogs).values({
          id: newId(),
          userId: user,
          day: today,
          exerciseType: 'running',
          durationMin: 30,
          kcalBurned: 300,
          createdAt: toIso(current),
        });
        await tx.insert(exerciseLogs).values({
          id: newId(),
          userId: user,
          day: dayKey(new Date(current.getTime() - DAY_MS)),
          exerciseType: 'strength',
          durationMin: 45,
          kcalBurned: null,
          createdAt: toIso(new Date(current.getTime() - DAY_MS)),
        });

        await tx.insert(streakState).values(
          streakStateToRow({
            id: 1,
            currentStreak: 12,
            bestStreak: 18,
            freezesLeft: 1,
            freezeUsedOn: null,
            lastLoggedDay: dayKey(new Date(current.getTime() - DAY_MS)),
          }),
        );

        const badgesToSeed = [
          { code: 'first-scan', label: 'First Scan', detail: 'Logged your first meal', earnedOffsetDays: -6, progress: 1, target: 1 },
          { code: 'streak-7', label: '7-Day Streak', detail: 'Logged meals seven days in a row', earnedOffsetDays: -5, progress: 1, target: 1 },
          { code: 'water-habit', label: 'Hydration Habit', detail: 'Hit your water goal five times', earnedOffsetDays: -2, progress: 1, target: 1 },
          { code: 'streak-30', label: '30-Day Streak', detail: null, earnedOffsetDays: null, progress: 12, target: 30 },
          { code: 'scans-50', label: '50 Scans', detail: null, earnedOffsetDays: null, progress: 18, target: 50 },
        ];
        for (const badge of badgesToSeed) {
          await tx.insert(badges).values(
            badgeToRow({
              id: newId(),
              userId: user,
              code: badge.code,
              label: badge.label,
              detail: badge.detail,
              earnedAt: badge.earnedOffsetDays === null ? null : new Date(current.getTime() + badge.earnedOffsetDays * DAY_MS),
              progress: badge.progress,
              target: badge.target,
            }),
          );
        }

        const insightsToSeed = [
          { kind: 'streak', title: '12-day streak going strong', body: "Log today's meals to extend your streak to 13 days.", offsetMs: 0 },
          { kind: 'hydration', title: 'Hydration is behind', body: "You've logged 1.25L so far. Aim for 2L by evening.", offsetMs: -60_000 },
          { kind: 'protein', title: 'Protein pacing looks good', body: "You're averaging 121g protein this week.", offsetMs: -120_000 },
        ];
        for (const insight of insightsToSeed) {
          await tx.insert(insights).values(
            insightToRow({
              id: newId(),
              userId: user,
              day: today,
              kind: insight.kind,
              title: insight.title,
              body: insight.body,
              createdAt: new Date(current.getTime() + insight.offsetMs),
            }),
          );
        }

        await writeAppSetting(tx, SEED_VERSION_KEY, SEED_VERSION);
      });
    },
  };
}

export type SeedDataManager = ReturnType<typeof createSeedDataManager>;
