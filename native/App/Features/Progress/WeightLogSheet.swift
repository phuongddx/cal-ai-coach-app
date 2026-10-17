import CoachCalDesignSystem
import SwiftUI

struct WeightLogSheet: View {
  let onSave: (Double) -> Void
  let onDismiss: () -> Void

  @State private var selection: Double

  init(
    currentKg: Double?,
    onSave: @escaping (Double) -> Void,
    onDismiss: @escaping () -> Void
  ) {
    self.onSave = onSave
    self.onDismiss = onDismiss
    let base = currentKg ?? 80
    _selection = State(initialValue: ProgressModel.clampKg(base))
  }

  // Wheel domain: 40–250 kg in 0.1 steps (values pre-snapped so Picker
  // selection equality holds).
  static let kgValues: [Double] = stride(
    from: ProgressModel.kgRange.lowerBound * 10,
    through: ProgressModel.kgRange.upperBound * 10,
    by: 1
  ).map { $0 / 10 }

  var body: some View {
    CCSheet {
      HStack {
        Text("Log weight")
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
        .accessibilityIdentifier("progress.closeWeightSheet")
      }

      CCWheelField(
        label: "Weight",
        items: Self.kgValues,
        selection: $selection,
        displayText: { String(format: "%.1f kg", $0) }
      )

      CCPrimaryButton("Save") {
        onSave(selection)
        onDismiss()
      }
      .accessibilityIdentifier("progress.saveWeight")
    }
    .presentationDetents([.medium, .large])
  }
}
