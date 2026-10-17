import Testing

@testable import CoachCalDesignSystem

@Suite
struct CoachCalDesignSystemTests {
  @Test
  func moduleNameIsExposed() {
    #expect(CoachCalDesignSystem.moduleName == "CoachCalDesignSystem")
  }
}
