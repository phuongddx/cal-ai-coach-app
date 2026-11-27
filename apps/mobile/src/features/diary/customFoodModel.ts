/**
 * CustomFoodSheet.swift — the custom-food creation rules: per-100g or
 * per-serving basis, kcal clamped 0–2000, gram fields clamped 0–500, serving
 * grams clamped 0–5000 (T-P04-01). Saved through the catalog repository so
 * later searches surface it (LOG-08).
 */
import type { CatalogRepository } from '../../data/repos/catalogRepository';
import type { Clock, IdGenerator } from '../../data/repos/sqlDb';

import { rowFromCustom, type FoodSearchRow } from './foodSearchModel';

/** CustomFoodSheet.Basis — values must match the custom_foods CHECK constraint. */
export type CustomFoodBasis = 'per100g' | 'per_serving';

export const KCAL_CLAMP = { min: 0, max: 2000 } as const;
export const GRAM_CLAMP = { min: 0, max: 500 } as const;
export const SERVING_GRAMS_CLAMP = { min: 0, max: 5000 } as const;

/**
 * CustomFoodSheet.clampedInt — integer strings only (Swift `Int(text)`);
 * unparsable text is null, parsable text clamps into the range.
 */
export function clampedInt(text: string, range: { min: number; max: number }): number | null {
  if (!/^[+-]?\d+$/.test(text)) {
    return null;
  }
  const parsed = Number(text);
  return Math.min(Math.max(parsed, range.min), range.max);
}

export type CustomFoodDraft = {
  name: string;
  basis: CustomFoodBasis;
  kcalText: string;
  proteinText: string;
  carbsText: string;
  fatText: string;
  fiberText: string;
  servingGramsText: string;
};

/** CustomFoodSheet.canSave — a trimmed name and a parsable kcal figure. */
export function canSaveCustomFood(draft: CustomFoodDraft): boolean {
  return draft.name.trim().length > 0 && clampedInt(draft.kcalText, KCAL_CLAMP) !== null;
}

export type CustomFoodModelDeps = {
  catalog: CatalogRepository;
  userId: string;
  now: Clock;
  newId: IdGenerator;
};

export type CustomFoodModel = {
  /** Saves the draft; resolves the search row, or null when the write failed. */
  save(draft: CustomFoodDraft): Promise<FoodSearchRow | null>;
};

export function createCustomFoodModel(deps: CustomFoodModelDeps): CustomFoodModel {
  return {
    async save(draft: CustomFoodDraft) {
      const kcal = clampedInt(draft.kcalText, KCAL_CLAMP);
      if (kcal === null) {
        return null;
      }
      try {
        const custom = {
          id: deps.newId(),
          userId: deps.userId,
          name: draft.name.trim(),
          basis: draft.basis,
          kcal,
          proteinG: clampedInt(draft.proteinText, GRAM_CLAMP) ?? 0,
          carbsG: clampedInt(draft.carbsText, GRAM_CLAMP) ?? 0,
          fatG: clampedInt(draft.fatText, GRAM_CLAMP) ?? 0,
          fiberG: clampedInt(draft.fiberText, GRAM_CLAMP) ?? 0,
          servingGrams: clampedInt(draft.servingGramsText, SERVING_GRAMS_CLAMP),
          createdAt: deps.now(),
        };
        await deps.catalog.saveCustomFood(custom);
        return rowFromCustom(custom);
      } catch {
        // The sheet stays up; the user can retry the local write.
        return null;
      }
    },
  };
}
