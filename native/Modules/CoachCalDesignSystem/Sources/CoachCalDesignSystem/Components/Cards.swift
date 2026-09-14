import SwiftUI

public struct CCCard<Content: View>: View {
  private let content: Content

  @Environment(\.colorScheme) private var colorScheme

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    content
      .padding(CCSpace.lg)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.lg)
          .strokeBorder(Color.ccBorder, lineWidth: 1)
      )
      .shadow(
        color: colorScheme == .dark ? .clear : Color.black.opacity(0.04),
        radius: 3, x: 0, y: 1
      )
  }
}

public struct CCMacroMiniCard: View {
  public let macro: CCMacroBar.Macro
  public let value: Double
  public let goal: Double

  @Environment(\.colorScheme) private var colorScheme

  public init(macro: CCMacroBar.Macro, value: Double, goal: Double) {
    self.macro = macro
    self.value = value
    self.goal = goal
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      HStack(spacing: CCSpace.xs) {
        Circle()
          .fill(macroColor)
          .frame(width: 8, height: 8)
          .accessibilityHidden(true)
        Text(macroLabel)
          .ccFont(.caption)
          .foregroundStyle(labelColor)
        Spacer()
        Text("\(Int(value.rounded()))/\(Int(goal.rounded()))g")
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }
      CCMacroBar(macro: macro, value: value, goal: goal)
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(macroLabel) \(Int(value.rounded())) of \(Int(goal.rounded())) grams")
  }

  private var macroColor: Color {
    switch macro {
    case .protein: Color.ccMacroProtein
    case .carbs: Color.ccMacroCarbs
    case .fat: Color.ccMacroFat
    case .fiber: Color.ccMacroFiber
    }
  }

  private var macroLabel: String {
    switch macro {
    case .protein: "Protein"
    case .carbs: "Carbs"
    case .fat: "Fat"
    case .fiber: "Fiber"
    }
  }

  // Light-mode macro labels use the DS dot rule (neutral text); dark keeps colored text.
  private var labelColor: Color {
    colorScheme == .dark ? macroColor : Color.ccTextSecondary
  }
}

public struct CCInsightCard: View {
  public enum Variant {
    case accent
    case info
  }

  public let title: String
  public let text: String
  public let icon: String
  public let variant: Variant

  public init(title: String, text: String, icon: String = "lightbulb", variant: Variant = .accent) {
    self.title = title
    self.text = text
    self.icon = icon
    self.variant = variant
  }

  public var body: some View {
    HStack(alignment: .top, spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: CCRadius.sm)
        .fill(iconTileBackground)
        .frame(width: 40, height: 40)
        .overlay(
          Image(systemName: icon)
            .font(.system(size: 17))
            .foregroundStyle(iconColor)
        )
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: CCSpace.xs) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Text(text)
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .padding(CCSpace.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(backgroundColor)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(alignment: .leading) {
      if variant == .accent {
        Rectangle()
          .fill(Color.ccAccentLime)
          .frame(width: 3)
      } else {
        RoundedRectangle(cornerRadius: CCRadius.lg)
          .strokeBorder(Color.ccInfo.opacity(0.2), lineWidth: 1)
      }
    }
    .overlay(alignment: .leading) {
      if variant == .info {
        Rectangle()
          .fill(Color.ccInfo)
          .frame(width: 3)
      }
    }
  }

  private var backgroundColor: Color {
    variant == .info ? Color.ccInfo.opacity(0.1) : Color.ccCard
  }

  private var iconTileBackground: Color {
    variant == .info ? Color.ccInfo.opacity(0.12) : Color.ccAccentLime.opacity(0.15)
  }

  private var iconColor: Color {
    variant == .info ? Color.ccInfoInk : Color.ccAccentInk
  }
}

public struct CCBadgeTile: View {
  public let emoji: String
  public let name: String
  public let detail: String
  public let isLocked: Bool

  public init(emoji: String, name: String, detail: String, isLocked: Bool = false) {
    self.emoji = emoji
    self.name = name
    self.detail = detail
    self.isLocked = isLocked
  }

