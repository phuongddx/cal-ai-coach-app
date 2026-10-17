import CoachCalDesignSystem
import SwiftUI

// 56pt goal-variant ring geometry with a droplet center. Water progress is a
// glasses fraction — not kcal data — so it deliberately bypasses CCCalorieRing,
// whose ED-Safe policy replaces fractions with real-clock "% of day".
struct WaterDropletRing: View {
  let waterMl: Int
  let goalMl: Int

  @Environment(\.colorScheme) private var colorScheme

  private var fraction: Double {
    guard goalMl > 0 else { return 0 }
    return min(max(Double(waterMl) / Double(goalMl), 0), 1)
  }

  var body: some View {
    ZStack {
      Circle()
        .stroke(
          colorScheme == .dark ? Color.white.opacity(0.1) : Color.ccSurface,
          lineWidth: CCSize.ringGoalStroke
        )
      Circle()
        .trim(to: fraction)
        .stroke(
          Color.ccAccentLime,
          style: StrokeStyle(lineWidth: CCSize.ringGoalStroke, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))
      Image(systemName: "drop.fill")
        .font(.system(size: 14))
        .foregroundStyle(Color.ccAccentInk)
    }
    .frame(width: CCSize.ringGoal, height: CCSize.ringGoal)
    .accessibilityHidden(true)
  }
}

// UI-SPEC Group E (contract-defined): compact 56pt lime droplet ring + goal
// caption; tap opens the water log sheet. Water has no kcal framing, so it
// stays visible under ED-Safe.
struct WaterCard: View {
  let waterMl: Int
  let glasses: Int
  let onTap: () -> Void

  static let glassMl = 250

  private var glassesLogged: Int {
    waterMl / Self.glassMl
  }

  var body: some View {
    Button(action: onTap) {
      HStack(spacing: CCSpace.md) {
        WaterDropletRing(
          waterMl: waterMl,
          goalMl: glasses * Self.glassMl
        )

        VStack(alignment: .leading, spacing: 2) {
          Text("Water")
            .ccFont(.headline)
            .foregroundStyle(Color.ccTextPrimary)
          Text("\(glassesLogged) of \(glasses) glasses")
            .ccFont(.subhead)
            .monospacedDigit()
            .foregroundStyle(Color.ccTextSecondary)
        }

        Spacer()

        Image(systemName: "chevron.right")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.ccTextTertiary)
          .accessibilityHidden(true)
      }
      .padding(CCSpace.lg)
      .background(Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.lg)
          .strokeBorder(Color.ccBorder, lineWidth: 1)
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Water, \(glassesLogged) of \(glasses) glasses")
    .accessibilityIdentifier("today.waterCard")
    .accessibilityAddTraits(.isButton)
  }
}
