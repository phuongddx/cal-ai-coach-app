import Testing

@testable import CoachCalCore

@Suite
struct CoachCalCoreTests {
  @Test
  func moduleNameIsExposed() {
    #expect(CoachCalCore.moduleName == "CoachCalCore")
  }
}
