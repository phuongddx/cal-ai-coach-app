import Foundation
import Testing
import CoachCalCore

@testable import CoachCalNetworking

@Suite
struct FixtureScenarioTests {
  private let decoder = JSONDecoder()

  private struct TestFailure: Error {}

  private func readFixture(_ name: String) throws -> Data {
    let url = Bundle.module
      .url(forResource: name, withExtension: "golden.json", subdirectory: "Fixtures")
      ?? Bundle.module.url(forResource: name, withExtension: "golden.json")
    guard let url else {
      throw TestFailure()
    }
    return try Data(contentsOf: url)
  }

  private func decode<T: Decodable>(_ name: String, _ type: T.Type) throws -> T {
    try decoder.decode(type, from: readFixture(name))
  }

  private func mutatedFixture(
    _ data: Data,
    mutation: (inout [String: Any]) -> Void
  ) throws -> Data {
    var object = try #require(
      JSONSerialization.jsonObject(with: data) as? [String: Any],
      "Fixture root is not an object"
    )
    mutation(&object)
    return try JSONSerialization.data(withJSONObject: object)
  }

  @Test
  func scanResponse200DecodesStrictlyAndMatchesArithmeticParity() throws {
    let response = try decode("scan-response-200", ScanResponse.self)

    #expect(response.scanId == UUID(uuidString: "AA000000-0000-4000-8000-000000000001"))
    #expect(response.kind == .photo)
    #expect(response.mealKcal == 464)
    #expect(response.scanConfidence == 0.92)
    #expect(response.note == nil)

    let item = try #require(response.items.first)
    #expect(item.label == "chicken-rice")
    #expect(item.grams == 320)
    #expect(item.gramsBasis == "estimated")
    #expect(item.confidence == 0.92)
    #expect(item.hiddenFatLikely == false)
    #expect(item.source == "cache")
    #expect(item.per100g == Per100g(kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2))
    #expect(item.unresolved == false)

    #expect(item.kcal == KcalArithmetic.mealKcal(per100gKcal: 145, grams: 320))
    #expect(item.proteinG == KcalArithmetic.macroGrams(per100g: 27, grams: 320))
    #expect(item.carbsG == KcalArithmetic.macroGrams(per100g: 40, grams: 320))
    #expect(item.fatG == KcalArithmetic.macroGrams(per100g: 4, grams: 320))
    #expect(item.fiberG == KcalArithmetic.macroGrams(per100g: 2, grams: 320))
  }

  @Test
  func unresolved200VariantDecodesStrictly() throws {
    let response = try decode("scan-response-200-unresolved", ScanResponse.self)

    let item = try #require(response.items.first)
    #expect(item.label == "chicken-rice")
    #expect(item.unresolved == true, "held-out backstop variant flips only the unresolved flag")
    #expect(item.kcal == KcalArithmetic.mealKcal(per100gKcal: 145, grams: 320))
    #expect(response.mealKcal == 464)
  }

  @Test
  func quota402DecodesEntitlementAndThrowsEnvelope() async throws {
    let envelope = try decode("error-402-free-limit", FixtureErrorEnvelope.self)
    #expect(envelope.error.code == "FREE_LIMIT_REACHED")
    #expect(envelope.error.details == nil)

    let entitlement = try #require(envelope.error.entitlement)
    #expect(entitlement.tier == "free")
    #expect(entitlement.scansUsed == 3)
    #expect(entitlement.scanLimit == 3)
    let expectedReset = try #require(ISO8601DateFormatter().date(from: "2026-09-21T10:00:00Z"))
    #expect(entitlement.windowResetAt == expectedReset)

    let client = FixtureApiClient(bundle: .module, scenario: .quota402)
    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .photo))
      #expect(Bool(false), "Expected the 402 fixture to throw")
    } catch let error as ScanAPIError {
      #expect(error.isQuotaReached)
      #expect(error == .envelope(
        code: "FREE_LIMIT_REACHED",
        details: nil,
        entitlement: entitlement
      ))
    }
  }

  @Test
  func notFound404ThrowsBarcodeNotFoundEnvelope() async throws {
    let client = FixtureApiClient(bundle: .module, scenario: .notFound404)
    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .barcode, barcode: "0123456789012"))
      #expect(Bool(false), "Expected the 404 fixture to throw")
    } catch let error as ScanAPIError {
      #expect(error.isBarcodeNotFound)
      #expect(error == .envelope(
        code: "BARCODE_NOT_FOUND",
        details: ["no grounding source resolved this barcode"],
        entitlement: nil
      ))
    }
  }

  @Test
  func schema422ThrowsVlmSchemaErrorEnvelope() async throws {
    let client = FixtureApiClient(bundle: .module, scenario: .schema422)
    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .label, imageBase64: "label-1"))
      #expect(Bool(false), "Expected the 422 fixture to throw")
    } catch let error as ScanAPIError {
      #expect(error.isSchemaError)
      #expect(error == .envelope(
        code: "VLM_SCHEMA_ERROR",
        details: ["items.0"],
        entitlement: nil
      ))
    }
  }

  @Test
  func unknownKeyMutationsAreRejectedForEachGoldenShape() throws {
    let scanData = try readFixture("scan-response-200")
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        ScanResponse.self,
        from: mutatedFixture(scanData) { $0["unknownKey"] = true }
      )
    }
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        ScanResponse.self,
        from: mutatedFixture(scanData) { $0.removeValue(forKey: "mealKcal") }
      )
    }

    for name in ["error-402-free-limit", "error-404-barcode-not-found", "error-422-vlm-schema"] {
      let data = try readFixture(name)
      #expect(throws: DecodingError.self) {
        try decoder.decode(
          FixtureErrorEnvelope.self,
          from: mutatedFixture(data) { $0["unknownKey"] = true }
        )
      }
      #expect(throws: DecodingError.self) {
        try decoder.decode(
          FixtureErrorEnvelope.self,
          from: mutatedFixture(data) { $0.removeValue(forKey: "error") }
        )
      }
    }
  }

  @Test
  func unknownKeyMutationInsideNestedItemIsRejected() throws {
    let scanData = try readFixture("scan-response-200")
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        ScanResponse.self,
        from: mutatedFixture(scanData) {
          var items = $0["items"] as? [[String: Any]] ?? []
          items[0]["mysteryField"] = 1
          $0["items"] = items
        }
      )
    }
  }

  @Test
  func scenarioResolvesFromLaunchArgumentsWithDefault200() {
    #expect(FixtureScenario.resolve(from: []) == .response200)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario", "200"]) == .response200)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario", "402"]) == .quota402)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario", "404"]) == .notFound404)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario", "422"]) == .schema422)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario", "bogus"]) == .response200)
    #expect(FixtureScenario.resolve(from: ["--ccScanScenario"]) == .response200)
    #expect(
      FixtureScenario.resolve(from: ["other", "--ccScanScenario", "422", "trailing"])
        == .schema422
    )
  }
}
