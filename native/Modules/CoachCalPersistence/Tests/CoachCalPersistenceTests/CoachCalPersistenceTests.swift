import Testing

@testable import CoachCalPersistence

@Suite
struct CoachCalPersistenceTests {
  @Test
  func moduleNameIsExposed() {
    #expect(CoachCalPersistence.moduleName == "CoachCalPersistence")
  }
}
