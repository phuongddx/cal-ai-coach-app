import Foundation

public struct ScanResponse: Decodable, Equatable, Sendable {
  public let scanId: UUID
  public let kind: ScanRequest.Kind
  public let items: [ScanItem]
  public let mealKcal: Int
  public let scanConfidence: Double
  public let note: String?

  public init(
    scanId: UUID,
    kind: ScanRequest.Kind,
    items: [ScanItem],
    mealKcal: Int,
    scanConfidence: Double,
    note: String?
  ) {
    self.scanId = scanId
    self.kind = kind
    self.items = items
    self.mealKcal = mealKcal
    self.scanConfidence = scanConfidence
    self.note = note
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try StrictJSON.rejectUnknownKeys(
      container,
      allowed: ["scanId", "kind", "items", "mealKcal", "scanConfidence", "note"]
    )
    scanId = try container.decode(UUID.self, forKey: AnyCodingKey("scanId"))
    kind = try container.decode(
      ScanRequest.Kind.self,
      forKey: AnyCodingKey("kind")
    )
    items = try container.decode([ScanItem].self, forKey: AnyCodingKey("items"))
    mealKcal = try container.decode(Int.self, forKey: AnyCodingKey("mealKcal"))
    scanConfidence = try container.decode(Double.self, forKey: AnyCodingKey("scanConfidence"))
    note = try container.decodeIfPresent(String.self, forKey: AnyCodingKey("note"))
  }
}

public struct ScanItem: Decodable, Equatable, Sendable {
  public let label: String
  public let grams: Int
  public let gramsBasis: String
  public let confidence: Double
  public let hiddenFatLikely: Bool
  public let source: String
  public let per100g: Per100g
  public let kcal: Int
  public let proteinG: Double
  public let carbsG: Double
  public let fatG: Double
  public let fiberG: Double
  public let unresolved: Bool

  public init(
    label: String,
    grams: Int,
    gramsBasis: String,
    confidence: Double,
    hiddenFatLikely: Bool,
    source: String,
    per100g: Per100g,
    kcal: Int,
    proteinG: Double,
    carbsG: Double,
    fatG: Double,
    fiberG: Double,
    unresolved: Bool
  ) {
    self.label = label
    self.grams = grams
    self.gramsBasis = gramsBasis
    self.confidence = confidence
    self.hiddenFatLikely = hiddenFatLikely
    self.source = source
    self.per100g = per100g
    self.kcal = kcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberG = fiberG
    self.unresolved = unresolved
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try StrictJSON.rejectUnknownKeys(
      container,
      allowed: [
        "label", "grams", "gramsBasis", "confidence", "hiddenFatLikely", "source",
        "per100g", "kcal", "proteinG", "carbsG", "fatG", "fiberG", "unresolved",
      ]
    )
    label = try container.decode(String.self, forKey: AnyCodingKey("label"))
    grams = try container.decode(Int.self, forKey: AnyCodingKey("grams"))
    gramsBasis = try container.decode(String.self, forKey: AnyCodingKey("gramsBasis"))
    confidence = try container.decode(Double.self, forKey: AnyCodingKey("confidence"))
    hiddenFatLikely = try container.decode(Bool.self, forKey: AnyCodingKey("hiddenFatLikely"))
    source = try container.decode(String.self, forKey: AnyCodingKey("source"))
    per100g = try container.decode(Per100g.self, forKey: AnyCodingKey("per100g"))
    kcal = try container.decode(Int.self, forKey: AnyCodingKey("kcal"))
    proteinG = try container.decode(Double.self, forKey: AnyCodingKey("proteinG"))
    carbsG = try container.decode(Double.self, forKey: AnyCodingKey("carbsG"))
    fatG = try container.decode(Double.self, forKey: AnyCodingKey("fatG"))
    fiberG = try container.decode(Double.self, forKey: AnyCodingKey("fiberG"))
    unresolved = try container.decode(Bool.self, forKey: AnyCodingKey("unresolved"))
  }
}

public struct Per100g: Decodable, Equatable, Sendable {
  public let kcal: Int
  public let proteinG: Double
  public let carbsG: Double
  public let fatG: Double
  public let fiberG: Double

