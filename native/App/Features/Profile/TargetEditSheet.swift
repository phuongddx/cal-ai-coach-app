import CoachCalCore
import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// Group F "Goals & targets" edit flow. Reuses the Group A field components
// (CCWheelField) and the plan-reveal edit idiom (±50 kcal steps). The ONLY
// save path funnels every edit back through TargetsEngine so the floors and
// the 30/40/30 macro split re-clamp (PRS-02).
struct TargetEditSheet: View {
  let initial: UserTarget
  var now: @Sendable () -> Date = { Date() }
  let onSave: (UserTarget) async -> Void
  let onDismiss: () -> Void

  @State private var dailyKcal: Int
  @State private var goalWeightKg: Double

  init(
    initial: UserTarget,
    now: @escaping @Sendable () -> Date = { Date() },
    onSave: @escaping (UserTarget) async -> Void,
    onDismiss: @escaping () -> Void
  ) {
    self.initial = initial
    self.now = now
    self.onSave = onSave
    self.onDismiss = onDismiss
    _dailyKcal = State(initialValue: initial.dailyKcal)
    _goalWeightKg = State(initialValue: initial.goalWeightKg ?? initial.weightKg ?? 70)
  }

  private var sex: TargetsEngine.Sex {
    TargetsEngine.Sex(rawValue: initial.sex) ?? .female
  }

  private var floor: Int {
    sex == .female ? TargetsEngine.femaleFloorKcal : TargetsEngine.maleFloorKcal
  }

  private var isFloored: Bool { dailyKcal < floor }

  // The single mutation path: untrusted edits clamp here, never at callers.
  func saveTarget() -> UserTarget {
    Self.reclamped(
      initial,
      requestedKcal: dailyKcal,
      requestedGoalWeightKg: goalWeightKg,
      now: now()
    )
  }

  static func reclamped(
    _ initial: UserTarget,
    requestedKcal: Int,
    requestedGoalWeightKg: Double,
    now: Date
  ) -> UserTarget {
    let sex = TargetsEngine.Sex(rawValue: initial.sex) ?? .female
    let floored = TargetsEngine.clampedDailyKcal(max(requestedKcal, 0), sex: sex)
    let macros = TargetsEngine.macroGrams(forKcal: floored.kcal)
    let goalWeight = TargetsEngine.sanitizedGoalWeightKg(requestedGoalWeightKg)
    return UserTarget(
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
      updatedAt: now
    )
  }

  var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.lg) {
      Text("Edit targets")
        .ccFont(.heading)
        .foregroundStyle(Color.ccTextPrimary)
        .frame(maxWidth: .infinity, alignment: .leading)

      dailyTargetSection
        .edSafeHidden()

      CCWheelField(
        label: "Goal weight",
        items: Array(40...150),
        selection: Binding(
          get: { Int(goalWeightKg.rounded()) },
          set: { goalWeightKg = Double($0) }
        ),
        displayText: { "\($0) kg" }
      )
      .accessibilityIdentifier("settings.targetEdit.goalWeight")

      CCPrimaryButton("Save") {
        Task {
          await onSave(saveTarget())
          onDismiss()
        }
      }
      .accessibilityIdentifier("settings.targetEdit.save")
    }
    .padding(CCSpace.lg)
    .background(Color.ccBackground.ignoresSafeArea())
    .presentationDetents([.large])
  }

  private var dailyTargetSection: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack {
        Text("Daily target")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        HStack(spacing: CCSpace.sm) {
          stepButton(
            "minus",
            identifier: "settings.targetEdit.kcalDown"
          ) { dailyKcal = max(dailyKcal - 50, 0) }
          Text("\(grouped(dailyKcal)) kcal")
            .font(.system(size: 20, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Color.ccAccentInk)
            .frame(minWidth: 96)
            .accessibilityIdentifier("settings.targetEdit.kcal")
          stepButton(
            "plus",
            identifier: "settings.targetEdit.kcalUp"
          ) { dailyKcal += 50 }
        }
      }
      let macros = TargetsEngine.macroGrams(forKcal: max(dailyKcal, 0))
      Text("Protein \(macros.proteinG) g · Carbs \(macros.carbsG) g · Fat \(macros.fatG) g")
        .ccFont(.footnote)
        .foregroundStyle(Color.ccTextSecondary)
      if isFloored {
        CCBannerNote(markdown: OnboardingCopy.safetyFloorBanner, variant: .success)
          .accessibilityIdentifier("settings.targetEdit.safetyFloor")
      }
    }
  }

  private func stepButton(
    _ symbol: String,
    identifier: String,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Image(systemName: symbol)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(Color.ccTextPrimary)
        .frame(width: 32, height: 32)
        .background(Color.ccSurface)
        .overlay(
          RoundedRectangle(cornerRadius: CCRadius.sm)
            .strokeBorder(Color.ccBorder, lineWidth: 1)
        )
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier(identifier)
    .accessibilityLabel(symbol == "minus" ? "Decrease daily target" : "Increase daily target")
  }

  private func grouped(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "en_US")
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
  }
}
