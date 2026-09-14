import CoachCalCore
import CoachCalPersistence
import Foundation

// UI-SPEC Copywriting / Group A contract — these strings are locked verbatim.
enum OnboardingCopy {
  static let safetyFloorBanner =
    "**Safety floor:** We never recommend below 1,200 kcal/day for women or 1,500 kcal/day for men."
  static let dobGateFootnote = "Must be 18+ to use CoachCal"
  static let edSafeTitle = "ED-safe mode included"
  static let edSafeSubtitle = "Focus on habits, not numbers"
  static let projectionDisclaimer =
    "**Individual results vary.** The shaded area shows a realistic range. Factors like water retention, stress, and sleep affect progress."
  static let privacyPromiseBanner =
    "Your health data stays on your device. We never sell or share your information."
  static let medicalDisclaimer =
    "Not medical advice. Consult a healthcare provider before starting any diet."
  static let weeklyRangeCaption = "Some days higher, some lower — that's normal"
  static let healthConnectNote = "Apple Health connects in a later update."
  static let persistError = "Couldn't save your plan. Try again."
  static let generationSteps = [
    "Calculating TDEE",
    "Setting macro ratios",
    "Applying safety floor",
    "Generating weekly plan",
  ]
}

enum OnboardingStep: Hashable {
  case valueHero
  case goal
  case bodyMetrics
  case goalWeightPace
  case activityDiet
  case projection
  case privacyHealth
  case generating
  case planReveal

  var quizIndex: Int? {
    switch self {
    case .valueHero: 1
    case .goal: 2
    case .bodyMetrics: 3
    case .goalWeightPace: 4
    case .activityDiet: 5
    case .projection: 6
    case .privacyHealth: 7
    case .generating: 8
    case .planReveal: nil
    }
  }
}

@MainActor
@Observable
final class OnboardingModel {
  enum MacroAxis {
    case protein
    case carbs
    case fat
  }

  enum GenerationStepState: Equatable {
    case idle
    case active
    case done
  }

  struct RevealPlan: Equatable {
    var dailyKcal: Int
    var proteinG: Int
    var carbsG: Int
    var fatG: Int
    var floored: Bool
  }

  static let quizStepCount = 8
  static let defaultBirthYear = 1995
  static let minimumGenerationSeconds = 2.0

  var draft = TargetsEngine.QuizProfile(
    sex: .female,
    heightCm: 165,
    weightKg: 70,
    age: 31,
    activityLevel: .moderate,
    goal: .lose,
    goalWeightKg: 65,
    requestedPaceKgPerWeek: 0.5
  )
  var birthYear = OnboardingModel.defaultBirthYear
  var dietStyle = "Standard"
  var path: [OnboardingStep] = [.valueHero]

  private(set) var paceClamped = false
  private(set) var targets: TargetsEngine.Targets?
  private(set) var reveal: RevealPlan?
  private(set) var generationStates = Array(
    repeating: GenerationStepState.idle, count: OnboardingCopy.generationSteps.count
  )
  private(set) var generationPercent: Int?
  private(set) var persistError: String?

  private let userId: UUID
  private let now: @Sendable () -> Date
  private let animationsDisabled: Bool
  private let save: (UserTarget) async throws -> Void
  private let onComplete: () -> Void
  // Task.cancel() is thread-safe; deinit runs nonisolated.
  nonisolated(unsafe) private var generationTask: Task<Void, Never>?

  init(
    userId: UUID,
    now: @escaping @Sendable () -> Date = { Date() },
    animationsDisabled: Bool = false,
    save: @escaping (UserTarget) async throws -> Void = { _ in },
    onComplete: @escaping () -> Void = {}
  ) {
    self.userId = userId
    self.now = now
    self.animationsDisabled = animationsDisabled
    self.save = save
    self.onComplete = onComplete
  }

  deinit {
    generationTask?.cancel()
  }

  var currentStep: OnboardingStep? { path.last }

  var progress: Double {
    Double(currentStep?.quizIndex ?? Self.quizStepCount) / Double(Self.quizStepCount)
  }

  var computedAge: Int {
    Calendar.current.component(.year, from: now()) - birthYear
  }

  func currentDate() -> Date { now() }

  var isDobGateBlocked: Bool { computedAge < 18 }

  var dobYears: [Int] {
    let currentYear = Calendar.current.component(.year, from: now())
    return Array((currentYear - 100)...currentYear)
  }

  func advance() {
    guard let current = path.last else { return }
    if current == .bodyMetrics, isDobGateBlocked { return }
    draft.age = computedAge
    let next: OnboardingStep? = switch current {
    case .valueHero: .goal
    case .goal: .bodyMetrics
    case .bodyMetrics: .goalWeightPace
    case .goalWeightPace: .activityDiet
    case .activityDiet: .projection
    case .projection: .privacyHealth
    case .privacyHealth: .generating
    case .generating, .planReveal: nil
    }
    if let next {
      path.append(next)
    }
  }

