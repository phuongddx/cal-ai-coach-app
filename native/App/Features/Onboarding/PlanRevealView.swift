import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

struct PlanRevealView: View {
  let model: OnboardingModel

  @State private var editing = false

  private var reveal: OnboardingModel.RevealPlan? { model.reveal }

  var body: some View {
    VStack(spacing: 0) {
      ScrollView {
        VStack(alignment: .leading, spacing: CCSpace.xl) {
          Text("Your daily target")
            .ccFont(.title)
            .foregroundStyle(Color.ccTextPrimary)
            .accessibilityIdentifier("plan.reveal")
          if let reveal {
            kcalHero(reveal)
            HStack(spacing: CCSpace.md) {
              MacroRing(
                color: Color.ccMacroProtein,
                grams: reveal.proteinG,
                kcalShare: Double(reveal.proteinG * 4),
                totalKcal: reveal.dailyKcal,
                label: "Protein",
                identifier: "plan.macro.protein"
              )
              MacroRing(
                color: Color.ccMacroCarbs,
                grams: reveal.carbsG,
                kcalShare: Double(reveal.carbsG * 4),
                totalKcal: reveal.dailyKcal,
                label: "Carbs",
                identifier: "plan.macro.carbs"
              )
              MacroRing(
                color: Color.ccMacroFat,
                grams: reveal.fatG,
                kcalShare: Double(reveal.fatG * 9),
                totalKcal: reveal.dailyKcal,
                label: "Fat",
                identifier: "plan.macro.fat"
              )
            }
            weeklyRangeCard(reveal)
            CCSecondaryButton("Not right? Adjust targets", bordered: true) {
              editing.toggle()
            }
            .accessibilityIdentifier("plan.adjust")
            if editing {
              editPanel(reveal)
            }
            if let persistError = model.persistError {
              CCBannerNote(persistError)
                .accessibilityIdentifier("plan.persistError")
            }
          }
          Text(OnboardingCopy.medicalDisclaimer)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextTertiary)
            .accessibilityIdentifier("plan.medicalDisclaimer")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, CCSpace.lg)
        .padding(.top, CCSpace.xl3)
        .padding(.bottom, CCSpace.lg)
      }
      CCPrimaryButton("Continue") {
        Task { await model.persistAndFinish() }
      }
      .accessibilityIdentifier("onboarding.continue")
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.ccBackground.ignoresSafeArea())
  }

  // ED-Safe hides the calorie hero; macro rings and weekly framing remain.
  private func kcalHero(_ reveal: OnboardingModel.RevealPlan) -> some View {
    VStack(spacing: CCSpace.xs) {
      CCScaledNumber("\(reveal.dailyKcal)", role: .planNumber)
        .foregroundStyle(Color.ccTextPrimary)
        .accessibilityIdentifier("plan.kcalHero")
      Text("calories per day")
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(reveal.dailyKcal) calories per day")
    .frame(maxWidth: .infinity)
    .edSafeHidden()
  }

  private func weeklyRangeCard(_ reveal: OnboardingModel.RevealPlan) -> some View {
    CCCard {
      VStack(alignment: .leading, spacing: CCSpace.xs) {
        Text("Weekly range")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Text("\(grouped(reveal.dailyKcal * 7 - 250)) – \(grouped(reveal.dailyKcal * 7 + 250)) calories")
          .ccFont(.subhead)
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("plan.weeklyRange")
          .edSafeHidden()
        Text(OnboardingCopy.weeklyRangeCaption)
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
  }

  @ViewBuilder
  private func editPanel(_ reveal: OnboardingModel.RevealPlan) -> some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      editRow(label: "Daily calories", value: "\(reveal.dailyKcal)", identifier: "plan.editKcal") {
        model.adjustRevealKcal(by: -50)
      } increment: {
        model.adjustRevealKcal(by: 50)
      }
      editRow(label: "Protein", value: "\(reveal.proteinG) g", identifier: "plan.editProtein") {
        model.adjustRevealMacro(.protein, by: -10)
      } increment: {
        model.adjustRevealMacro(.protein, by: 10)
      }
      editRow(label: "Carbs", value: "\(reveal.carbsG) g", identifier: "plan.editCarbs") {
        model.adjustRevealMacro(.carbs, by: -10)
      } increment: {
        model.adjustRevealMacro(.carbs, by: 10)
      }
      editRow(label: "Fat", value: "\(reveal.fatG) g", identifier: "plan.editFat") {
        model.adjustRevealMacro(.fat, by: -10)
      } increment: {
        model.adjustRevealMacro(.fat, by: 10)
      }
      if reveal.floored {
        CCBannerNote(markdown: OnboardingCopy.safetyFloorBanner, variant: .success)
          .accessibilityIdentifier("plan.safetyFloor")
      }
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }

  private func editRow(
    label: String,
    value: String,
    identifier: String,
    decrement: @escaping () -> Void,
    increment: @escaping () -> Void
  ) -> some View {
    HStack(spacing: CCSpace.md) {
      Text(label)
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextPrimary)
      Spacer()
      stepButton("minus", identifier: "\(identifier).decrement", action: decrement)
      Text(value)
        .font(.system(size: 15, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccTextPrimary)
        .frame(minWidth: 56)
        .accessibilityIdentifier(identifier)
      stepButton("plus", identifier: "\(identifier).increment", action: increment)
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel("\(label), \(value)")
  }

  private func stepButton(_ symbol: String, identifier: String, action: @escaping () -> Void)
    -> some View
  {
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
  }

  private func grouped(_ value: Int) -> String {
    NumberFormatter.groupedDecimal.string(from: NSNumber(value: value)) ?? String(value)
  }
}

private struct MacroRing: View {
  let color: Color
  let grams: Int
  let kcalShare: Double
  let totalKcal: Int
  let label: String
  let identifier: String

  private var fraction: Double {
    guard totalKcal > 0 else { return 0 }
    return min(max(kcalShare / Double(totalKcal), 0), 1)
  }

  var body: some View {
    VStack(spacing: CCSpace.xs) {
      ZStack {
        Circle()
          .stroke(Color.ccSurface, lineWidth: CCSize.ringGoalStroke)
        Circle()
          .trim(from: 0, to: fraction)
          .stroke(
            color,
            style: StrokeStyle(lineWidth: CCSize.ringGoalStroke, lineCap: .round)
          )
          .rotationEffect(.degrees(-90))
        Text("\(grams)g")
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }
      .frame(width: CCSize.ringGoal, height: CCSize.ringGoal)
      Text(label)
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(label) \(grams) grams")
    .accessibilityIdentifier(identifier)
  }
}

extension NumberFormatter {
  static let groupedDecimal: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    // DS copy shows comma grouping; pin the locale so snapshots are stable
    // regardless of the host simulator's region settings (en_US_POSIX would
    // suppress grouping entirely in NumberFormatter).
    formatter.locale = Locale(identifier: "en_US")
    return formatter
  }()
}
