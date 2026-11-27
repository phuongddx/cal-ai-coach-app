/**
 * CatalogRecords.swift / CatalogRepository.swift — the food catalog, saved
 * meals and custom foods (all local-only).
 */
import { desc, eq, sql } from 'drizzle-orm';

import { customFoods, foods, savedMeals } from '../db/schema';
import { toIso, fromIso, type SqlDb } from './sqlDb';

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  per100gKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingGrams: number | null;
  isCustom: boolean;
  createdAt: Date;
}

export interface SavedMeal {
  id: string;
  userId: string;
  name: string;
  symbol: string | null;
  kcal: number;
  itemsJson: string;
  createdAt: Date;
}

export interface CustomFood {
  id: string;
  userId: string;
  name: string;
  basis: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingGrams: number | null;
  createdAt: Date;
}

export function foodToRow(food: Food) {
  return { ...food, createdAt: toIso(food.createdAt) };
}

export function rowToFood(row: typeof foods.$inferSelect): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    per100gKcal: row.per100gKcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    servingGrams: row.servingGrams,
    isCustom: row.isCustom,
    createdAt: fromIso(row.createdAt),
  };
}

export function savedMealToRow(meal: SavedMeal) {
  return { ...meal, createdAt: toIso(meal.createdAt) };
}

export function rowToSavedMeal(row: typeof savedMeals.$inferSelect): SavedMeal {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    symbol: row.symbol,
    kcal: row.kcal,
    itemsJson: row.itemsJson,
    createdAt: fromIso(row.createdAt),
  };
}

export function customFoodToRow(food: CustomFood) {
  return { ...food, createdAt: toIso(food.createdAt) };
}

export function rowToCustomFood(row: typeof customFoods.$inferSelect): CustomFood {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    basis: row.basis,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    servingGrams: row.servingGrams,
    createdAt: fromIso(row.createdAt),
  };
}

export function createCatalogRepository(db: SqlDb) {
  return {
    /** Case-insensitive LIKE over names, `LIKE` wildcards in the query escaped. */
    async searchFoods(query: string, limit = 25): Promise<Food[]> {
      const pattern = `%${escapedLikePattern(query)}%`;
      const rows = await db
        .select()
        .from(foods)
        .where(sql`${foods.name} LIKE ${pattern} ESCAPE '\\'`)
        .orderBy(foods.name)
        .limit(limit);
      return rows.map(rowToFood);
    },

    async recentFoods(limit: number): Promise<Food[]> {
      const rows = await db.select().from(foods).orderBy(desc(foods.createdAt)).limit(limit);
      return rows.map(rowToFood);
    },

    async savedMeals(): Promise<SavedMeal[]> {
      const rows = await db.select().from(savedMeals).orderBy(desc(savedMeals.createdAt));
      return rows.map(rowToSavedMeal);
    },

    async saveMeal(meal: SavedMeal): Promise<void> {
      const row = savedMealToRow(meal);
      await db.insert(savedMeals).values(row).onConflictDoUpdate({ target: savedMeals.id, set: row });
    },

    async deleteSavedMeal(id: string): Promise<void> {
      await db.delete(savedMeals).where(eq(savedMeals.id, id));
    },

    async customFoods(): Promise<CustomFood[]> {
      const rows = await db.select().from(customFoods).orderBy(desc(customFoods.createdAt));
      return rows.map(rowToCustomFood);
    },

    async saveCustomFood(food: CustomFood): Promise<void> {
      const row = customFoodToRow(food);
      await db.insert(customFoods).values(row).onConflictDoUpdate({ target: customFoods.id, set: row });
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

/** CatalogRepository.escapedLikePattern: backslash first, then % and _. */
export function escapedLikePattern(query: string): string {
  return query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
