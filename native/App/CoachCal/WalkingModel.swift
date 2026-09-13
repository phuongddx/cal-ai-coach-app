import CoachCalCore
import Observation

@MainActor
@Observable
final class WalkingModel {
  private(set) var snapshot: WalkingSnapshot

  var count: Int {
    get { snapshot.stepCount }
    set { snapshot = WalkingSnapshot(stepCount: newValue) }
  }

  init(snapshot: WalkingSnapshot = WalkingSnapshot(stepCount: 0)) {
    self.snapshot = snapshot
  }

  func increment() {
    count += 1
  }
}