  public init(kcal: Int, proteinG: Double, carbsG: Double, fatG: Double, fiberG: Double) {
    self.kcal = kcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberG = fiberG
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try StrictJSON.rejectUnknownKeys(
      container,
      allowed: ["kcal", "proteinG", "carbsG", "fatG", "fiberG"]
    )
    kcal = try container.decode(Int.self, forKey: AnyCodingKey("kcal"))
    proteinG = try container.decode(Double.self, forKey: AnyCodingKey("proteinG"))
    carbsG = try container.decode(Double.self, forKey: AnyCodingKey("carbsG"))
    fatG = try container.decode(Double.self, forKey: AnyCodingKey("fatG"))
    fiberG = try container.decode(Double.self, forKey: AnyCodingKey("fiberG"))
  }
}

public struct EntitlementState: Decodable, Equatable, Sendable {
  public let tier: String
  public let scansUsed: Int
  public let scanLimit: Int
  public let windowResetAt: Date

  public init(tier: String, scansUsed: Int, scanLimit: Int, windowResetAt: Date) {
    self.tier = tier
    self.scansUsed = scansUsed
    self.scanLimit = scanLimit
    self.windowResetAt = windowResetAt
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try StrictJSON.rejectUnknownKeys(
      container,
      allowed: ["tier", "scansUsed", "scanLimit", "windowResetAt"]
    )
    tier = try container.decode(String.self, forKey: AnyCodingKey("tier"))
    scansUsed = try container.decode(Int.self, forKey: AnyCodingKey("scansUsed"))
    scanLimit = try container.decode(Int.self, forKey: AnyCodingKey("scanLimit"))
    let rawReset = try container.decode(String.self, forKey: AnyCodingKey("windowResetAt"))
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    guard let parsed = formatter.date(from: rawReset) else {
      throw DecodingError.dataCorrupted(.init(
        codingPath: container.codingPath,
        debugDescription: "Invalid ISO-8601 windowResetAt: \(rawReset)"
      ))
    }
    windowResetAt = parsed
  }
}

struct FixtureErrorEnvelope: Decodable, Equatable, Sendable {
  struct Body: Decodable, Equatable, Sendable {
    let code: String
    let details: [String]?
    let entitlement: EntitlementState?

    init(code: String, details: [String]?, entitlement: EntitlementState?) {
      self.code = code
      self.details = details
      self.entitlement = entitlement
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: AnyCodingKey.self)
      try StrictJSON.rejectUnknownKeys(
        container,
        allowed: ["code", "details", "entitlement"]
      )
      code = try container.decode(String.self, forKey: AnyCodingKey("code"))
      details = try container.decodeIfPresent(
        [String].self,
        forKey: AnyCodingKey("details")
      )
      entitlement = try container.decodeIfPresent(
        EntitlementState.self,
        forKey: AnyCodingKey("entitlement")
      )
    }
  }

  let error: Body

  init(error: Body) {
    self.error = error
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try StrictJSON.rejectUnknownKeys(container, allowed: ["error"])
    error = try container.decode(Body.self, forKey: AnyCodingKey("error"))
  }
}

private struct AnyCodingKey: CodingKey {
  let stringValue: String
  let intValue: Int?

  init(_ stringValue: String) {
    self.stringValue = stringValue
    self.intValue = nil
  }

  init?(stringValue: String) {
    self.stringValue = stringValue
    self.intValue = nil
  }

  init?(intValue: Int) {
    return nil
  }
}

private enum StrictJSON {
  static func rejectUnknownKeys<Key: CodingKey>(
    _ container: KeyedDecodingContainer<Key>,
    allowed: Set<String>
  ) throws {
    let unknown = Set(container.allKeys.map(\.stringValue)).subtracting(allowed)
    guard unknown.isEmpty else {
      throw DecodingError.dataCorrupted(.init(
        codingPath: container.codingPath,
        debugDescription: "Unknown keys: \(unknown.sorted().joined(separator: ", "))"
      ))
    }
  }
}
