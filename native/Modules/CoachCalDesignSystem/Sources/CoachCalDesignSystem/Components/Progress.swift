import SwiftUI

public struct CCCalorieRing: View {
  public enum Variant {
    case hero
    case compact
    case goal
  }

  public let consumed: Int?
  public let goal: Int?
  public let variant: Variant
  private let dayProgress: Double?

  @Environment(\.edSafeMode) private var edSafeMode
  @Environment(\.colorScheme) private var colorScheme

  public init(
    consumed: Int?,
    goal: Int?,
    variant: Variant = .hero,
    dayProgress: Double? = nil
  ) {
    self.consumed = consumed
    self.goal = goal
    self.variant = variant
    self.dayProgress = dayProgress
  }

  private var size: CGFloat {
    switch variant {
    case .hero: CCSize.ringHero
    case .compact: CCSize.ringCompact
    case .goal: CCSize.ringGoal
    }
  }

  private var stroke: CGFloat {
    switch variant {
    case .hero: CCSize.ringHeroStroke
    case .compact: CCSize.ringCompactStroke
    case .goal: CCSize.ringGoalStroke
    }
  }

  private var trackColor: Color {
    colorScheme == .dark ? Color.white.opacity(0.1) : Color.ccSurface
  }

  // ED-Safe replaces the consumed fraction with fraction-of-day so the ring carries no kcal meaning.
  private var edSafeDayProgress: Double {
    (dayProgress ?? Self.defaultDayProgress()).clampedToUnitInterval
  }

  private var progressFraction: Double {
    if edSafeMode {
      return edSafeDayProgress
    }
    guard let consumed, let goal, goal > 0 else { return 0 }
    return (Double(consumed) / Double(goal)).clampedToUnitInterval
  }

  private var remaining: Int? {
    guard let consumed, let goal else { return nil }
    return max(goal - consumed, 0)
  }

  var a11yLabel: String {
    if edSafeMode { return "On track" }
    guard let remaining, let goal else { return "Calorie ring" }
    return "\(remaining) calories remaining of \(goal) goal"
  }

  @ViewBuilder private var centerContent: some View {
    if edSafeMode {
      VStack(spacing: 0) {
        Text("On track")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextPrimary)
        Text(Self.dayPercentText(edSafeDayProgress))
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
          .lineLimit(1)
          .minimumScaleFactor(0.5)
      }
      .padding(.horizontal, stroke + 8)
    } else if variant == .hero, let remaining {
      VStack(spacing: 0) {
        CCScaledNumber("\(remaining)", role: .hero)
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
          .minimumScaleFactor(0.5)
        Text("remaining")
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
      }
      .padding(.horizontal, stroke + 8)
    }
  }

  public var body: some View {
    ZStack {
      Circle()
        .stroke(trackColor, lineWidth: stroke)
      Circle()
        .trim(from: 0, to: progressFraction)
        .stroke(
          Color.ccAccentLime,
          style: StrokeStyle(lineWidth: stroke, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))
      centerContent
    }
    .frame(width: size, height: size)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(a11yLabel)
  }

  private static func defaultDayProgress() -> Double {
    let calendar = Calendar.current
    let startOfDay = calendar.startOfDay(for: Date())
    let elapsed = Date().timeIntervalSince(startOfDay)
    return elapsed / 86_400
  }

  nonisolated static func dayPercentText(_ dayProgress: Double) -> String {
    "\(Int((dayProgress.clampedToUnitInterval * 100).rounded()))% of day"
  }
}

private extension Double {
  var clampedToUnitInterval: Double {
    min(max(self, 0), 1)
  }
}

public struct CCMacroBar: View {
  public enum Macro {
    case protein
    case carbs
    case fat
    case fiber
  }

  public let macro: Macro
  public let value: Double
  public let goal: Double

  @Environment(\.colorScheme) private var colorScheme

  public init(macro: Macro, value: Double, goal: Double) {
    self.macro = macro
    self.value = value
    self.goal = goal
  }

  private var fillColor: Color {
    switch macro {
    case .protein: Color.ccMacroProtein
    case .carbs: Color.ccMacroCarbs
    case .fat: Color.ccMacroFat
    case .fiber: Color.ccMacroFiber
    }
  }

  private var trackColor: Color {
    colorScheme == .dark ? Color.white.opacity(0.1) : Color.ccSurface
  }

  public var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule()
          .fill(trackColor)
        Capsule()
          .fill(fillColor)
          .frame(width: fillWidth(in: geometry.size.width))
      }
    }
    .frame(height: CCSize.macroBarHeight)
    .accessibilityHidden(true)
  }

  private func fillWidth(in width: CGFloat) -> CGFloat {
    let fraction = goal > 0 ? min(max(value / goal, 0), 1) : 0
    return max(fraction * width, CCSize.macroBarHeight)
  }
}
