import SwiftUI
import UIKit

public struct ScanFAB: View {
  private let action: () -> Void

  public init(action: @escaping () -> Void) {
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Image(systemName: "plus")
        .font(.system(size: 28, weight: .medium))
        .foregroundStyle(Color.black)
        .frame(width: CCSize.fab, height: CCSize.fab)
        .background(Color.ccAccentLime, in: Circle())
        .shadow(color: Color.ccAccentLime.opacity(0.4), radius: 12, x: 0, y: 4)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Scan food")
  }
}

// Applies the DS tab-bar visuals to the system TabView: 10pt medium labels,
// lime active icon, accent-ink active label, muted inactive chrome.
public struct CCTabBar: ViewModifier {
  public init() {}

  public func body(content: Content) -> some View {
    content
      .tint(Color.ccAccentInk)
      .onAppear { Self.applyAppearance() }
  }

  static func applyAppearance() {
    let appearance = UITabBarAppearance()
    appearance.configureWithDefaultBackground()

    func style(_ layout: UITabBarItemAppearance) {
      layout.normal.iconColor = UIColor(Color.ccTextTertiary)
      layout.normal.titleTextAttributes = [
        .font: UIFont.systemFont(ofSize: 10, weight: .medium),
        .foregroundColor: UIColor(Color.ccTextTertiary),
      ]
      layout.selected.iconColor = UIColor(Color.ccAccentLime)
      layout.selected.titleTextAttributes = [
        .font: UIFont.systemFont(ofSize: 10, weight: .medium),
        .foregroundColor: UIColor(Color.ccAccentInk),
      ]
    }
    style(appearance.stackedLayoutAppearance)
    style(appearance.inlineLayoutAppearance)
    style(appearance.compactInlineLayoutAppearance)

    UITabBar.appearance().standardAppearance = appearance
    UITabBar.appearance().scrollEdgeAppearance = appearance
  }
}

public extension View {
  func ccTabBarStyle() -> some View {
    modifier(CCTabBar())
  }
}
