import CoachCalDesignSystem
import SwiftUI

struct TodayView: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: TodayModel?

  var body: some View {
    Group {
      if let model {
        content(model)
      } else {
        Color.ccBackground
          .overlay(ProgressView())
      }
    }
    .background(Color.ccBackground)
    .task {
      if model == nil {
        model = TodayModel(
          pool: environment.database,
          userId: AppEnvironment.demoUserId,
          now: environment.now
        )
      }
    }
  }

  private func content(_ model: TodayModel) -> some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        header(model)
        heroCard(model)
        macroSection(model)
        recentMeals(model)
      }
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl5)
    }
  }

  private func header(_ model: TodayModel) -> some View {
    HStack(alignment: .firstTextBaseline) {
      Text("Today")
        .ccFont(.title)
        .foregroundStyle(Color.ccTextPrimary)
      Spacer()
      Text(environment.now().formatted(.dateTime.month(.abbreviated).day()))
        .ccFont(.footnote)
        .foregroundStyle(Color.ccTextSecondary)
    }
  }

  @ViewBuilder private func heroCard(_ model: TodayModel) -> some View {
    VStack(spacing: CCSpace.md) {
      if model.goalKcal == nil {
        VStack(spacing: CCSpace.md) {
          Text("Set up your plan")
            .ccFont(.heading)
            .foregroundStyle(Color.ccTextPrimary)
            .multilineTextAlignment(.center)
          Text("Answer a few questions and we'll calculate your daily calorie and macro targets.")
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextSecondary)
            .multilineTextAlignment(.center)
          CCPrimaryButton("Start setup")
            .accessibilityIdentifier("today.startSetup")
        }
        .frame(maxWidth: .infinity)
      } else {
        CCCalorieRing(
          consumed: model.consumedKcal,
          goal: model.goalKcal,
          variant: .hero,
          dayProgress: environment.dayProgress
        )
        .accessibilityIdentifier("today.ring")
      }
    }
    .frame(maxWidth: .infinity)
    .padding(CCSpace.xl)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }

  private func macroSection(_ model: TodayModel) -> some View {
    VStack(spacing: CCSpace.md) {
      macroRow(.protein, model: model)
      macroRow(.carbs, model: model)
      macroRow(.fat, model: model)
      macroRow(.fiber, model: model)
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }

  private func macroRow(_ macro: CCMacroBar.Macro, model: TodayModel) -> some View {
    VStack(spacing: CCSpace.xs) {
      HStack(spacing: CCSpace.xs) {
        Circle()
          .fill(macroColor(macro))
          .frame(width: 8, height: 8)
          .accessibilityHidden(true)
        Text(macroLabel(macro))
          .ccFont(.caption)
          .foregroundStyle(Color.ccTextSecondary)
        Spacer()
        Text("\(Int(model.consumedMacro(macro).rounded()))/\(Int(model.goalMacro(macro).rounded()))g")
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }
      CCMacroBar(
        macro: macro,
        value: model.consumedMacro(macro),
        goal: model.goalMacro(macro)
      )
    }
  }

  private func recentMeals(_ model: TodayModel) -> some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      CCSectionHeader("Recent meals")
      VStack(spacing: 0) {
        ForEach(model.snapshot.meals) { meal in
          CCFoodRow(
            title: meal.title,
            meta: "\(meal.mealSlot.capitalized) · \(meal.loggedAt.formatted(date: .omitted, time: .shortened))",
            kcal: meal.kcal,
            compactBadge: nil,
            syncPending: !meal.isSynced
          )
          .accessibilityElement(children: .combine)
          .accessibilityIdentifier("today.foodRow")
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("today.recentMeals")
    }
  }

  private func macroColor(_ macro: CCMacroBar.Macro) -> Color {
    switch macro {
    case .protein: Color.ccMacroProtein
    case .carbs: Color.ccMacroCarbs
    case .fat: Color.ccMacroFat
    case .fiber: Color.ccMacroFiber
    }
  }

  private func macroLabel(_ macro: CCMacroBar.Macro) -> String {
    switch macro {
    case .protein: "Protein"
    case .carbs: "Carbs"
    case .fat: "Fat"
    case .fiber: "Fiber"
    }
  }
}
