import Foundation

public protocol CoachCalAPI: Sendable {
  func analyzeFood(_ request: ScanRequest) async throws -> ScanResponse
}

public enum ScanAPIError: Error, Equatable, Sendable {
  case envelope(code: String, details: [String]?, entitlement: EntitlementState?)

  public var isQuotaReached: Bool {
    if case .envelope(let code, _, _) = self { return code == "FREE_LIMIT_REACHED" }
    return false
  }

  public var isBarcodeNotFound: Bool {
    if case .envelope(let code, _, _) = self { return code == "BARCODE_NOT_FOUND" }
    return false
  }

  public var isSchemaError: Bool {
    if case .envelope(let code, _, _) = self { return code == "VLM_SCHEMA_ERROR" }
    return false
  }
}

public struct ScanRequest: Codable, Equatable, Sendable {
  public enum Kind: String, Codable, Equatable, Sendable {
    case photo
    case barcode
    case label
    case text
  }

  // 04-07: the server's ScanRequestSchema requires `scanId: z.uuid()` as a
  // mandatory field — it's the idempotency key `persist_scan` writes by, and
  // the server echoes it back verbatim in ScanResponse.scanId. This struct
  // never carried it at all until this fix: every real scan through
  // LiveApiClient 400'd with VALIDATION_ERROR ("scanId: Required"), which
  // ScanModel.route() falls through to the generic .failed(.analysisFailure)
  // — the exact symptom chased across two sessions before reading the
  // server schema directly. Defaulting to a fresh UUID means every existing
  // call site (`ScanRequest(kind: .photo)` etc.) keeps working unchanged —
  // Swift re-evaluates a default-argument expression at each call, so no
  // two omitted-scanId requests ever collide. Lowercased to match the
  // golden fixtures' casing (zod's `z.uuid()` itself is case-insensitive).
  public let scanId: String
  public let kind: Kind
  public let barcode: String?
  public let text: String?
  public let imageBase64: String?

  public init(
    scanId: String = UUID().uuidString.lowercased(),
    kind: Kind,
    barcode: String? = nil,
    text: String? = nil,
    imageBase64: String? = nil
  ) {
    self.scanId = scanId
    self.kind = kind
    self.barcode = barcode
    self.text = text
    self.imageBase64 = imageBase64
  }

  // 04-07: fixed a wire-contract mismatch discovered while proving scan→save
  // against the real analyze-food Edge Function (never caught before — every
  // prior scan test ran through FixtureApiClient, which decodes its own
  // canned response and never round-trips a request through JSON at all).
  // The server's ScanRequestSchema (strict, `.refine`-gated) requires
  // `imageBase64` for kind photo/label and `textDescription` for kind text —
  // this struct previously sent `imageReference`/`text`, which a live signed-in
  // scan turns into a 400 VALIDATION_ERROR "payload must match kind" every
  // time. Swift property names are unchanged; only the wire keys move.
  private enum CodingKeys: String, CodingKey {
    case scanId, kind, barcode
    case text = "textDescription"
    case imageBase64
  }
}
