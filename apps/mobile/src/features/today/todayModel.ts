/**
 * TodayModel.swift — the Today screen's state. The SwiftUI model observes the GRDB pool with a
 * ValueObservation; here the same four reads (the day's diary meals with their details, the active
 * target, the water logs, the streak row) arrive through injected readers and are re-read on the
 * sync runtime's re-read signal (`subscribe`). The model owns no database handle: the route file
 * builds the readers over the data environment, Jest builds them with test doubles
 * (standing-order rule 19). The kcal rule is `@coachcal/core`.
 */
import { dayKey, sumMacros } from '@coachcal/core';

import type { StreakState } from '../../data/repos/engagementRepository';
import type { Clock } from '../../data/repos/sqlDb';
import type { UserTarget } from '../../data/repos/targetRepository';

/** TodayModel.MealRow — one live diary row of the selected day. */
export type TodayMeal = {
  id: string;
  title: string;
  mealSlot: string;
  kcal: number | null;
  grams: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  confidence: number | null;
  isSynced: boolean;
  loggedAt: Date;
};

/** The four reads of TodayModel's observation. */
export type TodayReaders = {
  /** Live diary rows (not deleted) of `owner` on the local calendar day `day` (YYYY-MM-DD), oldest first. */
  meals(owner: string, day: string): Promise<TodayMeal[]>;
  activeTarget(owner: string): Promise<UserTarget | null>;
  /** Total ml of the water logs of `day`. */
  waterMl(day: string): Promise<number>;
  streakState(): Promise<StreakState | null>;
};

/** HealthKitService, reduced to what the Steps card calls. */
export type StepsReader = {
  requestAuthorizationIfNeeded(): Promise<boolean>;
  todayStepCount(): Promise<number>;
};

export type TodayModelDeps = {
  readers: TodayReaders;
  /** The additive water ledger write (`TrackingRepository.addWater`). */
  addWater(ml: number, day: string, owner: string, at: Date): Promise<void>;
  /** `notifyLocalMutation()` — called after every write so the other surfaces re-read. */
  notify(): void;
  /** The re-read signal: fires after every local write and sync run. */
  subscribe(listener: () => void): () => void;
  now: Clock;
  ownerId: string;
  /** Absent until the HealthKit unit lands: the Steps card then shows "—" (NoOpHealthKitService). */
  steps?: StepsReader | null;
};

/** TodayModel's observed state; replaced, never mutated, so it is a stable external-store snapshot. */
export type TodaySnapshot = {
  /** False until the first read resolved (the screen shows a spinner, not the empty state). */
  loaded: boolean;
  target: UserTarget | null;
  meals: TodayMeal[];
  waterMl: number;
  streak: StreakState | null;
  selectedDay: Date;
  stepCount: number | null;
  stepsAccessDenied: boolean;
};

export type MacroName = 'protein' | 'carbs' | 'fat' | 'fiber';

export type TodayModel = {
  getSnapshot(): TodaySnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  selectDay(date: Date): void;
  /** Quick-add delta clamped so the day total never goes below 0 ml (T-P04-01). */
  logWaterDelta(deltaMl: number): Promise<void>;
  /** The JIT Steps ask: once, when the card first appears; a repeat after it resolved is a no-op. */
  loadStepsIfNeeded(): Promise<void>;
  /** `now()` — the day progress and the week strip anchor read it live. */
  today(): Date;
  dispose(): void;
};

// --- derived values (TodayModel's computed properties), pure over a snapshot -------------------

/** Sum of the meals' kcal (a meal without kcal counts 0), through the core rule. */
export function consumedKcal(snapshot: TodaySnapshot): number {
  return sumMacros(snapshot.meals.map(toTotalsInput)).kcal;
}

export function consumedMacro(snapshot: TodaySnapshot, macro: MacroName): number {
  const totals = sumMacros(snapshot.meals.map(toTotalsInput));
  switch (macro) {
    case 'protein':
      return totals.proteinG;
    case 'carbs':
      return totals.carbsG;
    case 'fat':
      return totals.fatG;
    case 'fiber':
      return totals.fiberG;
  }
}