  func selectGoal(_ goal: TargetsEngine.Goal) {
    draft.goal = goal
    switch goal {
    case .maintain, .habit:
      draft.requestedPaceKgPerWeek = nil
      paceClamped = false
    case .lose, .gain:
      if let requested = draft.requestedPaceKgPerWeek {
        setPace(requested)
      }
    }
  }

  func selectSex(_ sex: TargetsEngine.Sex) {
    draft.sex = sex
  }

  // The slider value always lands on the engine's clamped result, so the knob
  // snaps back when the requested pace is unsafe.
  func setPace(_ requested: Double) {
    draft.requestedPaceKgPerWeek = requested
    let computed = TargetsEngine.targets(for: draft)
    draft.requestedPaceKgPerWeek = computed.paceKgPerWeek
    paceClamped = computed.paceClamped
  }

  func selectDietStyle(_ style: String) {
    dietStyle = style
  }

  func beginGeneration() {
    guard generationTask == nil else { return }
    generationTask = Task { [weak self] in
      await self?.runGeneration()
    }
  }

  private func runGeneration() async {
    let computed = TargetsEngine.targets(for: draft)
    if animationsDisabled {
      finishGeneration(computed)
      return
    }
    let stepSeconds = Self.minimumGenerationSeconds / Double(generationStates.count)
    for index in generationStates.indices {
      generationStates[index] = .active
      generationPercent = (index + 1) * 25
      do {
        try await Task.sleep(nanoseconds: UInt64(stepSeconds * 1_000_000_000))
      } catch {
        return
      }
      generationStates[index] = .done
    }
    finishGeneration(computed)
  }

  private func finishGeneration(_ computed: TargetsEngine.Targets) {
    targets = computed
    reveal = RevealPlan(
      dailyKcal: computed.dailyKcal,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      floored: computed.floorsApplied
    )
    generationStates = generationStates.map { _ in .done }
    generationPercent = 100
    path.append(.planReveal)
  }

  // Test seam: lands the reveal immediately without the minimum animation window.
  func finishGenerationForTesting() {
    finishGeneration(TargetsEngine.targets(for: draft))
  }

  // Every reveal edit funnels back through the engine, so the kcal floors
  // re-clamp and the displayed macros always re-derive from the daily target.
  func adjustRevealKcal(by delta: Int) {
    guard let current = reveal else { return }
    applyRevealKcal(current.dailyKcal + delta)
  }

  func adjustRevealMacro(_ axis: MacroAxis, by delta: Int) {
    guard let current = reveal else { return }
    let kcal: Int
    switch axis {
    case .protein:
      kcal = max(current.proteinG + delta, 0) * 4 + current.carbsG * 4 + current.fatG * 9
    case .carbs:
      kcal = current.proteinG * 4 + max(current.carbsG + delta, 0) * 4 + current.fatG * 9
    case .fat:
      kcal = current.proteinG * 4 + current.carbsG * 4 + max(current.fatG + delta, 0) * 9
    }
    applyRevealKcal(kcal)
  }

  private func applyRevealKcal(_ kcal: Int) {
    let floored = TargetsEngine.clampedDailyKcal(max(kcal, 0), sex: draft.sex)
    let macros = TargetsEngine.macroGrams(forKcal: floored.kcal)
    reveal = RevealPlan(
      dailyKcal: floored.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      floored: floored.floored
    )
  }

  func persistAndFinish() async {
    guard let reveal, let targets else { return }
    let target = UserTarget(
      from: reveal,
      profile: draft,
      paceKgPerWeek: targets.paceKgPerWeek,
      userId: userId,
      at: now()
    )
    do {
      try await save(target)
      onComplete()
    } catch {
      persistError = OnboardingCopy.persistError
    }
  }
}

extension UserTarget {
  init(
    from reveal: OnboardingModel.RevealPlan,
    profile: TargetsEngine.QuizProfile,
    paceKgPerWeek: Double,
    userId: UUID,
    at date: Date
  ) {
    self.init(
      id: UUID(),
      userId: userId,
      dailyKcal: reveal.dailyKcal,
      proteinG: reveal.proteinG,
      carbsG: reveal.carbsG,
      fatG: reveal.fatG,
      fiberGoalG: 30,
      waterGlasses: 8,
      sex: profile.sex.rawValue,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      goalWeightKg: profile.goalWeightKg.map(TargetsEngine.sanitizedGoalWeightKg),
      paceKgPerWeek: paceKgPerWeek,
      activity: profile.activityLevel.rawValue,
      goal: profile.goal.rawValue,
      updatedAt: date
    )
  }
}
