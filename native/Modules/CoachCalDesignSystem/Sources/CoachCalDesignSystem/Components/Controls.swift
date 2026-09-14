import SwiftUI

public struct CCOptionCard: View {
  public let title: String
  public let subtitle: String?
  public let icon: String
  public let isSelected: Bool

  public init(title: String, subtitle: String? = nil, icon: String, isSelected: Bool) {
    self.title = title
    self.subtitle = subtitle
    self.icon = icon
    self.isSelected = isSelected
  }

  // Exposed for contract tests: the selected/unselected visual state mapping.
  var selectionBorderWidth: CGFloat { isSelected ? 2 : 1 }
  var selectionBorderColor: Color { isSelected ? Color.ccAccentLime : Color.ccBorder }
  var iconTileColor: Color { isSelected ? Color.ccAccentLime.opacity(0.15) : Color.ccSurface }
  var iconColor: Color { isSelected ? Color.ccAccentInk : Color.ccTextSecondary }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: CCRadius.md)
        .fill(iconTileColor)
        .frame(width: 48, height: 48)
        .overlay(
          Image(systemName: icon)
            .font(.system(size: 20))
            .foregroundStyle(iconColor)
        )
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        if let subtitle {
          Text(subtitle)
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextSecondary)
        }
      }

      Spacer()

      if isSelected {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color.ccAccentLime)
          .accessibilityHidden(true)
      }
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(selectionBorderColor, lineWidth: selectionBorderWidth)
    )
    .contentShape(Rectangle())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(title)\(subtitle.map { ", \($0)" } ?? ""), \(isSelected ? "selected" : "not selected")")
  }
}

public struct CCChipOption: View {
  public let title: String
  public let isSelected: Bool

  public init(title: String, isSelected: Bool) {
    self.title = title
    self.isSelected = isSelected
  }

  public var body: some View {
    Text(title)
      .ccFont(.subhead)
      .foregroundStyle(isSelected ? Color.ccAccentInk : Color.ccTextSecondary)
      .padding(.vertical, CCSpace.sm)
      .padding(.horizontal, CCSpace.lg)
      .background(
        isSelected ? Color.ccAccentLime.opacity(0.15) : Color.ccSurface,
        in: Capsule()
      )
      .overlay(
        Capsule().strokeBorder(
          isSelected ? Color.ccAccentLime : Color.clear,
          lineWidth: 1
        )
      )
      .accessibilityAddTraits(isSelected ? [.isSelected] : [])
  }
}

public struct CCProgressRail: View {
  public let progress: Double

  public init(progress: Double) {
    self.progress = progress
  }

  public var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color.white.opacity(0.1))
        Capsule()
          .fill(Color.ccAccentLime)
          .frame(width: max(4, min(max(progress, 0), 1) * geometry.size.width))
      }
    }
    .frame(height: 4)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(Int(progress * 100)) percent complete")
  }
}

public struct CCWheelField<Item: Hashable>: View {
  public let label: String
  public let items: [Item]
  @Binding public var selection: Item
  private let displayText: (Item) -> String

  public init(
    label: String,
    items: [Item],
    selection: Binding<Item>,
    displayText: @escaping (Item) -> String
  ) {
    self.label = label
    self.items = items
    self._selection = selection
    self.displayText = displayText
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      Text(label)
        .ccFont(.headline)
        .foregroundStyle(Color.ccTextPrimary)
      Text(displayText(selection))
        .ccFont(.headline)
        .foregroundStyle(Color.ccAccentInk)
      Picker(label, selection: $selection) {
        ForEach(items, id: \.self) { item in
          Text(displayText(item)).tag(item)
        }
      }
      .pickerStyle(.wheel)
      .frame(maxWidth: .infinity)
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }
}

public struct CCStepper: View {
  public let name: String
  @Binding public var value: Int
  public let step: Int
  public let minimum: Int

  public init(name: String, value: Binding<Int>, step: Int = 10, minimum: Int = 0) {
    self.name = name
    self._value = value
    self.step = step
    self.minimum = minimum
  }

  // Both the buttons and the VoiceOver adjustable action funnel through here.
  func adjust(_ direction: AccessibilityAdjustmentDirection) {
    switch direction {
    case .increment: value += step
    case .decrement: value = max(value - step, minimum)
    @unknown default: break
    }
  }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      stepButton("minus", delta: -step)
        .accessibilityIdentifier("ccstepper.decrement")
      Text("\(value) g")
        .font(.subheadline.weight(.semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccTextPrimary)
        .frame(minWidth: 48)
      stepButton("plus", delta: step)
        .accessibilityIdentifier("ccstepper.increment")
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(name)
    .accessibilityValue("\(value) grams")
    .accessibilityAdjustableAction { adjust($0) }
  }

  private func stepButton(_ symbol: String, delta: Int) -> some View {
    Button {
      adjust(delta < 0 ? .decrement : .increment)
    } label: {
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
  }
}

public struct CCSearchField: View {
  @Binding public var text: String
  public let placeholder: String

  public init(text: Binding<String>, placeholder: String) {
    self._text = text
    self.placeholder = placeholder
  }

  public var body: some View {
    HStack(spacing: CCSpace.sm) {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 15))
        .foregroundStyle(Color.ccTextSecondary)
      TextField(placeholder, text: $text)
        .ccFont(.body)
        .foregroundStyle(Color.ccTextPrimary)
    }
    .padding(.vertical, CCSpace.md)
    .padding(.horizontal, CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.md)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }
}

public struct CCQuickActionTile: View {
  public let title: String
  public let icon: String
  public let isHighlighted: Bool
  public let action: () -> Void

  public init(
    title: String,
    icon: String,
    isHighlighted: Bool = false,
    action: @escaping () -> Void = {}
  ) {
    self.title = title
    self.icon = icon
    self.isHighlighted = isHighlighted
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      VStack(spacing: CCSpace.sm) {
        Image(systemName: icon)
          .font(.system(size: 28))
          .foregroundStyle(isHighlighted ? Color.ccAccentInk : Color.ccTextPrimary)
        Text(title)
          .ccFont(.caption)
          .fontWeight(.medium)
          .foregroundStyle(isHighlighted ? Color.ccAccentInk : Color.ccTextSecondary)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, CCSpace.xl2)
      .background(isHighlighted ? Color.ccAccentLime.opacity(0.1) : Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(
            isHighlighted ? Color.ccAccentLime.opacity(0.3) : Color.ccBorder,
            lineWidth: 1
          )
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}
