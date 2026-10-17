import CoachCalDesignSystem
import SwiftUI

// UI-SPEC Group E exercise sheet (contract-defined): type field, 5-min duration
// stepper, optional manual burned-kcal field. Manual entries are clamped at the
// model boundary (duration 0–600, kcal 0–5000 — T-P04-01). Local-only write
// (no outbox — exercise_logs has no server table until Phase 4).
struct ExerciseLogSheet: View {
  let model: DiaryDayModel
  let onDismiss: () -> Void

  @State private var type = ""
  @State private var durationMin = 30
  @State private var kcalText = ""

  static let durationStep = 5
  static let durationRange = 0...600
  static let kcalRange = 0...5000

  var body: some View {
    CCSheet {
      HStack {
        Text("Add exercise")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Button(action: onDismiss) {
          Image(systemName: "xmark")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.ccTextSecondary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
        .accessibilityIdentifier("exercise.close")
      }

      TextField("Exercise type", text: $type)
        .ccFont(.body)
        .foregroundStyle(Color.ccTextPrimary)
        .padding(.vertical, CCSpace.md)
        .padding(.horizontal, CCSpace.lg)
        .background(Color.ccSurface)
        .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
        .overlay(
          RoundedRectangle(cornerRadius: CCRadius.md)
            .strokeBorder(Color.ccBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("exercise.typeField")

      DurationStepper(value: $durationMin)

      TextField("Calories burned (optional)", text: $kcalText)
        .ccFont(.body)
        .keyboardType(.numberPad)
        .foregroundStyle(Color.ccTextPrimary)
        .padding(.vertical, CCSpace.md)
        .padding(.horizontal, CCSpace.lg)
        .background(Color.ccSurface)
        .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
        .overlay(
          RoundedRectangle(cornerRadius: CCRadius.md)
            .strokeBorder(Color.ccBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("exercise.kcalField")

      CCPrimaryButton("Save", action: save)
        .disabled(!canSave)
        .accessibilityIdentifier("exercise.save")
    }
  }

  private var canSave: Bool {
    !type.trimmingCharacters(in: .whitespaces).isEmpty
  }

  private func save() {
    let trimmed = type.trimmingCharacters(in: .whitespaces)
    let burned = clampedBurnedKcal
    Task {
      try? await model.addExercise(type: trimmed, durationMin: durationMin, kcalBurned: burned)
      onDismiss()
    }
  }

  private var clampedBurnedKcal: Int? {
    guard let parsed = Int(kcalText) else { return nil }
    return min(max(parsed, Self.kcalRange.lowerBound), Self.kcalRange.upperBound)
  }
}

// CCStepper visual contract with a minute unit — the DS component is
// grams-hardcoded, and DS component behavior edits belong to 03-05.
private struct DurationStepper: View {
  @Binding var value: Int

  var body: some View {
    HStack(spacing: CCSpace.md) {
      stepButton("minus", delta: -ExerciseLogSheet.durationStep)
        .accessibilityIdentifier("ccstepper.decrement")
      Text("\(value) min")
        .font(.system(size: 15, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccTextPrimary)
        .frame(minWidth: 48)
      stepButton("plus", delta: ExerciseLogSheet.durationStep)
        .accessibilityIdentifier("ccstepper.increment")
      Spacer()
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Duration")
    .accessibilityValue("\(value) minutes")
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment: value = min(value + ExerciseLogSheet.durationStep, ExerciseLogSheet.durationRange.upperBound)
      case .decrement: value = max(value - ExerciseLogSheet.durationStep, ExerciseLogSheet.durationRange.lowerBound)
      @unknown default: break
      }
    }
  }

  private func stepButton(_ symbol: String, delta: Int) -> some View {
    Button {
      value = min(max(value + delta, ExerciseLogSheet.durationRange.lowerBound), ExerciseLogSheet.durationRange.upperBound)
    } label: {
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
  }
}
