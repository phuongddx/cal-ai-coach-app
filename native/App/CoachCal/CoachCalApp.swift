import SwiftUI

@main
struct CoachCalApp: App {
  init() {
    _ = PersistenceBootstrap.shared
  }

  var body: some Scene {
    WindowGroup {
      WalkingScreen()
    }
  }
}