export function goalMacro(snapshot: TodaySnapshot, macro: MacroName): number {
  const target = snapshot.target;
  if (target === null) return 0;
  switch (macro) {
    case 'protein':
      return target.proteinG;
    case 'carbs':
      return target.carbsG;
    case 'fat':
      return target.fatG;
    case 'fiber':
      return target.fiberGoalG;
  }
}

/** The kcal goal, or null before the user has a target (the empty state). */
export function goalKcal(snapshot: TodaySnapshot): number | null {
  return snapshot.target?.dailyKcal ?? null;
}

/** The water goal in glasses when the user has no target yet (TodayModel.waterGlasses). */
export const DEFAULT_WATER_GLASSES = 8;

export function waterGlasses(snapshot: TodaySnapshot): number {
  return snapshot.target?.waterGlasses ?? DEFAULT_WATER_GLASSES;
}

/** Fraction of the local day elapsed at `now` (the ED-safe ring's weekly framing input). */
export function dayProgress(now: Date): number {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (now.getTime() - startOfDay.getTime()) / 86_400_000;
}

/** The last seven days ending at `now`, oldest first (TodayModel.weekStripDays). */
export function weekStripDays(now: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, now.getHours(), now.getMinutes(), now.getSeconds());
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function stepsDisplayValue(snapshot: TodaySnapshot): string {
  if (snapshot.stepCount !== null) return String(snapshot.stepCount);
  return snapshot.stepsAccessDenied ? 'Connect' : '—';
}

function toTotalsInput(meal: TodayMeal) {
  return {
    kcal: meal.kcal ?? 0,
    proteinG: meal.proteinG ?? 0,
    carbsG: meal.carbsG ?? 0,
    fatG: meal.fatG ?? 0,
    fiberG: meal.fiberG ?? 0,
  };
}

export function createTodayModel(deps: TodayModelDeps): TodayModel {
  let snapshot: TodaySnapshot = {
    loaded: false,
    target: null,
    meals: [],
    waterMl: 0,
    streak: null,
    selectedDay: deps.now(),
    stepCount: null,
    stepsAccessDenied: false,
  };
  const listeners = new Set<() => void>();
  // A read that finishes after a newer one started must not overwrite it (day switch, quick writes).
  let generation = 0;
  let disposed = false;
  let stepsStarted = false;

  const set = (patch: Partial<TodaySnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of [...listeners]) listener();
  };

  async function refresh(): Promise<void> {
    const ticket = ++generation;
    const day = dayKey(snapshot.selectedDay);
    try {
      const [target, meals, waterMl, streak] = await Promise.all([
        deps.readers.activeTarget(deps.ownerId),
        deps.readers.meals(deps.ownerId, day),
        deps.readers.waterMl(day),
        deps.readers.streakState(),
      ]);
      if (disposed || ticket !== generation) return;
      set({ loaded: true, target, meals, waterMl, streak });
    } catch {
      // Observation failed (pool closed); keep the last snapshot, as the Swift catch does.
    }
  }

  const unsubscribe = deps.subscribe(() => {
    void refresh();
  });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    selectDay(date) {
      if (isSameDay(date, snapshot.selectedDay)) return;
      set({ selectedDay: date });
      void refresh();
    },
    async logWaterDelta(deltaMl) {
      const current = snapshot.waterMl;
      const applied = Math.max(current + deltaMl, 0) - current;
      if (applied === 0) return;
      await deps.addWater(applied, dayKey(snapshot.selectedDay), deps.ownerId, deps.now());
      deps.notify();
    },
    async loadStepsIfNeeded() {
      const steps = deps.steps ?? null;
      if (steps === null || stepsStarted || snapshot.stepCount !== null || snapshot.stepsAccessDenied) return;
      stepsStarted = true;
      if (!(await steps.requestAuthorizationIfNeeded())) {
        set({ stepsAccessDenied: true });
        return;
      }
      let count = 0;
      try {
        count = await steps.todayStepCount();
      } catch {
        // `try?` in Swift: a failed read counts 0.
      }
      set({ stepCount: count });
    },
    today: () => deps.now(),
    dispose() {
      disposed = true;
      unsubscribe();
      listeners.clear();
    },
  };
}