  public var body: some View {
    VStack(spacing: CCSpace.xs) {
      Text(emoji)
        .font(.system(size: 32))
        .accessibilityHidden(true)
      Text(name)
        .ccFont(.subhead)
        .fontWeight(.medium)
        .foregroundStyle(Color.ccTextPrimary)
        .lineLimit(1)
      Text(detail)
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, CCSpace.sm)
    .padding(.horizontal, CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .opacity(isLocked ? 0.5 : 1)
    .grayscale(isLocked ? 1 : 0)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(name), \(isLocked ? "locked" : "earned")\(isLocked ? ", \(detail)" : "")")
  }
}

public struct CCStreakCard: View {
  public let emoji: String
  public let streak: Int
  public let title: String
  public let freezesLeft: Int

  public init(emoji: String, streak: Int, title: String, freezesLeft: Int) {
    self.emoji = emoji
    self.streak = streak
    self.title = title
    self.freezesLeft = freezesLeft
  }

  public var body: some View {
    VStack(spacing: CCSpace.xs) {
      Text(emoji)
        .font(.system(size: 48))
        .accessibilityHidden(true)
      CCScaledNumber("\(streak)", role: .hero)
        .foregroundStyle(Color.ccAccentInk)
      Text(title)
        .ccFont(.heading)
        .foregroundStyle(Color.ccTextPrimary)
      Text(freezeChipText)
        .ccFont(.caption)
        .foregroundStyle(Color.ccAccentInk)
        .padding(.vertical, CCSpace.xs)
        .padding(.horizontal, CCSpace.md)
        .background(Color.ccAccentLime.opacity(0.15), in: Capsule())
    }
    .frame(maxWidth: .infinity)
    .padding(CCSpace.xl)
    .background(
      LinearGradient(
        colors: [Color.ccAccentLime.opacity(0.1), Color.ccAccentLime.opacity(0.05)],
        startPoint: .top, endPoint: .bottom
      ),
      in: RoundedRectangle(cornerRadius: CCRadius.lg)
    )
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccAccentLime.opacity(0.2), lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(streak) day streak, \(freezesLeft) freeze\(freezesLeft == 1 ? "" : "s") left")
  }

  private var freezeChipText: String {
    freezesLeft == 1 ? "1 freeze left" : "\(freezesLeft) freezes left"
  }
}

public struct CCSettingsRow: View {
  public let icon: String
  public let label: String
  public let value: String?

  public init(icon: String, label: String, value: String? = nil) {
    self.icon = icon
    self.label = label
    self.value = value
  }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      Image(systemName: icon)
        .font(.system(size: 20))
        .foregroundStyle(Color.ccTextSecondary)
        .frame(width: 24)
        .accessibilityHidden(true)
      Text(label)
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextPrimary)
      Spacer()
      if let value {
        Text(value)
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
      }
      Image(systemName: "chevron.right")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.ccTextTertiary)
        .accessibilityHidden(true)
    }
    .padding(.vertical, 14)
    .padding(.horizontal, CCSpace.lg)
    .contentShape(Rectangle())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(value == nil ? label : "\(label), \(value!)")
  }
}

public struct CCSettingsGroup<Content: View>: View {
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: 0) {
      content
    }
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }
}

public struct CCBannerNote: View {
  public enum Variant {
    case success
    case neutral
    case info
  }

  public let text: String
  public let variant: Variant

  public init(_ text: String, variant: Variant = .neutral) {
    self.text = text
    self.variant = variant
  }

  public var body: some View {
    Text(text)
      .ccFont(.footnote)
      .foregroundStyle(Color.ccTextPrimary)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(CCSpace.md)
      .background(backgroundColor)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(borderColor, lineWidth: 1)
      )
  }

  private var backgroundColor: Color {
    switch variant {
    case .success: Color.ccSuccess.opacity(0.1)
    case .neutral: Color.white.opacity(0.04)
    case .info: Color.ccInfo.opacity(0.1)
    }
  }

  private var borderColor: Color {
    switch variant {
    case .success: Color.ccSuccess.opacity(0.2)
    case .neutral: Color.ccBorder
    case .info: Color.ccInfo.opacity(0.2)
    }
  }
}
