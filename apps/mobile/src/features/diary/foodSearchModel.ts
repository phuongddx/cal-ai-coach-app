/**
 * FoodSearchModel.swift — the local food search: recents, debounced LIKE
 * search over the seeded catalog plus the per-serving custom foods, exactly as
 * the old app runs it (zero network — LOG-04).
 */
import type { CatalogRepository, CustomFood, Food } from '../../data/repos/catalogRepository';

/** FoodSearchModel.Row — the unified search row over both catalog tables. */
export type FoodSearchRow = {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  basis: string;
  servingGrams: number | null;
  isCustom: boolean;
};

export function rowFromFood(food: Food): FoodSearchRow {
  return {
    id: food.id,
    name: food.name,
    kcal: food.per100gKcal,
    proteinG: food.proteinG,
    basis: 'per_100g',
    servingGrams: food.servingGrams,
    isCustom: food.isCustom,
  };
}

export function rowFromCustom(custom: CustomFood): FoodSearchRow {
  return {
    id: custom.id,
    name: custom.name,
    kcal: custom.kcal,
    proteinG: custom.proteinG,
    basis: custom.basis,
    servingGrams: custom.servingGrams,
    isCustom: true,
  };
}

/** FoodSearchModel.recentLimit. */
export const RECENT_LIMIT = 5;

/** FoodSearchModel.scheduleSearch's 200 ms debounce (T-P04-04). */
const SEARCH_DEBOUNCE_MS = 200;

export type FoodSearchModel = {
  getQuery(): string;
  /** Setting the query schedules the debounced search, as the Swift didSet does. */
  setQuery(query: string): void;
  getResults(): FoodSearchRow[];
  getRecents(): FoodSearchRow[];
  /** The Saved segment's rows: the custom foods the user has. */
  getSaved(): FoodSearchRow[];
  loadRecents(): Promise<void>;
  loadSaved(): Promise<void>;
  applySearch(rawQuery: string): Promise<void>;
  subscribe(listener: () => void): () => void;
  /** Cancels the pending debounce timer. */
  dispose(): void;
};

export function createFoodSearchModel(deps: { catalog: CatalogRepository }): FoodSearchModel {
  let query = '';
  let results: FoodSearchRow[] = [];
  let recents: FoodSearchRow[] = [];
  let saved: FoodSearchRow[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  async function loadRecents(): Promise<void> {
    const foods = await deps.catalog.recentFoods(RECENT_LIMIT).catch(() => []);
    recents = foods.map(rowFromFood);
    emit();
  }

  /** The Saved segment's rows — every custom food the user has (LOG-08). */
  async function loadSaved(): Promise<void> {
    const customs = await deps.catalog.customFoods().catch(() => []);
    saved = customs.map(rowFromCustom);
    emit();
  }

  // The Swift init's `Task { await loadRecents() }` — the Recent card is there
  // before the first query.
  void loadRecents();
  void loadSaved();

  /** Local LIKE search only — zero network (LOG-04). */
  async function applySearch(rawQuery: string): Promise<void> {
    const trimmed = rawQuery.trim();
    if (trimmed === '') {
      results = [];
      emit();
      await loadRecents();
      return;
    }
    const foods = await deps.catalog.searchFoods(trimmed).catch(() => []);
    const rows = foods.map(rowFromFood);
    const customs = await deps.catalog.customFoods().catch(() => []);
    const lowered = trimmed.toLowerCase();
    rows.push(
      ...customs
        .filter((custom) => custom.name.toLowerCase().includes(lowered))
        .map(rowFromCustom),
    );
    results = rows;
    emit();
  }

  return {
    getQuery: () => query,
    setQuery(next: string) {
      query = next;
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      const trimmed = query.trim();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void applySearch(trimmed);
      }, SEARCH_DEBOUNCE_MS);
      emit();
    },
    getResults: () => results,
    getRecents: () => recents,
    getSaved: () => saved,
    loadRecents,
    loadSaved,
    applySearch,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
