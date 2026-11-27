/**
 * TargetsEngine.swift — pure targets math (PRS-01/PRS-02): Mifflin-St Jeor
 * BMR, TDEE activity multipliers, goal adjustments, 1,200/1,500 kcal floors
 * and safe-pace limits. Every untrusted input CLAMPS with a flag — nothing
 * throws or traps. Zero imports by contract.
 */

export type Sex = 'female' | 'male';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export type Goal = 'lose' | 'maintain' | 'gain' | 'habit';

/** TDEE multipliers per activity level (Swift `ActivityLevel.multiplier`). */
export const ACTIVITY_MULTIPLIER: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export interface QuizProfile {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  goalWeightKg: number | null;
  requestedPaceKgPerWeek: number | null;
}

export interface Targets {
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberGoalG: number;
  waterGlasses: number;
  paceKgPerWeek: number;
  floorsApplied: boolean;
  paceClamped: boolean;
  tdee: number;
}

export interface ClampedKcal {
  kcal: number;
  floored: boolean;
}

export interface ClampedPace {
  pace: number;
  clamped: boolean;
}

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Standard energy density of body mass (kcal per kg). */
const KCAL_PER_KG = 7700;

export const TargetsEngine = {
  femaleFloorKcal: 1200,
  maleFloorKcal: 1500,
  minGoalWeightKg: 40,
  safePaceMaxKgPerWeek: 1,

  /** Mifflin-St Jeor (assumption A1) — isolated here so a formula swap is one line. */
  bmr(profile: QuizProfile): number {
    const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
    const sexOffset = profile.sex === 'male' ? 5 : -161;
    return Math.round(base + sexOffset);
  },

  tdee(bmr: number, activity: ActivityLevel): number {
    return Math.round(bmr * ACTIVITY_MULTIPLIER[activity]);
  },

  clampedDailyKcal(kcal: number, sex: Sex): ClampedKcal {
    const floor = sex === 'female' ? TargetsEngine.femaleFloorKcal : TargetsEngine.maleFloorKcal;
    return kcal < floor ? { kcal: floor, floored: true } : { kcal, floored: false };
  },

  /** Protein 30% / carbs 40% / fat 30% of daily kcal, converted at 4/4/9 kcal per gram. */
  macroGrams(kcal: number): MacroSplit {
    return {
      proteinG: Math.round((kcal * 0.3) / 4),
      carbsG: Math.round((kcal * 0.4) / 4),
      fatG: Math.round((kcal * 0.3) / 9),
    };
  },

  /** A requested pace is honored only as far as the daily kcal delta supports it. */
  clampPace(requested: number, goal: Goal, dailyKcal: number, tdee: number): ClampedPace {
    let dailyDelta: number;
    switch (goal) {
      case 'lose':
        dailyDelta = Math.max(tdee - dailyKcal, 0);
        break;
      case 'gain':
        dailyDelta = Math.max(dailyKcal - tdee, 0);
        break;
      case 'maintain':
      case 'habit':
        dailyDelta = 0;
        break;
    }
    const supported = (dailyDelta * 7) / KCAL_PER_KG;
    const bounded = Math.min(Math.max(requested, 0), supported, TargetsEngine.safePaceMaxKgPerWeek);
    const pace = Math.round(bounded * 100) / 100;
    const requestedRounded = Math.round(Math.max(requested, 0) * 100) / 100;
    return { pace, clamped: pace !== requestedRounded };
  },

  sanitizedGoalWeightKg(goalWeightKg: number): number {
    return Math.max(goalWeightKg, TargetsEngine.minGoalWeightKg);
  },

  /**
   * Order matters: goal adjustment → floors by sex → pace clamp against the
   * floored target, so the pace never implies a deficit the plan doesn't carry.
   */
  targets(profile: QuizProfile): Targets {
    const bmrValue = TargetsEngine.bmr(profile);
    const tdeeValue = TargetsEngine.tdee(bmrValue, profile.activityLevel);
    const adjustment: number =
      profile.goal === 'lose' ? -500 : profile.goal === 'gain' ? 300 : 0;
    const floored = TargetsEngine.clampedDailyKcal(tdeeValue + adjustment, profile.sex);
    const macros = TargetsEngine.macroGrams(floored.kcal);
    const pace: ClampedPace =
      profile.requestedPaceKgPerWeek !== null
        ? TargetsEngine.clampPace(profile.requestedPaceKgPerWeek, profile.goal, floored.kcal, tdeeValue)
        : { pace: 0, clamped: false };
    return {
      dailyKcal: floored.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      fiberGoalG: 30,
      waterGlasses: 8,
      paceKgPerWeek: pace.pace,
      floorsApplied: floored.floored,
      paceClamped: pace.clamped,
      tdee: tdeeValue,
    };
  },
} as const;
