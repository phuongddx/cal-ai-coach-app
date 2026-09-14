import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

// Group F Profile screen (props-driven for hosted tests/snapshots; ProfileFlow
// holds the environment). The plan line derives from the display-only
// subscription state — Phase 3 is Free-only (T-P07-05), so the DS's "Pro"
// mockup badge renders honestly as "Free · Since".
struct ProfileView: View {
  let stats: ProfileModel.Stats
  var onEditTargets: (() -> Void)?
  var onOpenSettings: () -> Void

  // Test seam: ViewInspector cannot re-render @State after a tap on a
  // manually-constructed view, so hosted tests inject the revealed state.
  @State private var showsHealthNote: Bool

  init(
    stats: ProfileModel.Stats,
    onEditTargets: (() -> Void)? = nil,
    onOpenSettings: @escaping () -> Void,
    healthNoteRevealed: Bool = false
  ) {
    self.stats = stats
    self.onEditTargets = onEditTargets
    self.onOpenSettings = onOpenSettings
    _showsHealthNote = State(initialValue: healthNoteRevealed)
  }

  private var planLine: String {
    guard let since = stats.memberSince else { return "Free plan" }
    let month = since.formatted(
      .dateTime.month(.abbreviated).year().locale(Locale(identifier: "en_US"))
    )
    return "Free · Since \(month)"
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        userCard
        quickStats
        CCSectionHeader("Goals & targets")
        goalsGroup
        CCSectionHeader("Integrations")
        CCSettingsGroup {
          Button {
            showsHealthNote = true
          } label: {
            CCSettingsRow(icon: "heart.fill", label: "Apple Health", value: "Not connected")
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("profile.row.appleHealth")
        }
        if showsHealthNote {
          // INT-01 is Phase 4: an honest footnote, never a permission prompt.
          CCBannerNote(OnboardingCopy.healthConnectNote)
            .accessibilityIdentifier("profile.healthNote")
        }
        CCSectionHeader("Preferences")
        CCSettingsGroup {
          CCSettingsRow(icon: "bell", label: "Reminders", value: "Off")
          CCSettingsRow(icon: "sun.max", label: "Appearance", value: "System")
          CCSettingsRow(icon: "globe", label: "Units", value: "Metric")
        }
        CCSettingsGroup {
          Button(action: onOpenSettings) {
            CCSettingsRow(icon: "gearshape", label: "Settings")
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("profile.row.settings")
        }
      }
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl5)
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(Color.ccBackground)
    .navigationTitle("Profile")
    .navigationBarTitleDisplayMode(.inline)
  }

  private var userCard: some View {
    HStack(spacing: CCSpace.md) {
      Text("A")
        .font(.system(size: 24, weight: .bold))
        .foregroundStyle(Color.black)
        .frame(width: 56, height: 56)
        .background(
          LinearGradient(
            colors: [Color.ccAccentLime.opacity(0.9), Color.ccAccentLime.opacity(0.55)],
            startPoint: .topLeading, endPoint: .bottomTrailing
          ),
          in: Circle()
        )
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text("Alex")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Text(planLine)
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
      }
      Spacer()
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Alex, \(planLine)")
    .accessibilityIdentifier("profile.userCard")
  }

  private var quickStats: some View {
    HStack(spacing: CCSpace.sm) {
      // The kcal-derived stat is the only calorie framing on this screen, so
      // it collapses under ED-Safe like every other tracking surface.
      statCard(
        identifier: "profile.stat.dailyTarget",
        value: stats.target.map { grouped($0.dailyKcal) } ?? "—",
        caption: "kcal / day"
      )
      .edSafeHidden()
      statCard(
        identifier: "profile.stat.daysLogged",
        value: "\(stats.daysLogged)",
        caption: "Days logged"
      )
      statCard(
        identifier: "profile.stat.weight",
        value: stats.latestKg.map { String(format: "%.1f", $0) } ?? "—",
        caption: "Weight, kg"
      )
    }
  }

  private func statCard(identifier: String, value: String, caption: String) -> some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      Text(value)
        .font(.system(size: 20, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(Color.ccAccentInk)
      Text(caption)
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(caption) \(value)")
    .accessibilityIdentifier(identifier)
  }

  @ViewBuilder
  private var goalsGroup: some View {
    let dailyTargetValue = stats.target.map { "\(grouped($0.dailyKcal)) kcal" } ?? "—"
    let macroValue = stats.target.map {
      "\($0.proteinG)P · \($0.carbsG)C · \($0.fatG)F"
    } ?? "—"
    let goalWeightValue = stats.target.map {
      String(format: "%.0f kg", $0.goalWeightKg ?? $0.weightKg ?? 0)
    } ?? "—"
    CCSettingsGroup {
      Button {
        onEditTargets?()
      } label: {
        CCSettingsRow(icon: "flame", label: "Daily target", value: dailyTargetValue)
      }
      .buttonStyle(.plain)
      .edSafeHidden()
      .accessibilityIdentifier("profile.row.dailyTarget")
      Button {
        onEditTargets?()
      } label: {
        CCSettingsRow(icon: "chart.pie", label: "Macro ratios", value: macroValue)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("profile.row.macroRatios")
      Button {
        onEditTargets?()
      } label: {
        CCSettingsRow(icon: "scalemass", label: "Goal weight", value: goalWeightValue)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("profile.row.goalWeight")
    }
  }

  // DS copy groups with an en-US comma ("of 2,150 kcal goal"); pinned locale
  // keeps snapshots deterministic across host locales.
  private func grouped(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "en_US")
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
  }
}
