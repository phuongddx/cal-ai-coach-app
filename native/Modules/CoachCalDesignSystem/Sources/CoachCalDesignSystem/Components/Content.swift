import SwiftUI

public struct CCFoodRow: View {
  public let title: String
  public var meta: String?
  public var kcal: Int?
  public var compactBadge: (any View)?
  public var syncPending: Bool

  @Environment(\.edSafeMode) private var edSafeMode

  public init(
    title: String,
    meta: String? = nil,
    kcal: Int? = nil,
    compactBadge: (any View)? = nil,
    syncPending: Bool = false
  ) {
    self.title = title
    self.meta = meta
    self.kcal = kcal
    self.compactBadge = compactBadge
    self.syncPending = syncPending
  }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: 10)
        .fill(Color.ccSurface)
        .frame(width: 40, height: 40)
        .overlay(
          Image(systemName: "fork.knife")
            .font(.system(size: 15))
            .foregroundStyle(Color.ccTextTertiary)
        )
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
        if let meta {
          Text(meta)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
            .lineLimit(2)
        }
        if let compactBadge {
          AnyView(compactBadge)
        }
      }

      Spacer(minLength: CCSpace.sm)

      if syncPending {
        HStack(spacing: CCSpace.xs) {
          Image(systemName: "clock")
            .font(.system(size: 11))
          Text("Syncs later")
            .ccFont(.caption)
        }
        .foregroundStyle(Color.ccTextTertiary)
      }

      if !edSafeMode, let kcal {
        Text("\(kcal) kcal")
          .font(.system(size: 14, weight: .medium))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }

      Image(systemName: "chevron.right")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.ccTextTertiary)
        .accessibilityHidden(true)
    }
    .padding(.vertical, CCSpace.sm)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(Color.ccBorder)
        .frame(height: 0.5)
    }
    .contentShape(Rectangle())
  }
}

public struct CCSectionHeader: View {
  public let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title)
      .ccFont(.caption)
      .textCase(.uppercase)
      .kerning(0.55)
      .foregroundStyle(Color.ccTextSecondary)
  }
}
