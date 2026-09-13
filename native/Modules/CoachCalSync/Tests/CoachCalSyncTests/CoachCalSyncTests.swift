import Testing

@testable import CoachCalSync

@Suite
struct CoachCalSyncTests {
  @Test
  func moduleNameIsExposed() {
    #expect(CoachCalSync.moduleName == "CoachCalSync")
  }
}
