// Pure targets math (PRS-01/PRS-02): Mifflin-St Jeor BMR, TDEE activity
// multipliers, goal adjustments, 1,200/1,500 kcal floors and safe-pace limits.
// Every untrusted input CLAMPS with a flag — nothing throws or traps.
// Zero imports by contract (must stay macOS `swift test`-able).

public enum TargetsEngine {
  public enum Sex: String, CaseIterable, Sendable {
    case female
    case male
  }

  public enum ActivityLevel: String, CaseIterable, Sendable {
    case sedentary
    case light
    case moderate
    case active
    case athlete

    var multiplier: Double {
      switch self {
      case .sedentary: 1.2
      case .light: 1.375
      case .moderate: 1.55
      case .active: 1.725
      case .athlete: 1.9
      }
    }
  }

  public enum Goal: String, CaseIterable, Sendable {
    case lose
    case maintain
    case gain
    case habit
  }

  public struct QuizProfile: Equatable, Sendable {
    public var sex: Sex
    public var heightCm: Double
    public var weightKg: Double
    public var age: Int
    public var activityLevel: ActivityLevel
    public var goal: Goal
    public var goalWeightKg: Double?
    public var requestedPaceKgPerWeek: Double?

    public init(
      sex: Sex,
      heightCm: Double,
      weightKg: Double,
      age: Int,
      activityLevel: ActivityLevel,
      goal: Goal,
      goalWeightKg: Double? = nil,
      requestedPaceKgPerWeek: Double? = nil
    ) {
      self.sex = sex
      self.heightCm = heightCm
      self.weightKg = weightKg
      self.age = age
      self.activityLevel = activityLevel
      self.goal = goal
      self.goalWeightKg = goalWeightKg
      self.requestedPaceKgPerWeek = requestedPaceKgPerWeek
    }
  }

  public struct Targets: Equatable, Sendable {
    public let dailyKcal: Int
    public let proteinG: Int
    public let carbsG: Int
    public let fatG: Int
    public let fiberGoalG: Int
    public let waterGlasses: Int
    public let paceKgPerWeek: Double
    public let floorsApplied: Bool
    public let paceClamped: Bool
    public let tdee: Int

    public init(
      dailyKcal: Int,
      proteinG: Int,
      carbsG: Int,
      fatG: Int,
      fiberGoalG: Int,
      waterGlasses: Int,
      paceKgPerWeek: Double,
      floorsApplied: Bool,
      paceClamped: Bool,
      tdee: Int
    ) {
      self.dailyKcal = dailyKcal
      self.proteinG = proteinG
      self.carbsG = carbsG
      self.fatG = fatG
      self.fiberGoalG = fiberGoalG
      self.waterGlasses = waterGlasses
      self.paceKgPerWeek = paceKgPerWeek
      self.floorsApplied = floorsApplied
      self.paceClamped = paceClamped
      self.tdee = tdee
    }
  }

  public static let femaleFloorKcal = 1200
  public static let maleFloorKcal = 1500
  public static let minGoalWeightKg = 40.0
  public static let safePaceMaxKgPerWeek = 1.0

  // Standard energy density of body mass (kcal per kg).
  private static let kcalPerKg = 7700.0

  // Mifflin-St Jeor (assumption A1) — isolated here so a formula swap is one line.
  public static func bmr(_ profile: QuizProfile) -> Int {
    let base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * Double(profile.age)
    let sexOffset: Double = profile.sex == .male ? 5 : -161
    return Int((base + sexOffset).rounded())
  }

  public static func tdee(bmr: Int, activity: ActivityLevel) -> Int {
    Int((Double(bmr) * activity.multiplier).rounded())
  }

  public static func clampedDailyKcal(_ kcal: Int, sex: Sex) -> (kcal: Int, floored: Bool) {
    let floor = sex == .female ? femaleFloorKcal : maleFloorKcal
    return kcal < floor ? (floor, true) : (kcal, false)
  }

  // Protein 30% / carbs 40% / fat 30% of daily kcal, converted at 4/4/9 kcal per gram.
  public static func macroGrams(forKcal kcal: Int) -> (proteinG: Int, carbsG: Int, fatG: Int) {
    let proteinG = (Double(kcal) * 0.30 / 4).rounded()
    let carbsG = (Double(kcal) * 0.40 / 4).rounded()
    let fatG = (Double(kcal) * 0.30 / 9).rounded()
    return (Int(proteinG), Int(carbsG), Int(fatG))
  }

  // A requested pace is honored only as far as the daily kcal delta supports it.
  public static func clampPace(
    requested: Double,
    goal: Goal,
    dailyKcal: Int,
    tdee: Int
  ) -> (pace: Double, clamped: Bool) {
    let dailyDelta: Double
    switch goal {
    case .lose: dailyDelta = Double(max(tdee - dailyKcal, 0))
    case .gain: dailyDelta = Double(max(dailyKcal - tdee, 0))
    case .maintain, .habit: dailyDelta = 0
    }
    let supported = dailyDelta * 7 / kcalPerKg
    let bounded = min(max(requested, 0), supported, safePaceMaxKgPerWeek)
    let pace = (bounded * 100).rounded() / 100
    let requestedRounded = (max(requested, 0) * 100).rounded() / 100
    return (pace, pace != requestedRounded)
  }

  public static func sanitizedGoalWeightKg(_ goalWeightKg: Double) -> Double {
    max(goalWeightKg, minGoalWeightKg)
  }

  // Order matters: goal adjustment → floors by sex → pace clamp against the
  // floored target, so the pace never implies a deficit the plan doesn't carry.
  public static func targets(for profile: QuizProfile) -> Targets {
    let bmrValue = bmr(profile)
    let tdeeValue = tdee(bmr: bmrValue, activity: profile.activityLevel)
    let adjustment: Int = switch profile.goal {
    case .lose: -500
    case .gain: 300
    case .maintain, .habit: 0
    }
    let floored = clampedDailyKcal(tdeeValue + adjustment, sex: profile.sex)
    let macros = macroGrams(forKcal: floored.kcal)
    let pace: (pace: Double, clamped: Bool)
    if let requested = profile.requestedPaceKgPerWeek {
      pace = clampPace(
        requested: requested,
        goal: profile.goal,
        dailyKcal: floored.kcal,
        tdee: tdeeValue
      )
    } else {
      pace = (0, false)
    }
    return Targets(
      dailyKcal: floored.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      fiberGoalG: 30,
      waterGlasses: 8,
      paceKgPerWeek: pace.pace,
      floorsApplied: floored.floored,
      paceClamped: pace.clamped,
      tdee: tdeeValue
    )
  }
}
