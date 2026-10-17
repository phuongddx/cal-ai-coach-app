import Testing

@testable import CoachCalNetworking

@Suite
struct CoachCalNetworkingTests {
  @Test
  func moduleNameIsExposed() {
    #expect(CoachCalNetworking.moduleName == "CoachCalNetworking")
  }
}
