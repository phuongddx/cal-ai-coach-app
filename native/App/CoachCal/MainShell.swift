import CoachCalDesignSystem
import SwiftUI

struct MainShell: View {
  enum ShellTab: Hashable {
    case today
    case progress
    case coach
    case profile
  }

  @Environment(AppEnvironment.self) private var environment
  @State private var selection: ShellTab = .today

  var body: some View {
    @Bindable var environment = environment

    TabView(selection: $selection) {
      Tab("Today", systemImage: "sun.max", value: .today) {
        TodayFlow()
      }
      Tab("Progress", systemImage: "chart.line.uptrend.xyaxis", value: .progress) {
        ProgressFlow()
      }
      Tab("Coach", systemImage: "bell", value: .coach) {
        CoachFlow()
      }
      Tab("Profile", systemImage: "gearshape", value: .profile) {
        ProfileFlow()
      }
    }
    .ccTabBarStyle()
    .overlay(alignment: .bottom) {
      ScanFAB { environment.openScan(.photo, mealSlot: nil) }
        .padding(.bottom, 28)
        .accessibilityIdentifier("shell.fab")
    }
    .fullScreenCover(item: $environment.scanRoute) { route in
      ScanFlowView(route: route)
    }
  }
}
