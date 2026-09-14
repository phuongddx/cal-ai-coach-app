import SwiftUI

// Spacing scale — UI-SPEC "Spacing Scale" table (4pt grid).
public enum CCSpace {
  public static let xs: CGFloat = 4
  public static let sm: CGFloat = 8
  public static let md: CGFloat = 12
  public static let lg: CGFloat = 16
  public static let xl: CGFloat = 20
  public static let xl2: CGFloat = 24
  public static let xl3: CGFloat = 32
  public static let xl4: CGFloat = 40
  public static let xl5: CGFloat = 48
}

// Radii — UI-SPEC "Radii & Elevation" table.
public enum CCRadius {
  public static let sm: CGFloat = 8
  public static let md: CGFloat = 12
  public static let lg: CGFloat = 16
  public static let xl: CGFloat = 20
  public static let full: CGFloat = 9999
}

// Device-chrome exceptions and ring geometry — UI-SPEC spacing exceptions + CCCalorieRing row.
public enum CCSize {
  public static let tapTarget: CGFloat = 44
  public static let fab: CGFloat = 56
  public static let shutter: CGFloat = 72
  public static let ringHero: CGFloat = 140
  public static let ringCompact: CGFloat = 120
  public static let ringGoal: CGFloat = 56
  public static let ringHeroStroke: CGFloat = 12
  public static let ringCompactStroke: CGFloat = 8
  public static let ringGoalStroke: CGFloat = 6
  public static let macroBarHeight: CGFloat = 6
}

public enum CCTypography {
  public enum Role {
    case title
    case heading
    case headline
    case body
    case subhead
    case footnote
    case caption
    case tabLabel
  }

  // UI-SPEC "Typography" table — system text styles only; hero/plan numbers use CCScaledNumber.
  public static func font(_ role: Role) -> Font {
    switch role {
    case .title: .largeTitle.weight(.semibold)
    case .heading: .title2.weight(.semibold)
    case .headline: .headline
    case .body: .body
    case .subhead: .subheadline
    case .footnote: .footnote
    case .caption: .caption.weight(.medium)
    case .tabLabel: .caption2.weight(.medium)
    }
  }
}

public extension View {
  func ccFont(_ role: CCTypography.Role) -> some View {
    font(CCTypography.font(role))
  }
}

// Hero (700/56) and plan (700/64) numerals — must scale with Dynamic Type via @ScaledMetric.
public struct CCScaledNumber: View {
  public enum Role {
    case hero
    case planNumber
  }

  private let text: String
  private let weight: Font.Weight
  @ScaledMetric(relativeTo: .largeTitle) private var size: CGFloat = 56

  public init(_ text: String, role: Role) {
    self.text = text
    switch role {
    case .hero:
      _size = ScaledMetric(wrappedValue: 56, relativeTo: .largeTitle)
      weight = .bold
    case .planNumber:
      _size = ScaledMetric(wrappedValue: 64, relativeTo: .largeTitle)
      weight = .bold
    }
  }

  public var body: some View {
    Text(text)
      .font(.system(size: size, weight: weight))
      .monospacedDigit()
  }
}

// Every color flows through the asset catalog (Any + Dark + High Contrast) — no literal hex anywhere.
public extension Color {
  static let ccBackground = Color("background", bundle: .module)
  static let ccSurface = Color("surface", bundle: .module)
  static let ccCard = Color("card", bundle: .module)
  static let ccBorder = Color("border", bundle: .module)
  static let ccAccentLime = Color("accentLime", bundle: .module)
  static let ccAccentLimePressed = Color("accentLimePressed", bundle: .module)
  static let ccAccentInk = Color("accentInk", bundle: .module)
  static let ccTextPrimary = Color("textPrimary", bundle: .module)
  static let ccTextSecondary = Color("textSecondary", bundle: .module)
  static let ccTextTertiary = Color("textTertiary", bundle: .module)
  static let ccMacroProtein = Color("macroProtein", bundle: .module)
  static let ccMacroCarbs = Color("macroCarbs", bundle: .module)
  static let ccMacroFat = Color("macroFat", bundle: .module)
  static let ccMacroFiber = Color("macroFiber", bundle: .module)
  static let ccSuccess = Color("semanticSuccess", bundle: .module)
  static let ccWarning = Color("semanticWarning", bundle: .module)
  static let ccError = Color("semanticError", bundle: .module)
  static let ccInfo = Color("semanticInfo", bundle: .module)
  static let ccSuccessInk = Color("successInk", bundle: .module)
  static let ccWarningInk = Color("warningInk", bundle: .module)
  static let ccErrorInk = Color("errorInk", bundle: .module)
  static let ccInfoInk = Color("infoInk", bundle: .module)
  static let ccAppleHealth = Color("appleHealth", bundle: .module)
}

// Snapshot determinism: --ccDisableAnimations flattens every animation inside the wrapped subtree.
public extension View {
  func ccAnimationDisabled(_ disabled: Bool) -> some View {
    transaction { transaction in
      if disabled {
        transaction.animation = nil
        transaction.disablesAnimations = true
      }
    }
  }
}
