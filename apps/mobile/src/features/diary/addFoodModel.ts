/**
 * AddFoodSheet.swift — the saved receipt, the lenient saved-meal payload and
 * the view-independent re-log write (`AddFoodSheetRoute.performRelog`), plus
 * the small model that loads the rail and performs the re-log through the
 * diary repository. One re-log is one transactional batch of mirror rows,
 * detail rows and one pending op per entry (WR-09).
 */
import type { CatalogRepository } from '../../data/repos/catalogRepository';
import type { DiaryEntryRepository } from '../../data/repos/diaryEntryRepository';
import type { IdGenerator, Clock } from '../../data/repos/sqlDb';

import { mealName } from './diaryMath';
import type { SavedMeal } from '../../data/repos/catalogRepository';
import { createWriteQueue } from './writeQueue';

/** The receipt handed to the presenting surface for the toast and Undo. */
export type SavedReceipt = {
  mealName: string;
  kcalText: string | null;
  entryIds: string[];
};

/**
 * SavedMealItem — a payload row of a saved meal's items_json. kcal is optional
 * so legacy [{name, grams}] payloads still decode; those rows log unresolved
 * (kcal null) instead of borrowing the meal's aggregate figure (CR-01).
 */
export type SavedMealItem = {
  name: string;
  grams: number | null;
  kcal: number | null;
};

/** The scan modes the Add Food tiles hand to the scan flow. */
export type ScanMode = 'photo' | 'barcode' | 'label' | 'text';

/**
 * SavedMealItem decoding, lenient per row: a row needs a string name; grams
 * and kcal may be absent or null. Any other shape decodes to the single
 * fallback row under the meal's own name — the Swift JSONDecoder fallback.
 */
export function decodeSavedMealItems(itemsJson: string, fallbackName: string): SavedMealItem[] {
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      throw new Error('not an array');
    }
    return parsed.map((row) => {
      if (typeof row !== 'object' || row === null || typeof (row as Record<string, unknown>).name !== 'string') {
        throw new Error('row without a name');
      }
      const record = row as Record<string, unknown>;
      const grams = record.grams;
      const kcal = record.kcal;
      return {
        name: record.name as string,
        grams: typeof grams === 'number' ? grams : null,
        kcal: typeof kcal === 'number' ? kcal : null,
      };
    });
  } catch {
    return [{ name: fallbackName, grams: null, kcal: null }];
  }
}

export type PerformRelogInput = {
  itemsJson: string;
  mealName: string;
  mealSlot: string;
  userId: string;
  diaryEntries: DiaryEntryRepository;
  now: Clock;
  newId: IdGenerator;
};

/**
 * AddFoodSheetRoute.performRelog — the write, view-independent: each payload
 * row becomes one mirror entry + one detail row with ITS OWN per-item kcal
 * (never the meal's aggregate), committed as one batch.
 */
export async function performRelog(input: PerformRelogInput): Promise<string[]> {
  const items = decodeSavedMealItems(input.itemsJson, input.mealName);
  const stamp = input.now();
  const upserts = items.map((item) => {
    const entryId = input.newId();
    return {
      entry: {
        id: entryId,
        userId: input.userId,
        displayText: item.name,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
        serverVersion: 0,
        acceptedOpId: null,
        serverUpdatedAt: stamp,
      },
      detail: {
        entryId,
        mealSlot: input.mealSlot,
        title: item.name,
        grams: item.grams,
        kcal: item.kcal,
        proteinG: null,
        carbsG: null,
        fatG: null,
        fiberG: null,
        confidence: null,
        hiddenFatLikely: false,
        source: 'relog',
        unresolved: false,
        scanId: null,
      },
    };
  });
  const operations = await input.diaryEntries.recordUpserts(upserts, stamp);
  return operations.map((operation) => operation.recordId);
}

export type AddFoodModelDeps = {
  catalog: CatalogRepository;
  diaryEntries: DiaryEntryRepository;
  mealSlot: string;
  userId: string;
  notify: () => void;
  now: Clock;
  newId: IdGenerator;
};

export type AddFoodModel = {
  loadSavedMeals(): Promise<SavedMeal[]>;
  /** One-tap re-log: single-flight, then the receipt for the toast. */
  relog(meal: SavedMeal): Promise<SavedReceipt | null>;
};

export function createAddFoodModel(deps: AddFoodModelDeps): AddFoodModel {
  const enqueue = createWriteQueue();

  return {
    async loadSavedMeals() {
      return deps.catalog.savedMeals().catch(() => []);
    },
    relog(meal: SavedMeal) {
      const run = enqueue(async (): Promise<SavedReceipt | null> => {
        try {
          const entryIds = await performRelog({
            itemsJson: meal.itemsJson,
            mealName: meal.name,
            mealSlot: deps.mealSlot,
            userId: deps.userId,
            diaryEntries: deps.diaryEntries,
            now: deps.now,
            newId: deps.newId,
          });
          if (entryIds.length === 0) {
            return null;
          }
          deps.notify();
          return {
            mealName: mealName(deps.mealSlot),
            kcalText: `${meal.kcal} kcal added`,
            entryIds,
          };
        } catch {
          // The rail stays interactive; the rolled-back batch left nothing.
          return null;
        }
      });
      return run;
    },
  };
}
