import Testing

@testable import CoachCalCore

@Suite
struct TargetsEngineTests {
  // Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + 5 (male) / − 161 (female).
  private func makeProfile(
    sex: TargetsEngine.Sex = .male,
    weightKg: Double = 80,
    heightCm: Double = 180,
    age: Int = 30,
    activity: TargetsEngine.ActivityLevel = .light,
    goal: TargetsEngine.Goal = .lose,
    goalWeightKg: Double? = 72,
    requestedPaceKgPerWeek: Double? = 0.5
  ) -> TargetsEngine.QuizProfile {
    TargetsEngine.QuizProfile(
      sex: sex,
      heightCm: heightCm,
      weightKg: weightKg,
      age: age,
      activityLevel: activity,
      goal: goal,
      goalWeightKg: goalWeightKg,
      requestedPaceKgPerWeek: requestedPaceKgPerWeek
    )
  }

  @Test
  func maleBMRMatchesMifflinStJeor() {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    #expect(TargetsEngine.bmr(makeProfile(sex: .male)) == 1780)
  }

  @Test
  func femaleBMRMatchesMifflinStJeor() {
    // 10×80 + 6.25×180 − 5×30 − 161 = 1614
    #expect(TargetsEngine.bmr(makeProfile(sex: .female)) == 1614)
  }

  @Test
  func tdeeAppliesAllFiveActivityMultipliers() {
    let bmr = 1780
    #expect(TargetsEngine.tdee(bmr: bmr, activity: .sedentary) == 2136) // ×1.2
    #expect(TargetsEngine.tdee(bmr: bmr, activity: .light) == 2448) // ×1.375 → 2447.5
    #expect(TargetsEngine.tdee(bmr: bmr, activity: .moderate) == 2759) // ×1.55
    #expect(TargetsEngine.tdee(bmr: bmr, activity: .active) == 3071) // ×1.725 → 3070.5
    #expect(TargetsEngine.tdee(bmr: bmr, activity: .athlete) == 3382) // ×1.9
  }

  @Test
  func goalAdjustmentAppliesDeficitSurplusOrNone() {
    // Male light: BMR 1780 → TDEE 2448.
    let lose = TargetsEngine.targets(for: makeProfile(goal: .lose, requestedPaceKgPerWeek: nil))
    #expect(lose.dailyKcal == 1948) // 2448 − 500
    #expect(lose.floorsApplied == false)
    let gain = TargetsEngine.targets(for: makeProfile(goal: .gain, requestedPaceKgPerWeek: nil))
    #expect(gain.dailyKcal == 2748) // 2448 + 300
    let maintain = TargetsEngine.targets(for: makeProfile(goal: .maintain, requestedPaceKgPerWeek: nil))
    #expect(maintain.dailyKcal == 2448)
    let habit = TargetsEngine.targets(for: makeProfile(goal: .habit, requestedPaceKgPerWeek: nil))
    #expect(habit.dailyKcal == 2448)
  }

  @Test
  func femaleTargetBelowFloorClampsTo1200WithFlagAndSafePace() {
    // Female 155cm/50kg/30y light: BMR 1158 → TDEE 1592 → lose 1092 → floor 1200.
    let profile = makeProfile(
      sex: .female,
      weightKg: 50,
      heightCm: 155,
      age: 30,
      activity: .light,
      goal: .lose,
      requestedPaceKgPerWeek: 1.5
    )
    let targets = TargetsEngine.targets(for: profile)
    #expect(targets.tdee == 1592)
    #expect(targets.dailyKcal == 1200)
    #expect(targets.floorsApplied == true)
    // Floors apply BEFORE the pace clamp: supported deficit is 1592−1200 = 392,
    // so 1.5 kg/wk clamps to 392×7/7700 ≈ 0.36 — not the unclamped 0.45.
    #expect(targets.paceKgPerWeek == 0.36)
    #expect(targets.paceClamped == true)
    // Macro ratios at 1200 kcal: 30/40/30 → 90g / 120g / 40g.
    #expect(targets.proteinG == 90)
    #expect(targets.carbsG == 120)
    #expect(targets.fatG == 40)
  }

  @Test
  func maleTargetBelowFloorClampsTo1500WithFlag() {
    // Male 160cm/60kg/40y sedentary: BMR 1405 → TDEE 1686 → lose 1186 → floor 1500.
    let profile = makeProfile(
      sex: .male,
      weightKg: 60,
      heightCm: 160,
      age: 40,
      activity: .sedentary,
      goal: .lose,
      requestedPaceKgPerWeek: nil
    )
    let targets = TargetsEngine.targets(for: profile)
    #expect(targets.dailyKcal == 1500)
    #expect(targets.floorsApplied == true)
  }

  @Test
  func targetAboveFloorIsNotFlagged() {
    // Female 60/165/30y light: BMR 1320 → TDEE 1815 → lose 1315 — above the 1,200 floor.
    let profile = makeProfile(
      sex: .female,
      weightKg: 60,
      heightCm: 165,
      age: 30,
      activity: .light,
      goal: .lose,
      requestedPaceKgPerWeek: nil
    )
    let targets = TargetsEngine.targets(for: profile)
    #expect(targets.tdee == 1815)
    #expect(targets.dailyKcal == 1315)
    #expect(targets.floorsApplied == false)
  }

