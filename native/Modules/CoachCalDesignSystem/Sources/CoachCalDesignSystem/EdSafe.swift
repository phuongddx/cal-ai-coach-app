import SwiftUI

private struct CCEdSafeModeKey: EnvironmentKey {
  static let defaultValue = false
}

public extension EnvironmentValues {
  /// ED-Safe Mode policy (TRU-04). Consume it only inside CoachCalDesignSystem components;
  /// feature code opts a surface in or out exclusively through `edSafeHidden()`.
  var edSafeMode: Bool {
    get { self[CCEdSafeModeKey.self] }
    set { self[CCEdSafeModeKey.self] = newValue }
  }
}

private struct CCEdSafeHidden: ViewModifier {
  @Environment(\.edSafeMode) private var edSafeMode

  func body(content: Content) -> some View {
    if !edSafeMode {
      content
    }
  }
}

public extension View {
  /// The only sanctioned feature-side ED-Safe API: collapses a calorie-framing surface
  /// while ED-Safe Mode is on. The branch lives here, never in feature files.
  func edSafeHidden() -> some View {
    modifier(CCEdSafeHidden())
  }
}
