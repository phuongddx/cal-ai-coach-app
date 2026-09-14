import CoachCalDesignSystem
import SwiftUI

@main
struct CoachCalApp: App {
  @State private var environment = AppEnvironment()

  init() {
    _ = PersistenceBootstrap.shared
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(environment)
        .environment(\.edSafeMode, environment.edSafeMode)
        .ccAnimationDisabled(environment.animationsDisabled)
        .onOpenURL { environment.open(url: $0) }
    }
  }
}
