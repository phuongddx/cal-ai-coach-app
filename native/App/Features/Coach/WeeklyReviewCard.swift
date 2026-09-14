import CoachCalDesignSystem
import SwiftUI

// Weekly review: 3 stats (600 20) + success encouragement. ED-Safe keeps the
// habit stat (days logged), hides the kcal-derived "% on target" and kg
// framing, and shows "weeks with all meals logged" instead (TRU-04).
struct WeeklyReviewCard: View {
  struct ReviewStat: Equatable, Identifiable, Sendable {
    let id: String
    let label: String
    let value: String
  }

  let stats: CoachModel.WeekStats
  let targetKcal: Int?

  @Environment(\.edSafeMode) private var edSafeMode

  var body: some View {
    CCCard {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        CCSectionHeader("Weekly review")

        HStack(alignment: .top, spacing: CCSpace.lg) {
          ForEach(Self.visibleStats(stats, edSafeMode: edSafeMode)) { stat in
            VStack(alignment: .leading, spacing: 2) {
              Text(stat.value)
                .font(.system(size: 20, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.ccAccentInk)
              Text(stat.label)
                .ccFont(.caption)
                .foregroundStyle(Color.ccTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
        }

        CCBannerNote(Self.encouragement(daysLogged: stats.daysLogged), variant: .success)
      }
    }
  }

  // Pure stat-visibility core so both ED-Safe branches are assertable without
  // environment injection (ViewInspector cannot inject EnvironmentValues).
  static func visibleStats(_ stats: CoachModel.WeekStats, edSafeMode: Bool) -> [ReviewStat] {
    var visible = [
      ReviewStat(id: "days", label: "Days logged", value: "\(stats.daysLogged)")
    ]
    if edSafeMode {
      visible.append(
        ReviewStat(id: "weeks", label: "Weeks with all meals logged", value: "\(stats.weeksAllLogged)")
      )
    } else {
      let percent = stats.daysLogged > 0
        ? Int((Double(stats.daysOnTarget) / Double(stats.daysLogged) * 100).rounded())
        : 0
      visible.append(ReviewStat(id: "target", label: "% on target", value: "\(percent)%"))
      visible.append(ReviewStat(id: "kg", label: "kg this week", value: kgValue(stats.kgThisWeek)))
    }
    return visible
  }

  static func kgValue(_ kg: Double) -> String {
    let rounded = (kg * 10).rounded() / 10
    if rounded > 0 { return "+" + String(format: "%.1f", rounded) }
    if rounded < 0 { return "−" + String(format: "%.1f", -rounded) }
    return "0.0"
  }

  // Habit framing only — no kcal, no food morality.
  static func encouragement(daysLogged: Int) -> String {
    daysLogged >= 7
      ? "You logged every day this week — great consistency!"
      : "You logged \(daysLogged) of 7 days this week — keep it up!"
  }
}
