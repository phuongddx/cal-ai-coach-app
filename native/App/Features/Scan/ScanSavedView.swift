import CoachCalDesignSystem
import SwiftUI

// Saved + Undo (UI-SPEC Group D): DS toast with Undo tombstoning the
// just-written entries, "Today so far" peek, first-log streak card, and the
// View diary / Add more quick actions.
struct ScanSavedView: View {
  let model: ScanModel
  let onViewDiary: () -> Void
  let onAddMore: () -> Void

  @State private var toastVisible = true

  private var mealName: String { ManualLogSheet.mealName(model.mealSlot) }

  var body: some View {
    VStack(spacing: CCSpace.lg) {
      Spacer()
      if toastVisible {
        CCToast(
          title: "Saved to \(mealName)",
          kcalText: model.savedKcal.map { "\($0) kcal added" },
          onUndo: {
            toastVisible = false
            Task { await model.undo() }
          },
          onDismiss: { toastVisible = false }
        )
        .accessibilityIdentifier("scan.savedToast")
      }
      summaryPeek
      if model.streakCount == 1 {
        CCStreakCard(
          emoji: "🔥",
          streak: 1,
          title: "Day 1 streak started!",
          freezesLeft: model.freezesLeft
        )
        .padding(.horizontal, CCSpace.lg)
        .accessibilityIdentifier("scan.streakCard")
      }
      HStack(spacing: CCSpace.md) {
        CCSecondaryButton("View diary", action: onViewDiary)
          .accessibilityIdentifier("scan.viewDiary")
        CCSecondaryButton("Add more", action: onAddMore)
          .accessibilityIdentifier("scan.addMore")
      }
      .padding(.horizontal, CCSpace.lg)
      Spacer()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.ccBackground.ignoresSafeArea())
  }

  // "Today so far" peek — kcal framing collapses entirely in ED-Safe.
  private var summaryPeek: some View {
    VStack(spacing: CCSpace.xs) {
      Text("Today so far")
        .ccFont(.caption)
        .fontWeight(.medium)
        .textCase(.uppercase)
        .kerning(0.55)
        .foregroundStyle(Color.ccTextSecondary)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text("\(model.todayKcal ?? 0)")
          .font(.system(size: 40, weight: .bold))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("scan.todayKcal")
        if let goal = model.goalKcal {
          Text("of \(goal) kcal")
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextSecondary)
        }
      }
    }
    .edSafeHidden()
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("scan.todaySoFar")
  }
}