  @Test
  func requestedPaceAboveDeficitClampsToSupportedRate() {
    // Male light lose: TDEE 2448, target 1948 → deficit 500 → supported 500×7/7700 ≈ 0.45.
    let profile = makeProfile(goal: .lose, requestedPaceKgPerWeek: 1.5)
    let targets = TargetsEngine.targets(for: profile)
    #expect(targets.paceKgPerWeek == 0.45)
    #expect(targets.paceClamped == true)
  }

  @Test
  func requestedPaceWithinDeficitPassesThroughUnclamped() {
    let targets = TargetsEngine.targets(for: makeProfile(goal: .lose, requestedPaceKgPerWeek: 0.3))
    #expect(targets.paceKgPerWeek == 0.3)
    #expect(targets.paceClamped == false)
  }

  @Test
  func maintainGoalYieldsZeroPaceAndFlagsAnyRequest() {
    let targets = TargetsEngine.targets(for: makeProfile(goal: .maintain, requestedPaceKgPerWeek: 1.0))
    #expect(targets.paceKgPerWeek == 0)
    #expect(targets.paceClamped == true)
    #expect(targets.floorsApplied == false)
  }

  @Test
  func gainSurplusSupportsAbout0Point27KgPerWeek() {
    let targets = TargetsEngine.targets(for: makeProfile(goal: .gain, requestedPaceKgPerWeek: 1.5))
    // Surplus 300 kcal/day → 300×7/7700 ≈ 0.27.
    #expect(targets.paceKgPerWeek == 0.27)
    #expect(targets.paceClamped == true)
  }

  @Test
  func macroGramsDeriveFromThirtyFortyThirtyRatios() {
    // 1948 kcal: protein 1948×0.30/4 = 146.1 → 146; carbs ×0.40/4 = 194.8 → 195; fat ×0.30/9 = 64.9 → 65.
    let targets = TargetsEngine.targets(for: makeProfile(goal: .lose, requestedPaceKgPerWeek: nil))
    #expect(targets.proteinG == 146)
    #expect(targets.carbsG == 195)
    #expect(targets.fatG == 65)
    let macros = TargetsEngine.macroGrams(forKcal: 1200)
    #expect(macros.proteinG == 90)
    #expect(macros.carbsG == 120)
    #expect(macros.fatG == 40)
  }

  @Test
  func fiberAndWaterDefaultsAreThirtyGramsAndEightGlasses() {
    let targets = TargetsEngine.targets(for: makeProfile())
    #expect(targets.fiberGoalG == 30)
    #expect(targets.waterGlasses == 8)
  }

  @Test
  func adversarialBodyInputsComputeWithoutTrapping() {
    // Weight 400 kg, height 250 cm, age 96 — accepted and computed, never a trap (PRS-02).
    let profile = makeProfile(
      sex: .male,
      weightKg: 400,
      heightCm: 250,
      age: 96,
      activity: .athlete,
      goal: .lose,
      requestedPaceKgPerWeek: 1.5
    )
    let targets = TargetsEngine.targets(for: profile)
    // 10×400 + 6.25×250 − 5×96 + 5 = 5087.5 → 5088; TDEE ×1.9 → 9667.
    #expect(targets.tdee == 9667)
    #expect(targets.dailyKcal == 9167)
    #expect(targets.floorsApplied == false)
    #expect(targets.dailyKcal > 0)
    #expect(targets.proteinG > 0 && targets.carbsG > 0 && targets.fatG > 0)
  }

  @Test
  func goalWeightBelowFortyKgClampsToHealthyBoundary() {
    #expect(TargetsEngine.sanitizedGoalWeightKg(35) == 40)
    #expect(TargetsEngine.sanitizedGoalWeightKg(39.9) == 40)
    #expect(TargetsEngine.sanitizedGoalWeightKg(40) == 40)
    #expect(TargetsEngine.sanitizedGoalWeightKg(72) == 72)
  }

  @Test
  func clampedDailyKcalEnforcesFloorsBySex() {
    #expect(TargetsEngine.clampedDailyKcal(900, sex: .female) == (1200, true))
    #expect(TargetsEngine.clampedDailyKcal(1200, sex: .female) == (1200, false))
    #expect(TargetsEngine.clampedDailyKcal(1100, sex: .male) == (1500, true))
    #expect(TargetsEngine.clampedDailyKcal(1500, sex: .male) == (1500, false))
    #expect(TargetsEngine.clampedDailyKcal(2100, sex: .female) == (2100, false))
  }

  @Test
  func zeroDeficitLoseProfileClampsPaceToZero() {
    // Target at/above TDEE after floors → nothing supports loss → pace 0, never an error.
    let pace = TargetsEngine.clampPace(requested: 1.0, goal: .lose, dailyKcal: 2448, tdee: 2448)
    #expect(pace.pace == 0)
    #expect(pace.clamped == true)
  }
}
