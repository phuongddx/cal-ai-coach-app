import CoachCalDesignSystem
import SwiftUI

struct MainShell: View {
  enum ShellTab: Hashable {
    case today
    case progress
    case coach
    case profile
  }

  // coachcal://diary presentation — a sheet, like TodayView's diary route.
  private struct DiaryLink: Identifiable {
    let id = UUID()
    let date: Date?
  }

  @Environment(AppEnvironment.self) private var environment
  @State private var selection: ShellTab = .today
  @State private var diaryLink: DiaryLink?

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
    .sheet(item: $diaryLink) { link in
      DiaryDayView(
        model: DiaryDayModel(
          pool: environment.database,
          userId: AppEnvironment.demoUserId,
          day: link.date ?? environment.now(),
          now: environment.now
        )
      )
    }
    .onChange(of: environment.pendingDeepLink) {
      applyDeepLink()
    }
    .task { applyDeepLink() }
  }

  // Deep links always land on Today; the diary link additionally opens the
  // day sheet. The pending value is consumed so a later onChange re-fires.
  private func applyDeepLink() {
    guard let link = environment.pendingDeepLink else { return }
    selection = .today
    if case .diary(let date) = link {
      diaryLink = DiaryLink(date: date)
    }
    environment.pendingDeepLink = nil
  }
}
