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

  public let kind: Kind
  public let barcode: String?
  public let text: String?
  public let imageBase64: String?

  public init(
    kind: Kind,
    barcode: String? = nil,
    text: String? = nil,
    imageBase64: String? = nil
  ) {
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
    case kind, barcode
    case text = "textDescription"
    case imageBase64
  }
}
