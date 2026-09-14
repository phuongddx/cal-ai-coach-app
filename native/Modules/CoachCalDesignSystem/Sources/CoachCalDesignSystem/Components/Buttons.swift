import SwiftUI

public struct CCPrimaryButtonStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled

  public init() {}

  public func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: 17, weight: .semibold))
      .foregroundStyle(Color.black)
      .frame(maxWidth: .infinity)
      .padding(.vertical, CCSpace.lg)
      .background(Color.ccAccentLime)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
      .opacity(isEnabled ? 1 : 0.4)
      .scaleEffect(configuration.isPressed ? 0.96 : 1)
      .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
  }
}

public struct CCPrimaryButton: View {
  private let title: String
  private let action: () -> Void

  public init(_ title: String, action: @escaping () -> Void = {}) {
    self.title = title
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Text(title)
    }
    .buttonStyle(CCPrimaryButtonStyle())
  }
}

public struct CCSecondaryButtonStyle: ButtonStyle {
  public var bordered: Bool

  public init(bordered: Bool = false) {
    self.bordered = bordered
  }

  public func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: 15, weight: .medium))
      .foregroundStyle(Color.ccTextSecondary)
      .padding(.vertical, CCSpace.md)
      .padding(.horizontal, CCSpace.xl)
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(bordered ? Color.ccBorder : Color.clear, lineWidth: 1)
      )
      .opacity(configuration.isPressed ? 0.7 : 1)
  }
}

public struct CCSecondaryButton: View {
  private let title: String
  private var bordered: Bool
  private let action: () -> Void

  public init(_ title: String, bordered: Bool = false, action: @escaping () -> Void = {}) {
    self.title = title
    self.bordered = bordered
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Text(title)
    }
    .buttonStyle(CCSecondaryButtonStyle(bordered: bordered))
  }
}

public struct CCDashedAddButton: View {
  private let title: String
  private let action: () -> Void

  public init(_ title: String = "Add food", action: @escaping () -> Void = {}) {
    self.title = title
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      HStack(spacing: CCSpace.xs) {
        Image(systemName: "plus")
        Text(title)
      }
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(Color.ccTextSecondary)
      .frame(maxWidth: .infinity)
      .padding(.vertical, CCSpace.md)
      .padding(.horizontal, CCSpace.lg)
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}
