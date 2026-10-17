import Foundation
import Supabase
import Testing
@testable import CoachCalNetworking

@Suite(.serialized)
struct LiveApiClientTests {
  @Test
  func decodesTheSameScanResponseFixtureApiClientDecodes() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 200, json: [
      "scanId": scanId.uuidString,
      "kind": "photo",
      "items": [scanItemJSON],
      "mealKcal": 248,
      "scanConfidence": 0.92,
      "note": NSNull(),
    ])
    let client = LiveApiClient(client: makeClient())

    let response = try await client.analyzeFood(ScanRequest(kind: .photo))

    #expect(response.scanId == scanId)
    #expect(response.mealKcal == 248)
    #expect(response.items.first?.label == "grilled chicken")
    let recorded = try #require(RecordingURLProtocol.requests.first)
    #expect(recorded.url?.path == "/functions/v1/analyze-food")
  }

  @Test
  func freeLimitReachedEnvelopeMapsToQuotaScanAPIError() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 402, json: [
      "error": [
        "code": "FREE_LIMIT_REACHED",
        "entitlement": [
          "tier": "free",
          "scansUsed": 3,
          "scanLimit": 3,
          "windowResetAt": "2026-09-23T00:00:00Z",
        ],
      ]
    ])
    let client = LiveApiClient(client: makeClient())

    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .photo))
      Issue.record("expected a ScanAPIError")
    } catch let error as ScanAPIError {
      #expect(error.isQuotaReached)
      if case .envelope(let code, _, let entitlement) = error {
        #expect(code == "FREE_LIMIT_REACHED")
        #expect(entitlement?.scansUsed == 3)
      }
    }
  }

  @Test
  func barcodeNotFoundEnvelopeMapsToTypedScanAPIError() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 404, json: [
      "error": ["code": "BARCODE_NOT_FOUND", "details": ["no grounding source resolved this barcode"]]
    ])
    let client = LiveApiClient(client: makeClient())

    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .barcode, barcode: "0036000291459"))
      Issue.record("expected a ScanAPIError")
    } catch let error as ScanAPIError {
      #expect(error.isBarcodeNotFound)
    }
  }

  @Test
  func vlmSchemaErrorEnvelopeMapsToTypedScanAPIError() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 422, json: [
      "error": ["code": "VLM_SCHEMA_ERROR", "details": ["items.0.confidence: Required"]]
    ])
    let client = LiveApiClient(client: makeClient())

    do {
      _ = try await client.analyzeFood(ScanRequest(kind: .photo))
      Issue.record("expected a ScanAPIError")
    } catch let error as ScanAPIError {
      #expect(error.isSchemaError)
    }
  }

  @Test
  func fastResponseReportsTier1TelemetryWithoutEscalation() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 200, json: [
      "scanId": scanId.uuidString,
      "kind": "text",
      "items": [scanItemJSON],
      "mealKcal": 248,
      "scanConfidence": 0.92,
      "note": NSNull(),
    ])
    let events = TelemetrySink()
    let client = LiveApiClient(client: makeClient(), onTelemetry: { events.record($0) })

    _ = try await client.analyzeFood(ScanRequest(kind: .text, text: "chicken and rice"))

    let recorded = try #require(events.events.first)
    #expect(recorded.tier == "tier1")
    #expect(!recorded.escalated)
  }

  private var scanId: UUID { UUID(uuidString: "826FA3C6-D8A7-4405-B28B-9DBCD75BC4C5")! }

  private var scanItemJSON: [String: Any] {
    [
      "label": "grilled chicken",
      "grams": 200,
      "gramsBasis": "estimated",
      "confidence": 0.85,
      "hiddenFatLikely": false,
      "source": "fdc",
      "per100g": ["kcal": 124, "proteinG": 22.0, "carbsG": 0.0, "fatG": 3.0, "fiberG": 0.0],
      "kcal": 248,
      "proteinG": 44.0,
      "carbsG": 0.0,
      "fatG": 6.0,
      "fiberG": 0.0,
      "unresolved": false,
    ]
  }

  private func makeClient() -> SupabaseClient {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [RecordingURLProtocol.self]
    return SupabaseClient(
      supabaseURL: URL(string: "https://project-ref.supabase.co")!,
      supabaseKey: "local-test-key",
      options: SupabaseClientOptions(
        auth: .init(storage: EmptyLocalStorage()),
        global: .init(session: URLSession(configuration: configuration))
      )
    )
  }
}

// Testing closures require a reference type to accumulate results across the
// @Sendable telemetry callback boundary.
private final class TelemetrySink: @unchecked Sendable {
  private(set) var events: [ScanTelemetryEvent] = []
  func record(_ event: ScanTelemetryEvent) { events.append(event) }
}

private final class EmptyLocalStorage: AuthLocalStorage, @unchecked Sendable {
  func store(key: String, value: Data) throws {}
  func retrieve(key: String) throws -> Data? { nil }
  func remove(key: String) throws {}
}

private final class RecordingURLProtocol: URLProtocol {
  nonisolated(unsafe) private static var _requests: [URLRequest] = []
  nonisolated(unsafe) private static var response = (200, Data())

  static var requests: [URLRequest] {
    get { _requests }
    set { _requests = newValue }
  }

  static func reset() {
    _requests = []
    response = (200, Data())
  }

  static func respond(with status: Int, json: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: json)
    response = (status, data)
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canInit(with task: URLSessionTask) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    Self._requests.append(request)
    let (status, data) = Self.response
    let response = HTTPURLResponse(
      url: request.url!,
      statusCode: status,
      httpVersion: "HTTP/1.1",
      headerFields: [
        "Content-Type": "application/json",
        "Content-Length": String(data.count),
      ]
    )!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: data)
    client?.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}
