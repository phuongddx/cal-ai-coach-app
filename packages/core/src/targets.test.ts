import { TargetsEngine } from './targets';

import type { QuizProfile } from './targets';

// Ported 1:1 from TargetsEngineTests.swift: the makeProfile defaults are the
// Swift helper's defaults (male, 80 kg, 180 cm, 30 y, light, lose, 72 kg goal,
// 0.5 kg/week requested pace).

describe('TargetsEngine', () => {
  function makeProfile(overrides: Partial<QuizProfile> = {}): QuizProfile {
    return {
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      age: 30,
      activityLevel: 'light',
      goal: 'lose',
      goalWeightKg: 72,
      requestedPaceKgPerWeek: 0.5,
      ...overrides,
    };
  }

  it('male BMR matches Mifflin-St Jeor', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(TargetsEngine.bmr(makeProfile({ sex: 'male' }))).toBe(1780);
  });

  it('female BMR matches Mifflin-St Jeor', () => {
    // 10×80 + 6.25×180 − 5×30 − 161 = 1614
    expect(TargetsEngine.bmr(makeProfile({ sex: 'female' }))).toBe(1614);
  });

  it('tdee applies all five activity multipliers', () => {
    const bmr = 1780;
    expect(TargetsEngine.tdee(bmr, 'sedentary')).toBe(2136); // ×1.2
    expect(TargetsEngine.tdee(bmr, 'light')).toBe(2448); // ×1.375 → 2447.5
    expect(TargetsEngine.tdee(bmr, 'moderate')).toBe(2759); // ×1.55
    expect(TargetsEngine.tdee(bmr, 'active')).toBe(3071); // ×1.725 → 3070.5
    expect(TargetsEngine.tdee(bmr, 'athlete')).toBe(3382); // ×1.9
  });

  it('goal adjustment applies deficit surplus or none', () => {
    // Male light: BMR 1780 → TDEE 2448.
    const lose = TargetsEngine.targets(makeProfile({ goal: 'lose', requestedPaceKgPerWeek: null }));
    expect(lose.dailyKcal).toBe(1948); // 2448 − 500
    expect(lose.floorsApplied).toBe(false);
    const gain = TargetsEngine.targets(makeProfile({ goal: 'gain', requestedPaceKgPerWeek: null }));
    expect(gain.dailyKcal).toBe(2748); // 2448 + 300
    const maintain = TargetsEngine.targets(makeProfile({ goal: 'maintain', requestedPaceKgPerWeek: null }));
    expect(maintain.dailyKcal).toBe(2448);
    const habit = TargetsEngine.targets(makeProfile({ goal: 'habit', requestedPaceKgPerWeek: null }));
    expect(habit.dailyKcal).toBe(2448);
  });

  it('female target below floor clamps to 1200 with flag and safe pace', () => {
    // Female 155cm/50kg/30y light: BMR 1158 → TDEE 1592 → lose 1092 → floor 1200.
    const targets = TargetsEngine.targets(
      makeProfile({
        sex: 'female',
        weightKg: 50,
        heightCm: 155,
        age: 30,
        activityLevel: 'light',
        goal: 'lose',
        requestedPaceKgPerWeek: 1.5,
      }),
    );
    expect(targets.tdee).toBe(1592);
    expect(targets.dailyKcal).toBe(1200);
    expect(targets.floorsApplied).toBe(true);
    // Floors apply BEFORE the pace clamp: supported deficit is 1592−1200 = 392,
    // so 1.5 kg/wk clamps to 392×7/7700 ≈ 0.36 — not the unclamped 0.45.
    expect(targets.paceKgPerWeek).toBe(0.36);
    expect(targets.paceClamped).toBe(true);
    // Macro ratios at 1200 kcal: 30/40/30 → 90g / 120g / 40g.
    expect(targets.proteinG).toBe(90);
    expect(targets.carbsG).toBe(120);
    expect(targets.fatG).toBe(40);
  });

  it('male target below floor clamps to 1500 with flag', () => {
    // Male 160cm/60kg/40y sedentary: BMR 1405 → TDEE 1686 → lose 1186 → floor 1500.
    const targets = TargetsEngine.targets(
      makeProfile({
        sex: 'male',
        weightKg: 60,
        heightCm: 160,
        age: 40,
        activityLevel: 'sedentary',
        goal: 'lose',
        requestedPaceKgPerWeek: null,
      }),
    );
    expect(targets.dailyKcal).toBe(1500);
    expect(targets.floorsApplied).toBe(true);
  });

  it('target above floor is not flagged', () => {
    // Female 60/165/30y light: BMR 1320 → TDEE 1815 → lose 1315 — above the 1,200 floor.
    const targets = TargetsEngine.targets(
      makeProfile({
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        age: 30,
        activityLevel: 'light',
        goal: 'lose',
        requestedPaceKgPerWeek: null,
      }),
    );
    expect(targets.tdee).toBe(1815);
    expect(targets.dailyKcal).toBe(1315);
    expect(targets.floorsApplied).toBe(false);
  });

  it('requested pace above deficit clamps to supported rate', () => {
    // Male light lose: TDEE 2448, target 1948 → deficit 500 → supported 500×7/7700 ≈ 0.45.
    const targets = TargetsEngine.targets(makeProfile({ goal: 'lose', requestedPaceKgPerWeek: 1.5 }));
    expect(targets.paceKgPerWeek).toBe(0.45);
    expect(targets.paceClamped).toBe(true);
  });

  it('requested pace within deficit passes through unclamped', () => {
    const targets = TargetsEngine.targets(makeProfile({ goal: 'lose', requestedPaceKgPerWeek: 0.3 }));
    expect(targets.paceKgPerWeek).toBe(0.3);
    expect(targets.paceClamped).toBe(false);
  });

  it('maintain goal yields zero pace and flags any request', () => {
    const targets = TargetsEngine.targets(makeProfile({ goal: 'maintain', requestedPaceKgPerWeek: 1.0 }));
    expect(targets.paceKgPerWeek).toBe(0);
    expect(targets.paceClamped).toBe(true);
    expect(targets.floorsApplied).toBe(false);
  });

  it('gain surplus supports about 0 point 27 kg per week', () => {
    const targets = TargetsEngine.targets(makeProfile({ goal: 'gain', requestedPaceKgPerWeek: 1.5 }));
    // Surplus 300 kcal/day → 300×7/7700 ≈ 0.27.
    expect(targets.paceKgPerWeek).toBe(0.27);
    expect(targets.paceClamped).toBe(true);
  });

  it('macro grams derive from thirty forty thirty ratios', () => {
    // 1948 kcal: protein 1948×0.30/4 = 146.1 → 146; carbs ×0.40/4 = 194.8 → 195; fat ×0.30/9 = 64.9 → 65.
    const targets = TargetsEngine.targets(makeProfile({ goal: 'lose', requestedPaceKgPerWeek: null }));
    expect(targets.proteinG).toBe(146);
    expect(targets.carbsG).toBe(195);
    expect(targets.fatG).toBe(65);
    const macros = TargetsEngine.macroGrams(1200);
    expect(macros).toEqual({ proteinG: 90, carbsG: 120, fatG: 40 });
  });

  it('fiber and water defaults are thirty grams and eight glasses', () => {
    const targets = TargetsEngine.targets(makeProfile());
    expect(targets.fiberGoalG).toBe(30);
    expect(targets.waterGlasses).toBe(8);
  });

  it('adversarial body inputs compute without trapping', () => {
    // Weight 400 kg, height 250 cm, age 96 — accepted and computed, never a trap (PRS-02).
    const targets = TargetsEngine.targets(
      makeProfile({
        sex: 'male',
        weightKg: 400,
        heightCm: 250,
        age: 96,
        activityLevel: 'athlete',
        goal: 'lose',
        requestedPaceKgPerWeek: 1.5,
      }),
    );
    // 10×400 + 6.25×250 − 5×96 + 5 = 5087.5 → 5088; TDEE ×1.9 → 9667.
    expect(targets.tdee).toBe(9667);
    expect(targets.dailyKcal).toBe(9167);
    expect(targets.floorsApplied).toBe(false);
    expect(targets.dailyKcal).toBeGreaterThan(0);
    expect(targets.proteinG).toBeGreaterThan(0);
    expect(targets.carbsG).toBeGreaterThan(0);
    expect(targets.fatG).toBeGreaterThan(0);
  });

  it('goal weight below forty kg clamps to healthy boundary', () => {
    expect(TargetsEngine.sanitizedGoalWeightKg(35)).toBe(40);
    expect(TargetsEngine.sanitizedGoalWeightKg(39.9)).toBe(40);
    expect(TargetsEngine.sanitizedGoalWeightKg(40)).toBe(40);
    expect(TargetsEngine.sanitizedGoalWeightKg(72)).toBe(72);
  });

  it('clamped daily kcal enforces floors by sex', () => {
    expect(TargetsEngine.clampedDailyKcal(900, 'female')).toEqual({ kcal: 1200, floored: true });
    expect(TargetsEngine.clampedDailyKcal(1200, 'female')).toEqual({ kcal: 1200, floored: false });
    expect(TargetsEngine.clampedDailyKcal(1100, 'male')).toEqual({ kcal: 1500, floored: true });
    expect(TargetsEngine.clampedDailyKcal(1500, 'male')).toEqual({ kcal: 1500, floored: false });
    expect(TargetsEngine.clampedDailyKcal(2100, 'female')).toEqual({ kcal: 2100, floored: false });
  });

  it('zero deficit lose profile clamps pace to zero', () => {
    // Target at/above TDEE after floors → nothing supports loss → pace 0, never an error.
    const pace = TargetsEngine.clampPace(1.0, 'lose', 2448, 2448);
    expect(pace.pace).toBe(0);
    expect(pace.clamped).toBe(true);
  });
});
