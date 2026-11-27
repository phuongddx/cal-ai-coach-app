/**
 * OnboardingModel.swift — the nine-step onboarding state machine. The draft is
 * the engine's QuizProfile; every number the user can change goes back through
 * `TargetsEngine` (pace, reveal kcal, macros), which clamps instead of
 * throwing. Dependencies are constructor-injected (standing order 19): the
 * route file builds them from the data environment, the session store and
 * the debug flags; Jest builds them with test doubles.
 *
 * React surface: the model bumps a `revision` on every mutation, so screens
 * subscribe with `useSyncExternalStore(model.subscribe, model.getRevision)`
 * and read the fields directly — the RN counterpart of Swift's `@Observable`.
 */

import {
  TargetsEngine,
  type ActivityLevel,
  type Goal,
  type QuizProfile,
  type Sex,
  type Targets,
} from '@coachcal/core';

import type { UserTarget } from '../../data/repos/targetRepository';
import { newUuid } from '../../data/sync/uuid';

import { GENERATION_STEPS, onboardingCopy } from './onboardingCopy';

export type { ActivityLevel, Goal, Sex } from '@coachcal/core';

/** The typed step list, in `OnboardingModel.Step` order. */
export const ONBOARDING_STEPS = [
  'valueHero',
  'goal',
  'bodyMetrics',
  'goalWeightPace',
  'activityDiet',
  'projection',
  'privacyHealth',
  'generating',
  'planReveal',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The quiz position each step shows in the progress rail; the reveal sits outside the quiz. */
const QUIZ_INDEX: Record<OnboardingStep, number | null> = {
  valueHero: 1,
  goal: 2,
  bodyMetrics: 3,
  goalWeightPace: 4,
  activityDiet: 5,
  projection: 6,
  privacyHealth: 7,
  generating: 8,
  planReveal: null,
};

export const QUIZ_STEP_COUNT = 8;
export const DEFAULT_BIRTH_YEAR = 1995;
/** The minimum wall-clock window of the generating screen (Swift `minimumGenerationSeconds`). */
export const MINIMUM_GENERATION_SECONDS = 2;

export type GenerationStepState = 'idle' | 'active' | 'done';

export type MacroAxis = 'protein' | 'carbs' | 'fat';

export interface RevealPlan {
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  floored: boolean;
}

/** Constructor-injected dependencies (`OnboardingModel.init`). */
export interface OnboardingModelDeps {
  /** The user of the session when one exists, else the demo user; the route passes it. */
  ownerId: string;
  /** The injected clock (`now: @Sendable () -> Date` in the Swift app). */
  now: () => Date;
  /** `--ccDisableAnimations`: the generating screen skips its minimum window entirely. */
  disableAnimations: boolean;
  /** The route binds this to the data environment's target save. */
  saveTarget: (target: UserTarget) => Promise<void>;
  /** The route binds this to the sync runtime's local-mutation notify. */
  notify: () => void;
  /** The just-in-time HealthKit ask of the privacy screen (`requestHealthAccess`). */
  requestHealthAccess: () => Promise<'granted' | 'denied'>;
}

export class OnboardingModel {
  readonly ownerId: string;

  draft: QuizProfile = {
    sex: 'female',
    heightCm: 165,
    weightKg: 70,
    age: 31,
    activityLevel: 'moderate',
    goal: 'lose',
    goalWeightKg: 65,
    requestedPaceKgPerWeek: 0.5,
  };

  birthYear = DEFAULT_BIRTH_YEAR;
  dietStyle = 'Standard';
  path: OnboardingStep[] = ['valueHero'];

  private readonly now: () => Date;
  private readonly animationsDisabled: boolean;
  private readonly saveTarget: (target: UserTarget) => Promise<void>;
  private readonly notify: () => void;
  readonly requestHealthAccess: () => Promise<'granted' | 'denied'>;

  private paceClampedState = false;
  private targetsState: Targets | null = null;
  private revealState: RevealPlan | null = null;
  private generationStatesState: GenerationStepState[] = GENERATION_STEPS.map(() => 'idle');
  private generationPercentState: number | null = null;
  private persistErrorState: string | null = null;
  private finishedState = false;

  private generationStarted = false;
  private generationTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  constructor(deps: OnboardingModelDeps) {
    this.ownerId = deps.ownerId;
    this.now = deps.now;
    this.animationsDisabled = deps.disableAnimations;
    this.saveTarget = deps.saveTarget;
    this.notify = deps.notify;
    this.requestHealthAccess = deps.requestHealthAccess;
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

  /** Stops the generation timer; the flow view calls it on unmount. */
  dispose(): void {
    this.disposed = true;
    if (this.generationTimer !== null) clearTimeout(this.generationTimer);
  }

  // -- Derived state ----------------------------------------------------------

  get currentStep(): OnboardingStep | null {
    return this.path[this.path.length - 1] ?? null;
  }

  get progress(): number {
    const index = this.currentStep === null ? QUIZ_STEP_COUNT : QUIZ_INDEX[this.currentStep];
    return (index ?? QUIZ_STEP_COUNT) / QUIZ_STEP_COUNT;
  }

  get computedAge(): number {
    return this.now().getFullYear() - this.birthYear;
  }

  currentDate(): Date {
    return this.now();
  }

  get isDobGateBlocked(): boolean {
    return this.computedAge < 18;
  }

  get dobYears(): number[] {
    const currentYear = this.now().getFullYear();
    const years: number[] = [];
    for (let year = currentYear - 100; year <= currentYear; year += 1) years.push(year);
    return years;
  }

  get paceClamped(): boolean {
    return this.paceClampedState;
  }

  get targets(): Targets | null {
    return this.targetsState;
  }

  get reveal(): RevealPlan | null {
    return this.revealState;
  }

  get generationStates(): readonly GenerationStepState[] {
    return this.generationStatesState;
  }

  get generationPercent(): number | null {
    return this.generationPercentState;
  }

  get persistError(): string | null {
    return this.persistErrorState;
  }

  /** Set once the plan is saved and `notify` has run; the flow hands off to the Today tab. */
  get finished(): boolean {
    return this.finishedState;
  }

  // -- Quiz mutations ----------------------------------------------------------

  advance(): void {
    const current = this.currentStep;
    if (current === undefined || current === null) return;
    if (current === 'bodyMetrics' && this.isDobGateBlocked) return;
    this.draft.age = this.computedAge;
    const next: OnboardingStep | null =
      current === 'valueHero'
        ? 'goal'
        : current === 'goal'
          ? 'bodyMetrics'
          : current === 'bodyMetrics'
            ? 'goalWeightPace'
            : current === 'goalWeightPace'
              ? 'activityDiet'
              : current === 'activityDiet'
                ? 'projection'
                : current === 'projection'
                  ? 'privacyHealth'
                  : current === 'privacyHealth'
                    ? 'generating'
                    : null; // generating and planReveal never advance by hand
    if (next !== null) {
      this.path.push(next);
      this.touch();
    }
  }

  selectGoal(goal: Goal): void {
    this.draft.goal = goal;
    if (goal === 'maintain' || goal === 'habit') {
      this.draft.requestedPaceKgPerWeek = null;
      this.paceClampedState = false;
    } else {
      // Always land on an engine-clamped value — re-clamping only when set
      // let the maintain→lose roundtrip keep nil, so the slider displayed
      // 0.50 while the engine computed (and persisted) pace 0.
      this.setPace(this.draft.requestedPaceKgPerWeek ?? 0.5);
    }
    this.touch();
  }

  selectSex(sex: Sex): void {
    this.draft.sex = sex;
    this.touch();
  }

  /**
   * Swift assigns `model.draft.activityLevel` directly and `@Observable` picks
   * the mutation up; the RN subscription needs an explicit mutation to notify.
   */
  selectActivityLevel(level: ActivityLevel): void {
    this.draft.activityLevel = level;
    this.touch();
  }

  /**
   * The body-metrics wheels write through here: Swift assigns the draft
   * fields directly and `@Observable` re-renders; the RN subscription needs
   * the explicit revision bump.
   */
  setHeightCm(cm: number): void {
    this.draft.heightCm = cm;
    this.touch();
  }

  setWeightKg(kg: number): void {
    this.draft.weightKg = kg;
    this.touch();
  }

  setBirthYear(year: number): void {
    this.birthYear = year;
    this.touch();
  }

  setGoalWeightKg(kg: number): void {
    this.draft.goalWeightKg = kg;
    this.touch();
  }

  // The slider value always lands on the engine's clamped result, so the knob
  // snaps back when the requested pace is unsafe.
  setPace(requested: number): void {
    this.draft.requestedPaceKgPerWeek = requested;
    const computed = TargetsEngine.targets(this.draft);
    this.draft.requestedPaceKgPerWeek = computed.paceKgPerWeek;
    this.paceClampedState = computed.paceClamped;
    this.touch();
  }

  selectDietStyle(style: string): void {
    this.dietStyle = style;
    this.touch();
  }

  // -- Plan generation ---------------------------------------------------------

  beginGeneration(): void {
    if (this.generationStarted) return;
    this.generationStarted = true;
    void this.runGeneration();
  }

  private async runGeneration(): Promise<void> {
    const computed = TargetsEngine.targets(this.draft);
    if (this.animationsDisabled) {
      this.finishGeneration(computed);
      return;
    }
    const stepMs = (MINIMUM_GENERATION_SECONDS * 1000) / this.generationStatesState.length;
    for (let index = 0; index < this.generationStatesState.length; index += 1) {
      this.generationStatesState[index] = 'active';
      this.generationPercentState = (index + 1) * 25;
      this.touch();
      if (!(await this.delay(stepMs))) return; // cancelled mid-step
      this.generationStatesState[index] = 'done';
      this.touch();
    }
    this.finishGeneration(computed);
  }

  /** Resolves after `ms`, or early with false when the model is disposed. */
  private delay(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.generationTimer = setTimeout(() => {
        this.generationTimer = null;
        resolve(!this.disposed);
      }, ms);
    });
  }

  private finishGeneration(computed: Targets): void {
    this.targetsState = computed;
    this.revealState = {
      dailyKcal: computed.dailyKcal,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      floored: computed.floorsApplied,
    };
    this.generationStatesState = this.generationStatesState.map(() => 'done');
    this.generationPercentState = 100;
    this.path.push('planReveal');
    this.touch();
  }

  // Test seam: lands the reveal immediately without the minimum animation window.
  finishGenerationForTesting(): void {
    this.finishGeneration(TargetsEngine.targets(this.draft));
  }

  // -- Reveal edits -------------------------------------------------------------

  // Every reveal edit funnels back through the engine, so the kcal floors
  // re-clamp and the displayed macros always re-derive from the daily target.
  adjustRevealKcal(by: number): void {
    const current = this.revealState;
    if (current === null) return;
    this.applyRevealKcal(current.dailyKcal + by);
  }

  adjustRevealMacro(axis: MacroAxis, by: number): void {
    const current = this.revealState;
    if (current === null) return;
    const kcal =
      axis === 'protein'
        ? Math.max(current.proteinG + by, 0) * 4 + current.carbsG * 4 + current.fatG * 9
        : axis === 'carbs'
          ? current.proteinG * 4 + Math.max(current.carbsG + by, 0) * 4 + current.fatG * 9
          : current.proteinG * 4 + current.carbsG * 4 + Math.max(current.fatG + by, 0) * 9;
    this.applyRevealKcal(kcal);
  }

  private applyRevealKcal(kcal: number): void {
    const floored = TargetsEngine.clampedDailyKcal(Math.max(kcal, 0), this.draft.sex);
    const macros = TargetsEngine.macroGrams(floored.kcal);
    this.revealState = {
      dailyKcal: floored.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      floored: floored.floored,
    };
    this.touch();
  }

  // -- Finish --------------------------------------------------------------------

  async persistAndFinish(): Promise<void> {
    const reveal = this.revealState;
    const targets = this.targetsState;
    if (reveal === null || targets === null) return;
    const target: UserTarget = {
      id: newUuid(),
      userId: this.ownerId,
      dailyKcal: reveal.dailyKcal,
      proteinG: reveal.proteinG,
      carbsG: reveal.carbsG,
      fatG: reveal.fatG,
      fiberGoalG: 30,
      waterGlasses: 8,
      sex: this.draft.sex,
      heightCm: this.draft.heightCm,
      weightKg: this.draft.weightKg,
      goalWeightKg:
        this.draft.goalWeightKg === null ? null : TargetsEngine.sanitizedGoalWeightKg(this.draft.goalWeightKg),
      paceKgPerWeek: targets.paceKgPerWeek,
      activity: this.draft.activityLevel,
      goal: this.draft.goal,
      updatedAt: this.now(),
    };
    try {
      await this.saveTarget(target);
      this.notify();
      this.finishedState = true;
      this.persistErrorState = null;
    } catch {
      this.persistErrorState = onboardingCopy.persistError;
    }
    this.touch();
  }
}

/** The route's factory (`createOnboardingModel`) — the brief's injection point. */
export function createOnboardingModel(deps: OnboardingModelDeps): OnboardingModel {
  return new OnboardingModel(deps);
}
