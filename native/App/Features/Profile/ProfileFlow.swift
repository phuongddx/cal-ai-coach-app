import CoachCalDesignSystem
import SwiftUI

// Placeholder body — 03-07 replaces this file's contents with Profile & Settings.
struct ProfileFlow: View {
  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        CCSectionHeader("Profile")
        Text("Profile")
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
