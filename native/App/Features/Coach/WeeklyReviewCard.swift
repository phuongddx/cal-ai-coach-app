import CoachCalDesignSystem
import SwiftUI

// Weekly review: 3 stats (600 20) + success encouragement. The ED-Safe stat
// swap lives inside the DS component (CCWeeklyReviewStats); this feature file
// holds no policy branch (GATE-1).
struct WeeklyReviewCard: View {
  let stats: CoachModel.WeekStats
  let targetKcal: Int?

  var body: some View {
    CCCard {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        CCSectionHeader("Weekly review")

        CCWeeklyReviewStats(
          daysLogged: stats.daysLogged,
          daysOnTarget: stats.daysOnTarget,
          weeksAllLogged: stats.weeksAllLogged,
          kgThisWeek: stats.kgThisWeek
        )

        CCBannerNote(Self.encouragement(daysLogged: stats.daysLogged), variant: .success)
      }
    }
  }

  // Habit framing only — no kcal, no food morality.
  static func encouragement(daysLogged: Int) -> String {
    daysLogged >= 7
      ? "You logged every day this week — great consistency!"
      : "You logged \(daysLogged) of 7 days this week — keep it up!"
  }
}
