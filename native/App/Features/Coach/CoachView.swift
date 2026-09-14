import CoachCalDesignSystem
import SwiftUI

struct CoachView: View {
  let model: CoachModel
  let greeting: String

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        Text(greeting)
          .ccFont(.title)
          .foregroundStyle(Color.ccTextPrimary)

        if !model.insights.isEmpty {
          CCSectionHeader("Today's insights")
          VStack(spacing: CCSpace.md) {
            ForEach(model.insights, id: \.id) { insight in
              CCInsightCard(title: insight.title, text: insight.body)
            }
          }
        }

        WeeklyReviewCard(stats: model.weekStats, targetKcal: model.targetKcal)

        // Locked trust copy (T-P06-01) — rendered permanently, never conditional.
        CCBannerNote(
          "Coach provides supportive guidance based on your data. Not medical advice. No food is \"good\" or \"bad.\""
        )
      }
      .padding(CCSpace.lg)
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(Color.ccBackground)
  }
}
