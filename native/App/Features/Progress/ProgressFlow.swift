import CoachCalDesignSystem
import SwiftUI

// Placeholder body — 03-06 replaces this file's contents with the Progress feature.
struct ProgressFlow: View {
  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        CCSectionHeader("Progress")
        Text("Progress")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
      }
      .padding(CCSpace.lg)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.ccBackground)
    }
  }
}
