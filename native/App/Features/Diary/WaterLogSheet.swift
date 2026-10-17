import CoachCalDesignSystem
import SwiftUI

// UI-SPEC Group E water log sheet: 56pt droplet ring, +250/−250 quick-add
// tiles, goal from targets (default 8). The model clamps the day total at 0 ml.
struct WaterLogSheet: View {
  let totalMl: Int
  let glasses: Int
  let onQuickAdd: (Int) -> Void
  let onDismiss: () -> Void

  private var glassesLogged: Int {
    totalMl / WaterCard.glassMl
  }

  var body: some View {
    CCSheet {
      HStack {
        Text("Water")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Button(action: onDismiss) {
          Image(systemName: "xmark")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.ccTextSecondary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
        .accessibilityIdentifier("water.close")
      }

      HStack(spacing: CCSpace.lg) {
        WaterDropletRing(
          waterMl: totalMl,
          goalMl: glasses * WaterCard.glassMl
        )

        VStack(alignment: .leading, spacing: CCSpace.xs) {
          Text("\(glassesLogged) of \(glasses) glasses")
            .ccFont(.headline)
            .monospacedDigit()
            .foregroundStyle(Color.ccTextPrimary)
          Text("\(totalMl.formatted(.number.locale(Locale(identifier: "en_US")))) ml today")
            .ccFont(.subhead)
            .monospacedDigit()
            .foregroundStyle(Color.ccTextSecondary)
        }
        Spacer()
      }

      HStack(spacing: CCSpace.sm) {
        quickAddTile(
          symbol: "minus",
          title: "−250 ml",
          delta: -WaterCard.glassMl,
          identifier: "water.subtract"
        )
        quickAddTile(
          symbol: "plus",
          title: "+250 ml",
          delta: WaterCard.glassMl,
          identifier: "water.add"
        )
      }
    }
  }

  private func quickAddTile(
    symbol: String,
    title: String,
    delta: Int,
    identifier: String
  ) -> some View {
    Button {
      onQuickAdd(delta)
    } label: {
      HStack(spacing: CCSpace.xs) {
        Image(systemName: symbol)
          .font(.system(size: 15, weight: .semibold))
        Text(title)
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
      }
      .foregroundStyle(Color.ccTextPrimary)
      .frame(maxWidth: .infinity)
      .frame(minHeight: 44)
      .background(Color.ccSurface)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, lineWidth: 1)
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier(identifier)
  }
}
