import Foundation

// Golden fixtures under native/App/CoachCal/Resources/Golden/ are copied
// verbatim from supabase/functions/tests/golden/ (the tracked origin); a
// Phase 4 CI check must diff both directories so the bundled shapes cannot
// drift from the server contract.

public enum FixtureScenario: String, Equatable, Sendable, CaseIterable {
  case response200 = "200"
  // DEBUG-test-only variant (held-out backstop): the golden 200 with
  // unresolved: true. Lives outside Resources/Golden so that directory stays
  // a verbatim copy of the server contract.
  case response200Unresolved = "200-unresolved"
  case quota402 = "402"
  case notFound404 = "404"
  case schema422 = "422"

  public static let launchArgument = "--ccScanScenario"

  // Release builds must never let launch arguments pick the scan surface
  // (T-P07-03); they always run the golden 200. DEBUG (incl. UI tests) keeps
  // the scenario matrix reachable. The client itself is Phase-3-only — the
  // live edge-function client replaces it in Phase 4.
  public static func resolve(from arguments: [String]) -> FixtureScenario {
    #if DEBUG
    guard let index = arguments.firstIndex(of: launchArgument),
      index + 1 < arguments.count,
      let scenario = FixtureScenario(rawValue: arguments[index + 1])
    else { return .response200 }
    return scenario
    #else
    return .response200
    #endif
  }
}

public struct FixtureApiClient: CoachCalAPI, Sendable {
  private let bundle: Bundle
  private let scenario: FixtureScenario

  public init(bundle: Bundle, scenario: FixtureScenario? = nil) {
    self.bundle = bundle
    self.scenario = scenario ?? FixtureScenario.resolve(
      from: ProcessInfo.processInfo.arguments
    )
  }

  public func analyzeFood(_ request: ScanRequest) async throws -> ScanResponse {
    switch scenario {
    case .response200, .response200Unresolved:
      let name = scenario == .response200 ? "scan-response-200" : "scan-response-200-unresolved"
      return try decodeFixture(name, as: ScanResponse.self)
    case .quota402:
      throw try envelopeError(for: "error-402-free-limit")
    case .notFound404:
      throw try envelopeError(for: "error-404-barcode-not-found")
    case .schema422:
      throw try envelopeError(for: "error-422-vlm-schema")
    }
  }

  private func decodeFixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
    let data = try fixtureData(name)
    return try JSONDecoder().decode(type, from: data)
  }

  private func envelopeError(for name: String) throws -> ScanAPIError {
    let envelope = try decodeFixture(name, as: FixtureErrorEnvelope.self)
    return ScanAPIError.envelope(
      code: envelope.error.code,
      details: envelope.error.details,
      entitlement: envelope.error.entitlement
    )
  }

  private func fixtureData(_ name: String) throws -> Data {
    let url = bundle.url(
      forResource: name,
      withExtension: "golden.json",
      subdirectory: "Fixtures"
    ) ?? bundle.url(forResource: name, withExtension: "golden.json")
    guard let url else {
      fatalError("FixtureApiClient bundle is missing \(name).golden.json")
    }
    return try Data(contentsOf: url)
  }
}
