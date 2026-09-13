import Foundation

public enum ProofScenario: String, Sendable, CaseIterable {
  case online
  case offlineReconnect = "offline-reconnect"
  case replayIdempotency = "replay-idempotency"
  case crossUserDenial = "user-b-denial"
  case sameOwnerConvergence = "same-owner-convergence"
}

public enum ProofCheckStatus: String, Sendable {
  case pass
  case fail
}

public struct ProofEnvironment: Equatable, Sendable {
  public let stack: String
  public let runtime: String

  public init(stack: String, runtime: String) {
    self.stack = stack
    self.runtime = runtime
  }
}

public struct ProofCheck: Equatable, Sendable {
  public let name: String
  public let status: ProofCheckStatus
  public let timingMs: Int
  public let dispatchId: UUID?

  public init(
    name: String,
    status: ProofCheckStatus,
    timingMs: Int,
    dispatchId: UUID? = nil
  ) {
    self.name = name
    self.status = status
    self.timingMs = timingMs
    self.dispatchId = dispatchId
  }
}

public enum ProofValue: Equatable, Sendable {
  case string(String)
  case int(Int)
  case double(Double)
  case bool(Bool)
  case uuid(UUID)
  case date(Date)
  case array([ProofValue])
  case dictionary([String: ProofValue])
}

public struct ProofRecord: Sendable {
  public let scenario: ProofScenario
  public let runId: UUID
  public let rowId: UUID?
  public let startedAt: Date
  public let environment: ProofEnvironment
  public let checks: [ProofCheck]
  public var evidence: [String: ProofValue]

  public init(
    scenario: ProofScenario,
    runId: UUID,
    rowId: UUID? = nil,
    startedAt: Date,
    environment: ProofEnvironment,
    checks: [ProofCheck],
    evidence: [String: ProofValue] = [:]
  ) {
    self.scenario = scenario
    self.runId = runId
    self.rowId = rowId
    self.startedAt = startedAt
    self.environment = environment
    self.checks = checks
    self.evidence = evidence
  }
}

public struct ProofRedactionError: Error, Equatable {
  public let reason: String
}

/// Produces deterministic schema-v1 evidence and refuses to emit secrets.
///
/// Redaction is fail-closed: sensitive keys and legacy proof identities throw
/// before serialization instead of being stripped.
public enum ProofRecordSerializer {
  public static let schemaVersion = 1

  private static let sensitiveKeyPattern = try! NSRegularExpression(
    pattern: #"(?i)(password|secret|token|apikey|authorization)"#
  )
  private static let legacyIdentityValues = [
    ["a", "@proof.", "local"].joined(),
    ["b", "@proof.", "local"].joined(),
    ["phase1-proof-", "2026"].joined(),
  ]

  public static func data(for record: ProofRecord) throws -> Data {
    let payload = try jsonObject(for: record)
    guard JSONSerialization.isValidJSONObject(payload) else {
      throw ProofRedactionError(reason: "proof payload is not valid JSON")
    }

    return try JSONSerialization.data(
      withJSONObject: payload,
      options: [.sortedKeys, .withoutEscapingSlashes]
    )
  }

  public static func string(for record: ProofRecord) throws -> String {
    let data = try data(for: record)
    return String(decoding: data, as: UTF8.self)
  }

  private static func jsonObject(for record: ProofRecord) throws -> [String: Any] {
    var payload: [String: ProofValue] = record.evidence
    payload["schemaVersion"] = .int(schemaVersion)
    payload["scenario"] = .string(record.scenario.rawValue)
    payload["runId"] = .uuid(record.runId)
    if let rowId = record.rowId {
      payload["rowId"] = .uuid(rowId)
    }
    payload["startedAt"] = .date(record.startedAt)
    payload["environment"] = .dictionary([
      "stack": .string(record.environment.stack),
      "runtime": .string(record.environment.runtime),
    ])
    payload["checks"] = .array(record.checks.map { check in
      var value: [String: ProofValue] = [
        "name": .string(check.name),
        "status": .string(check.status.rawValue),
        "timingMs": .int(check.timingMs),
      ]
      if let dispatchId = check.dispatchId {
        value["dispatchId"] = .uuid(dispatchId)
      }
      return .dictionary(value)
    })

    let decoded = try payloadValue(.dictionary(payload))
    guard let object = decoded as? [String: Any] else {
      throw ProofRedactionError(reason: "proof payload is not an object")
    }
    try scan(decoded, path: "$")
    return object
  }

  private static func payloadValue(_ value: ProofValue) throws -> Any {
    switch value {
    case .string(let string): return string
    case .int(let integer): return integer
    case .double(let double): return double
    case .bool(let boolean): return boolean
    case .uuid(let uuid): return uuid.uuidString
    case .date(let date):
      return ISO8601DateFormatter.string(
        from: date,
        timeZone: .current,
        formatOptions: [.withInternetDateTime]
      )
    case .array(let values):
      return try values.map(payloadValue)
    case .dictionary(let values):
      return try values.mapValues(payloadValue)
    }
  }

  private static func scan(_ value: Any, path: String) throws {
    if let object = value as? [String: Any] {
      for (key, child) in object {
        let childPath = "\(path).\(key)"
        let range = NSRange(key.startIndex..., in: key)
        if sensitiveKeyPattern.firstMatch(in: key, range: range) != nil {
          throw ProofRedactionError(reason: "sensitive key at \(childPath)")
        }
        try scan(child, path: childPath)
      }
    } else if let array = value as? [Any] {
      for (index, child) in array.enumerated() {
        try scan(child, path: "\(path)[\(index)]")
      }
    } else if let string = value as? String {
      let normalized = string.lowercased()
      if legacyIdentityValues.contains(where: normalized.contains) {
        throw ProofRedactionError(reason: "forbidden proof identity at \(path)")
      }
    }
  }
}
