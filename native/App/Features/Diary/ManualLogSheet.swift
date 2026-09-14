import CoachCalCore
import CoachCalDesignSystem
import CoachCalPersistence
import Foundation
import SwiftUI

// Manual-entry kcal arithmetic (T-P04-01): the displayed and stored kcal is
// always derived from the food row's stored values — never user-typed.
enum DiaryMath {
  static func manualKcal(per100gKcal: Int, grams: Int) -> Int {
    KcalArithmetic.mealKcal(per100gKcal: per100gKcal, grams: grams)
  }

  static func servingKcal(perServingKcal: Int, servings: Int) -> Int {
    perServingKcal * servings
  }
}

// UI-SPEC Food Search: manual log from a row — per-100g or per-serving basis
// with a quantity stepper; kcal live-recomputes via DiaryMath, never a stored
// display value.
struct ManualLogSheet: View {
  let row: FoodSearchModel.Row
  let mealSlot: MealSlot
  let onSave: (DiaryEntryDetail) -> Void
  let onDismiss: () -> Void

  @State private var grams: Int
  @State private var servings = 1

  static let servingRange = 1...50

  init(
    row: FoodSearchModel.Row,
    mealSlot: MealSlot,
    onSave: @escaping (DiaryEntryDetail) -> Void,
    onDismiss: @escaping () -> Void
  ) {
    self.row = row
    self.mealSlot = mealSlot
    self.onSave = onSave
    self.onDismiss = onDismiss
    _grams = State(initialValue: row.servingGrams ?? 100)
  }

  private var isPerServing: Bool {
    row.basis == "per_serving"
  }

  var displayedKcal: Int {
    isPerServing
      ? DiaryMath.servingKcal(perServingKcal: row.kcal, servings: servings)
      : DiaryMath.manualKcal(per100gKcal: row.kcal, grams: grams)
  }

  var body: some View {
    CCSheet {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text("Log \(row.name)")
            .ccFont(.heading)
            .foregroundStyle(Color.ccTextPrimary)
            .lineLimit(2)
          Text(isPerServing ? "Per serving values" : "Per 100 g values")
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
        }
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
        .accessibilityIdentifier("manual.close")
      }

      if isPerServing {
        ServingStepper(servings: $servings)
      } else {
        CCStepper(name: row.name, value: $grams)
          .accessibilityIdentifier("manual.stepper")
      }

      HStack {
        Text("kcal")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
        Spacer()
        Text("\(displayedKcal)")
          .font(.system(size: 24, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("manual.kcal")
      }
      .padding(.vertical, CCSpace.xs)

      CCPrimaryButton("Save to \(Self.mealName(mealSlot))", action: save)
        .accessibilityIdentifier("manual.save")
    }
  }

  private func save() {
    let detail = DiaryEntryDetail(
      entryId: UUID(),
      mealSlot: mealSlot.rawValue,
      title: row.name,
      grams: isPerServing ? row.servingGrams.map { $0 * servings } : grams,
      kcal: displayedKcal,
      proteinG: nil,
      carbsG: nil,
      fatG: nil,
      fiberG: nil,
      confidence: nil,
      hiddenFatLikely: false,
      source: "manual",
      unresolved: false,
      scanId: nil
    )
    onSave(detail)
  }

  static func mealName(_ slot: MealSlot) -> String {
    slot.rawValue.prefix(1).uppercased() + slot.rawValue.dropFirst()
  }
}

// CCStepper visual contract with a servings unit — DS component is
// grams-hardcoded and DS edits belong to 03-05.
private struct ServingStepper: View {
  @Binding var servings: Int

  var body: some View {
    HStack(spacing: CCSpace.md) {
      stepButton("minus", delta: -1)
        .accessibilityIdentifier("ccstepper.decrement")
      Text("\(servings) serving\(servings == 1 ? "" : "s")")
        .font(.system(size: 15, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccTextPrimary)
        .frame(minWidth: 72)
      stepButton("plus", delta: 1)
        .accessibilityIdentifier("ccstepper.increment")
      Spacer()
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Servings")
    .accessibilityValue("\(servings)")
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        servings = min(servings + 1, ManualLogSheet.servingRange.upperBound)
      case .decrement:
        servings = max(servings - 1, ManualLogSheet.servingRange.lowerBound)
      @unknown default: break
      }
    }
  }

  private func stepButton(_ symbol: String, delta: Int) -> some View {
    Button {
      servings = min(
        max(servings + delta, ManualLogSheet.servingRange.lowerBound),
        ManualLogSheet.servingRange.upperBound
      )
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
