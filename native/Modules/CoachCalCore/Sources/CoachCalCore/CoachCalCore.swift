public enum CoachCalCore {
  public static let moduleName = "CoachCalCore"
}

public struct WalkingSnapshot: Equatable, Sendable {
  public let stepCount: Int

  public init(stepCount: Int) {
    self.stepCount = stepCount
  }
}
