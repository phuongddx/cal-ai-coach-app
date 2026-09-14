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
  public let imageReference: String?

  public init(
    kind: Kind,
    barcode: String? = nil,
    text: String? = nil,
    imageReference: String? = nil
  ) {
    self.kind = kind
    self.barcode = barcode
    self.text = text
    self.imageReference = imageReference
  }

  private enum CodingKeys: String, CodingKey {
    case kind, barcode, text
    case imageReference = "imageReference"
  }
}
