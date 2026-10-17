import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct BodyMetricsView: View {
  let model: OnboardingModel

  private var sexBinding: Binding<TargetsEngine.Sex> {
    Binding(get: { model.draft.sex }, set: { model.selectSex($0) })
  }

  private var heightBinding: Binding<Int> {
    Binding(
      get: { Int(model.draft.heightCm.rounded()) },
      set: { model.draft.heightCm = Double($0) }
    )
  }

  private var weightBinding: Binding<Int> {
    Binding(
      get: { Int(model.draft.weightKg.rounded()) },
      set: { model.draft.weightKg = Double($0) }
    )
  }

  private var birthYearBinding: Binding<Int> {
    Binding(get: { model.birthYear }, set: { model.birthYear = $0 })
  }

  var body: some View {
    OnboardingStepScaffold(
      title: "About you",
      subtitle: "Used to calculate your targets",
      progress: model.progress,
      ctaEnabled: !model.isDobGateBlocked,
      action: { model.advance() }
    ) {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        HStack(spacing: CCSpace.sm) {
          sexChip(.female, title: "Female", identifier: "onboarding.sexFemale")
          sexChip(.male, title: "Male", identifier: "onboarding.sexMale")
        }
        CCWheelField(
          label: "Height",
          items: Array(120...220),
          selection: heightBinding,
          displayText: { "\($0) cm" }
        )
        .accessibilityIdentifier("onboarding.heightField")
        CCWheelField(
          label: "Current weight",
          items: Array(35...200),
          selection: weightBinding,
          displayText: { "\($0) kg" }
        )
        .accessibilityIdentifier("onboarding.weightField")
        CCWheelField(
          label: "Date of birth",
          items: model.dobYears,
          selection: birthYearBinding,
          displayText: { String($0) }
        )
        .accessibilityIdentifier("onboarding.dobField")
        if model.isDobGateBlocked {
          Text(OnboardingCopy.dobGateFootnote)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccErrorInk)
            .accessibilityIdentifier("onboarding.dobGate")
        }
      }
    }
  }

  private func sexChip(_ sex: TargetsEngine.Sex, title: String, identifier: String) -> some View {
    Button {
      model.selectSex(sex)
    } label: {
      CCChipOption(title: title, isSelected: model.draft.sex == sex)
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier(identifier)
  }
}
