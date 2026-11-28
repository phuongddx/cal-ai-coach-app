/**
 * TargetEditModel — the "Goals & targets" edit sheet's state (TargetEditSheet
 * 199 Swift lines). The ONLY save path funnels every edit back through
 * `TargetsEngine` so the floors and the 30/40/30 macro split re-clamp (PRS-02).
 * Dependencies are constructor-injected (standing order 19); Jest builds them
 * with test doubles.
 */
import { TargetsEngine, type MacroSplit, type Sex } from '@coachcal/core';

import type { UserTarget } from '../../data/repos/targetRepository';

/** Constructor-injected dependencies (`TargetEditSheet.init`). */
export interface TargetEditModelDeps {
  /** The target the sheet edits; an edit updates the same target row. */
  initial: UserTarget;
  /** The injected clock (`now: @Sendable () -> Date` in the Swift app). */
  now: () => Date;
  /** The route binds this to the data environment's target save (the single write path). */
  saveTarget: (target: UserTarget) => Promise<void>;
}

/** The engine's read of the target's sex; an unknown value is female (Swift `?? .female`). */
function targetSex(sex: string): Sex {
  return sex === 'male' ? 'male' : 'female';
}

/**
 * The single mutation path (TargetEditSheet.reclamped): untrusted edits clamp
 * here, never at callers — the daily kcal clamps to the sex floor, the macros
 * re-derive 30/40/30 from the clamped kcal, the goal weight respects the 40 kg
 * bound, and the untouched fields and id carry over with a fresh timestamp.
 */
export function reclamped(
  initial: UserTarget,
  requestedKcal: number,
  requestedGoalWeightKg: number,
  now: Date,
): UserTarget {
  const sex = targetSex(initial.sex);
  const floored = TargetsEngine.clampedDailyKcal(Math.max(requestedKcal, 0), sex);
  const macros = TargetsEngine.macroGrams(floored.kcal);
  const goalWeight = TargetsEngine.sanitizedGoalWeightKg(requestedGoalWeightKg);
  return {
    id: initial.id,
    userId: initial.userId,
    dailyKcal: floored.kcal,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    fiberGoalG: initial.fiberGoalG,
    waterGlasses: initial.waterGlasses,
    sex: initial.sex,
    heightCm: initial.heightCm,
    weightKg: initial.weightKg,
    goalWeightKg: goalWeight,
    paceKgPerWeek: initial.paceKgPerWeek,
    activity: initial.activity,
    goal: initial.goal,
    updatedAt: now,
  };
}

export class TargetEditModel {
  dailyKcal: number;
  goalWeightKg: number;

  private readonly deps: TargetEditModelDeps;

  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  constructor(deps: TargetEditModelDeps) {
    this.deps = deps;
    this.dailyKcal = deps.initial.dailyKcal;
    this.goalWeightKg = deps.initial.goalWeightKg ?? deps.initial.weightKg ?? 70;
  }
  // -- React seam ------------------------------------------------------------

  /** Re-renders subscribers on every mutation; snapshot is a stable number. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  readonly getRevision = (): number => this.revision;

  private touch(): void {
    this.revision += 1;
    for (const listener of [...this.subscribers]) listener();
  }

  // -- Derived state ----------------------------------------------------------

  get sex(): Sex {
    return targetSex(this.deps.initial.sex);
  }

  get floorKcal(): number {
    return this.sex === 'female' ? TargetsEngine.femaleFloorKcal : TargetsEngine.maleFloorKcal;
  }

  get isFloored(): boolean {
    return this.dailyKcal < this.floorKcal;
  }

  /**
   * The engine's clamped read of the displayed goal weight (U-77's guardrail):
   * `TargetsEngine` has one flat minimum (`minGoalWeightKg`) and no minimum
   * that depends on the saved height — the frame's height-based healthy floor
   * is an engine follow-up. When the displayed goal sits under the engine's
   * minimum, the save clamps and the sheet shows the caution card with the
   * clamped value; the wheel's own 40…150 range can only carry a sub-floor
   * goal in from stored data.
   */
  get clampedGoalWeightKg(): number {
    return TargetsEngine.sanitizedGoalWeightKg(this.goalWeightKg);
  }

  get goalClamped(): boolean {
    return this.clampedGoalWeightKg !== this.goalWeightKg;
  }

  /** The 30/40/30 preview of the current (unclamped display) kcal. */
  macros(): MacroSplit {
    return TargetsEngine.macroGrams(Math.max(this.dailyKcal, 0));
  }

  // -- Edits ------------------------------------------------------------------

  /** The plan-reveal edit idiom: ±50 kcal steps, never below zero. */
  adjustKcal(delta: number): void {
    this.dailyKcal = delta < 0 ? Math.max(this.dailyKcal + delta, 0) : this.dailyKcal + delta;
    this.touch();
  }

  setGoalWeight(kg: number): void {
    this.goalWeightKg = kg;
    this.touch();
  }

  /**
   * Save: reclamps through the engine, stores through the injected save and
   * returns the saved target for the caller.
   */
  async save(): Promise<UserTarget> {
    const target = reclamped(this.deps.initial, this.dailyKcal, this.goalWeightKg, this.deps.now());
    await this.deps.saveTarget(target);
    return target;
  }
}

export function createTargetEditModel(deps: TargetEditModelDeps): TargetEditModel {
  return new TargetEditModel(deps);
}
