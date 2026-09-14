import CoachCalDesignSystem
import SwiftUI

struct TodayView: View {
  let model: TodayModel?
  var isOffline: Bool = false
  var onStartSetup: () -> Void = {}

  @State private var isWeekStripVisible = true
  @State private var isWaterSheetPresented = false
  @State private var diaryRoute: DiaryRoute?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        if let model {
          header(model)
          if isOffline {
            offlineBanner
          }
          if isWeekStripVisible {
            WeekStripView(
              days: model.weekStripDays,
              selectedDay: model.selectedDay,
              onSelect: model.selectDay
            )
          }
          heroCard(model)
          macroSection(model)
          WaterCard(
            waterMl: model.waterMl,
            glasses: model.waterGlasses,
            onTap: { isWaterSheetPresented = true }
          )
          scoreAndStepsCards
          streakCard(model)
          recentMeals(model)
        }
      }
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl5)
    }
    .background(Color.ccBackground)
    .sheet(isPresented: $isWaterSheetPresented) {
      if let model {
        WaterLogSheet(
          totalMl: model.waterMl,
          glasses: model.waterGlasses,
          onQuickAdd: { delta in
            Task { try? await model.logWaterDelta(delta) }
          },
          onDismiss: { isWaterSheetPresented = false }
        )
        .presentationDetents([.medium])
      }
    }
    .sheet(item: $diaryRoute) { route in
      if let model {
        DiaryDayView(model: model.makeDiaryModel(day: route.date))
      }
    }
  }

  private struct DiaryRoute: Identifiable {
    let date: Date
    var id: Date { date }
  }

  private func header(_ model: TodayModel) -> some View {
    HStack(alignment: .firstTextBaseline) {
      Text("Today")
        .ccFont(.title)
        .foregroundStyle(Color.ccTextPrimary)
      Spacer()
      if isOffline {
        CCOfflineBadge()
          .accessibilityIdentifier("offline.badge")
      }
      Button {
        isWeekStripVisible.toggle()
      } label: {
        HStack(spacing: CCSpace.xs) {
          Text(model.selectedDay.formatted(.dateTime.month(.abbreviated).day()))
            .ccFont(.subhead)
          Image(systemName: "chevron.down")
            .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(Color.ccTextSecondary)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("today.dateSelector")
      .accessibilityLabel("Select date")
    }
  }

  // DS Group B subhead copy ("of 2,150 kcal goal") pins en grouping regardless
  // of device locale.
  private var goalSubheadText: String {
    guard let goal = model?.goalKcal else { return "0" }
    return goal.formatted(.number.locale(Locale(identifier: "en_US")))
  }

  private var offlineBanner: some View {
    CCBannerNote(
      "You're offline — logging still works. Changes sync when you're back online.",
      variant: .info
    )
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
          CCPrimaryButton("Start setup", action: onStartSetup)
            .accessibilityIdentifier("today.startSetup")
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.emptyState")
      } else {
        CCCalorieRing(
          consumed: model.consumedKcal,
          goal: model.goalKcal,
          variant: .hero,
          dayProgress: model.dayProgress
        )
        .accessibilityIdentifier("today.ring")
        Text("of \(goalSubheadText) kcal goal")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
          .edSafeHidden()
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
      HStack(spacing: CCSpace.sm) {
        CCMacroMiniCard(
          macro: .protein,
          value: model.consumedMacro(.protein),
          goal: model.goalMacro(.protein)
        )
        CCMacroMiniCard(
          macro: .carbs,
          value: model.consumedMacro(.carbs),
          goal: model.goalMacro(.carbs)
        )
        CCMacroMiniCard(
          macro: .fat,
          value: model.consumedMacro(.fat),
          goal: model.goalMacro(.fat)
        )
      }
      fiberRow(model)
    }
  }

  private func fiberRow(_ model: TodayModel) -> some View {
    VStack(spacing: CCSpace.xs) {
      HStack(spacing: CCSpace.xs) {
        Circle()
          .fill(Color.ccMacroFiber)
          .frame(width: 8, height: 8)
          .accessibilityHidden(true)
        Text("Fiber")
          .ccFont(.caption)
          .foregroundStyle(Color.ccTextSecondary)
        Spacer()
        Text("\(Int(model.consumedMacro(.fiber).rounded()))/\(Int(model.goalMacro(.fiber).rounded()))g")
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }
      CCMacroBar(
        macro: .fiber,
        value: model.consumedMacro(.fiber),
        goal: model.goalMacro(.fiber)
      )
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "Fiber \(Int(model.consumedMacro(.fiber).rounded())) of \(Int(model.goalMacro(.fiber).rounded())) grams"
    )
  }

  // DS Today: Health Score (success tile) + Steps (Apple Health tile) side by side.
  // Both stay "—" this phase: no score engine; steps data arrives in Phase 4.
  private var scoreAndStepsCards: some View {
    HStack(spacing: CCSpace.sm) {
      statCard(
        identifier: "today.healthScore",
        tile: AnyView(
          Text("—")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(Color.ccSuccessInk)
        ),
        tileTint: Color.ccSuccess.opacity(0.1),
        caption: "Health Score"
      )
      .edSafeHidden()
      statCard(
        identifier: "today.stepsCard",
        tile: AnyView(
          Image(systemName: "figure.walk")
            .font(.system(size: 20))
            .foregroundStyle(Color.ccAppleHealth)
        ),
        tileTint: Color.ccAppleHealth.opacity(0.1),
        caption: "Steps"
      )
    }
  }

  private func statCard(
    identifier: String,
    tile: AnyView,
    tileTint: Color,
    caption: String
  ) -> some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: CCRadius.md)
        .fill(tileTint)
        .frame(width: 44, height: 44)
        .overlay(tile)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(caption)
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
        Text("—")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
      }
    }
    .padding(CCSpace.md)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(caption)
    .accessibilityIdentifier(identifier)
  }

  private func streakCard(_ model: TodayModel) -> some View {
    CCStreakCard(
      emoji: "🔥",
      streak: model.streakState?.currentStreak ?? 0,
      title: "Keep it up!",
      freezesLeft: model.streakState?.freezesLeft ?? 0
    )
    .accessibilityIdentifier("today.streakCard")
  }

  private func recentMeals(_ model: TodayModel) -> some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      CCSectionHeader("Recent meals")
      VStack(spacing: 0) {
        ForEach(model.snapshot.meals) { meal in
          Button {
            diaryRoute = DiaryRoute(date: meal.loggedAt)
          } label: {
            CCFoodRow(
              title: meal.title,
              meta: "\(meal.mealSlot.capitalized) · \(meal.loggedAt.formatted(date: .omitted, time: .shortened))",
              kcal: meal.kcal,
              compactBadge: meal.confidence.map { CCConfidenceBadge(confidence: $0, compact: true) },
              syncPending: !meal.isSynced
            )
          }
          .buttonStyle(.plain)
          .accessibilityElement(children: .combine)
          .accessibilityIdentifier("today.foodRow")
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("today.recentMeals")
    }
  }
}
