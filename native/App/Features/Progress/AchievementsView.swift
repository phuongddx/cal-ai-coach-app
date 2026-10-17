import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// ENG-01/02 achievements surface: streak hero (with freeze chip), earned +
// locked badge grids, and the disabled progress-photos row (ENG2-01 is v2 —
// the planner choice recorded in UI-SPEC renders the row disabled).
struct AchievementsView: View {
  let model: ProgressModel

  var body: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      if let streak = model.snapshot.streak {
        CCStreakCard(
          emoji: "🔥",
          streak: streak.currentStreak,
          title: Self.streakTitle(current: streak.currentStreak, best: streak.bestStreak),
          freezesLeft: streak.freezesLeft
        )
      }

      let earned = model.snapshot.badges.filter { $0.earnedAt != nil }
      if !earned.isEmpty {
        CCSectionHeader("Earned badges")
        badgeGrid(earned)
      }

      let locked = model.snapshot.badges.filter { $0.earnedAt == nil }
      if !locked.isEmpty {
        CCSectionHeader("Unlock next")
        badgeGrid(locked)
      }

      progressPhotosRow
    }
  }

  // 3-column grid that wraps regardless of how many badges are earned or locked.
  private func badgeGrid(_ badges: [Badge]) -> some View {
    LazyVGrid(
      columns: [
        GridItem(.flexible(), spacing: CCSpace.sm),
        GridItem(.flexible(), spacing: CCSpace.sm),
        GridItem(.flexible(), spacing: CCSpace.sm),
      ],
      spacing: CCSpace.sm
    ) {
      ForEach(badges, id: \.id) { badge in
        CCBadgeTile(
          emoji: Self.emoji(forCode: badge.code),
          name: badge.label,
          detail: badge.earnedAt == nil ? "\(Self.lockedDaysLeft(badge)) days left" : (badge.detail ?? ""),
          isLocked: badge.earnedAt == nil
        )
      }
    }
  }

  private var progressPhotosRow: some View {
    HStack(spacing: CCSpace.md) {
      Image(systemName: "camera")
        .font(.system(size: 20))
        .foregroundStyle(Color.ccTextSecondary)
        .frame(width: 24)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text("Progress photos")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextPrimary)
        Text("Coming later")
          .ccFont(.caption)
          .foregroundStyle(Color.ccTextTertiary)
      }
      Spacer()
    }
    .padding(.vertical, CCSpace.sm)
    .padding(.horizontal, CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .opacity(0.5)
    .disabled(true)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Progress photos, coming later")
  }

  // "Day 1 streak started!" surfaces from current == 1; otherwise the hero
  // title carries the personal best.
  static func streakTitle(current: Int, best: Int) -> String {
    current <= 1 ? "Day 1 streak started!" : "Personal best: \(best) days"
  }

  static func lockedDaysLeft(_ badge: Badge) -> Int {
    max(badge.target - badge.progress, 0)
  }

  static func emoji(forCode code: String) -> String {
    switch code {
    case "first-scan": "📸"
    case "streak-7", "streak-30": "🔥"
    case "water-habit": "💧"
    case "scans-50": "🎯"
    default: "🏅"
    }
  }
}
