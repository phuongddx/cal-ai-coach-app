import Foundation

public enum SyncedTable: String, Codable, Equatable, Sendable {
  case diaryEntries = "diary_entries"
}

public enum MutationKind: String, Codable, Equatable, Sendable {
  case upsert
  case tombstone
}

public struct DiaryEntrySnapshot: Codable, Equatable, Sendable {
  public let id: UUID
  public let displayText: String
  public let deletedAt: Date?
  public let serverVersion: Int
  public let acceptedOpId: UUID?

  public init(
    id: UUID,
    displayText: String,
    deletedAt: Date?,
    serverVersion: Int,
    acceptedOpId: UUID?
  ) {
    self.id = id
    self.displayText = displayText
    self.deletedAt = deletedAt
    self.serverVersion = serverVersion
    self.acceptedOpId = acceptedOpId
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(
      container,
      allowed: ["id", "displayText", "deletedAt", "serverVersion", "acceptedOpId"]
    )
    id = try container.decode(UUID.self, forKey: AnyCodingKey("id"))
    displayText = try container.decode(String.self, forKey: AnyCodingKey("displayText"))
    deletedAt = try SyncEnvelopeDecoder.optionalDate(container, forKey: AnyCodingKey("deletedAt"))
    serverVersion = try container.decode(Int.self, forKey: AnyCodingKey("serverVersion"))
    acceptedOpId = try SyncEnvelopeDecoder.optionalUUID(container, forKey: AnyCodingKey("acceptedOpId"))
    guard serverVersion >= 0 else {
      throw SyncEnvelopeDecoder.negative("serverVersion", container)
    }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: AnyCodingKey.self)
    try container.encode(id, forKey: AnyCodingKey("id"))
    try container.encode(displayText, forKey: AnyCodingKey("displayText"))
    try container.encode(deletedAt, forKey: AnyCodingKey("deletedAt"))
    try container.encode(serverVersion, forKey: AnyCodingKey("serverVersion"))
    try container.encode(acceptedOpId, forKey: AnyCodingKey("acceptedOpId"))
  }

}

public struct SyncOperation: Codable, Equatable, Sendable {
  public let opId: UUID
  public let table: SyncedTable
  public let recordId: UUID
  public let kind: MutationKind
  public let snapshot: DiaryEntrySnapshot
  public let clientTimestamp: Date

  public init(
    opId: UUID,
    table: SyncedTable,
    recordId: UUID,
    kind: MutationKind,
    snapshot: DiaryEntrySnapshot,
    clientTimestamp: Date
  ) {
    self.opId = opId
    self.table = table
    self.recordId = recordId
    self.kind = kind
    self.snapshot = snapshot
    self.clientTimestamp = clientTimestamp
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(
      container,
      allowed: [
        "opId", "table", "recordId", "kind", "snapshot", "clientTimestamp",
      ]
    )
    opId = try container.decode(UUID.self, forKey: AnyCodingKey("opId"))
    table = try container.decode(SyncedTable.self, forKey: AnyCodingKey("table"))
    recordId = try container.decode(UUID.self, forKey: AnyCodingKey("recordId"))
    kind = try container.decode(MutationKind.self, forKey: AnyCodingKey("kind"))
    snapshot = try container.decode(DiaryEntrySnapshot.self, forKey: AnyCodingKey("snapshot"))
    clientTimestamp = try SyncEnvelopeDecoder.date(container, forKey: AnyCodingKey("clientTimestamp"))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: AnyCodingKey.self)
    try container.encode(opId, forKey: AnyCodingKey("opId"))
    try container.encode(table, forKey: AnyCodingKey("table"))
    try container.encode(recordId, forKey: AnyCodingKey("recordId"))
    try container.encode(kind, forKey: AnyCodingKey("kind"))
    try container.encode(snapshot, forKey: AnyCodingKey("snapshot"))
    try container.encode(
      SyncEnvelopeDecoder.string(from: clientTimestamp),
      forKey: AnyCodingKey("clientTimestamp")
    )
  }

}

public struct CanonicalRowVersion: Codable, Equatable, Sendable {
  public let serverVersion: Int
  public let acceptedOpId: UUID

  public init(serverVersion: Int, acceptedOpId: UUID) {
    self.serverVersion = serverVersion
    self.acceptedOpId = acceptedOpId
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(container, allowed: ["serverVersion", "acceptedOpId"])
    serverVersion = try container.decode(Int.self, forKey: AnyCodingKey("serverVersion"))
    acceptedOpId = try container.decode(UUID.self, forKey: AnyCodingKey("acceptedOpId"))
    guard serverVersion >= 0 else {
      throw SyncEnvelopeDecoder.negative("serverVersion", container)
    }
  }

}

public struct PushRequest: Codable, Equatable, Sendable {
  public let operations: [SyncOperation]

  public init(operations: [SyncOperation]) throws {
    guard !operations.isEmpty else {
      throw SyncEnvelopeDecoder.error("Push batch must not be empty")
    }
    guard Set(operations.map(\.opId)).count == operations.count else {
      throw SyncEnvelopeDecoder.error("Push batch must not repeat an opId")
    }
    self.operations = operations
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(container, allowed: ["operations"])
    operations = try container.decode([SyncOperation].self, forKey: AnyCodingKey("operations"))
    guard !operations.isEmpty else {
      throw SyncEnvelopeDecoder.error("Push batch must not be empty", container)
    }
    guard Set(operations.map(\.opId)).count == operations.count else {
      throw SyncEnvelopeDecoder.error("Push batch must not repeat an opId", container)
    }
  }

}

public struct PushAcknowledgement: Codable, Equatable, Sendable {
  public let opId: UUID
  public let serverVersion: Int
  public let acceptedOpId: UUID
  public let duplicate: Bool

  public init(
    opId: UUID,
    serverVersion: Int,
    acceptedOpId: UUID,
    duplicate: Bool
  ) {
    self.opId = opId
    self.serverVersion = serverVersion
    self.acceptedOpId = acceptedOpId
    self.duplicate = duplicate
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(
      container,
      allowed: ["opId", "serverVersion", "acceptedOpId", "duplicate"]
    )
    opId = try container.decode(UUID.self, forKey: AnyCodingKey("opId"))
    serverVersion = try container.decode(Int.self, forKey: AnyCodingKey("serverVersion"))
    acceptedOpId = try container.decode(UUID.self, forKey: AnyCodingKey("acceptedOpId"))
    duplicate = try container.decode(Bool.self, forKey: AnyCodingKey("duplicate"))
    guard serverVersion >= 0 else {
      throw SyncEnvelopeDecoder.negative("serverVersion", container)
    }
  }

}

public struct PushResponse: Codable, Equatable, Sendable {
  public let accepted: [PushAcknowledgement]

  public init(accepted: [PushAcknowledgement]) {
    self.accepted = accepted
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(container, allowed: ["accepted"])
    accepted = try container.decode([PushAcknowledgement].self, forKey: AnyCodingKey("accepted"))
  }

  public func validateAcknowledgementSet(against operations: [SyncOperation]) throws {
    let submitted = Set(operations.map(\.opId))
    var acknowledged = Set<UUID>()

    for acknowledgement in accepted {
      guard submitted.contains(acknowledgement.opId) else {
        throw SyncEnvelopeDecoder.error(
          "Push response acknowledges unsent operation \(acknowledgement.opId.uuidString)"
        )
      }
      guard acknowledged.insert(acknowledgement.opId).inserted else {
        throw SyncEnvelopeDecoder.error(
          "Push response acknowledges operation \(acknowledgement.opId.uuidString) more than once"
        )
      }
    }

    guard acknowledged.count == submitted.count else {
      throw SyncEnvelopeDecoder.error(
        """
        Push response acknowledges \(acknowledged.count) of \(submitted.count) \
        submitted operations; refusing a partial acknowledgement set
        """
      )
    }
  }

}

public struct PulledRow: Codable, Equatable, Sendable {
  public let table: SyncedTable
  public let recordId: UUID
  public let snapshot: DiaryEntrySnapshot

  public init(table: SyncedTable, recordId: UUID, snapshot: DiaryEntrySnapshot) {
    self.table = table
    self.recordId = recordId
    self.snapshot = snapshot
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(
      container,
      allowed: ["table", "recordId", "snapshot"]
    )
    table = try container.decode(SyncedTable.self, forKey: AnyCodingKey("table"))
    recordId = try container.decode(UUID.self, forKey: AnyCodingKey("recordId"))
    snapshot = try container.decode(DiaryEntrySnapshot.self, forKey: AnyCodingKey("snapshot"))
  }

}

public struct PullResponse: Codable, Equatable, Sendable {
  public let rows: [PulledRow]
  public let cursor: Int

  public init(rows: [PulledRow], cursor: Int) throws {
    self.rows = rows
    self.cursor = cursor
    try validate()
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: AnyCodingKey.self)
    try SyncEnvelopeDecoder.rejectUnknownKeys(container, allowed: ["rows", "cursor"])
    rows = try container.decode([PulledRow].self, forKey: AnyCodingKey("rows"))
    cursor = try container.decode(Int.self, forKey: AnyCodingKey("cursor"))
    try validate()
  }

  private func validate() throws {
    guard cursor >= 0 else {
      throw SyncEnvelopeDecoder.error("Pull cursor must be non-negative")
    }
    guard rows.allSatisfy({ $0.snapshot.serverVersion <= cursor }) else {
      throw SyncEnvelopeDecoder.error(
        "Pull cursor must be at least the highest delivered serverVersion"
      )
    }
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
    self.init(stringValue)
  }

  init?(intValue: Int) {
    return nil
  }
}

private enum SyncEnvelopeDecoder {
  static func rejectUnknownKeys<Key: CodingKey>(
    _ container: KeyedDecodingContainer<Key>,
    allowed: Set<String>
  ) throws {
    let unknown = Set(container.allKeys.map(\.stringValue)).subtracting(allowed)
    guard unknown.isEmpty else {
      throw error("Unknown sync envelope keys: \(unknown.sorted().joined(separator: ", "))")
    }
  }

  static func optionalUUID<Key: CodingKey>(
    _ container: KeyedDecodingContainer<Key>,
    forKey key: Key
  ) throws -> UUID? {
    guard container.contains(key) else {
      throw keyNotFound(key, container)
    }
    return try container.decodeIfPresent(UUID.self, forKey: key)
  }

  static func optionalDate<Key: CodingKey>(
    _ container: KeyedDecodingContainer<Key>,
    forKey key: Key
  ) throws -> Date? {
    guard container.contains(key) else {
      throw keyNotFound(key, container)
    }
    guard let value = try container.decodeIfPresent(String.self, forKey: key) else {
      return nil
    }
    return try date(value, container)
  }

  static func date<Key: CodingKey>(
    _ container: KeyedDecodingContainer<Key>,
    forKey key: Key
  ) throws -> Date {
    try date(try container.decode(String.self, forKey: key), container)
  }

  static func string(from date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.string(from: date)
  }

  private static func date(_ value: String, _ container: any CodingContainer) throws -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) {
      return date
    }

    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: value) {
      return date
    }

    throw dataCorrupted("Invalid ISO-8601 offset date: \(value)", container)
  }

  private static func keyNotFound<Key: CodingKey>(
    _ key: Key,
    _ container: KeyedDecodingContainer<Key>
  ) -> DecodingError {
    .keyNotFound(key, .init(codingPath: container.codingPath, debugDescription: "Missing \(key)"))
  }

  private static func dataCorrupted(
    _ message: String,
    _ container: any CodingContainer
  ) -> DecodingError {
    .dataCorrupted(.init(codingPath: container.codingPath, debugDescription: message))
  }

  static func error(_ message: String) -> DecodingError {
    .dataCorrupted(.init(codingPath: [], debugDescription: message))
  }

  static func error(
    _ message: String,
    _ container: any CodingContainer
  ) -> DecodingError {
    dataCorrupted(message, container)
  }

  static func negative<Key: CodingKey>(
    _ field: String,
    _ container: KeyedDecodingContainer<Key>
  ) -> DecodingError {
    error("\(field) must be non-negative", container)
  }
}

private protocol CodingContainer {
  var codingPath: [CodingKey] { get }
}

extension KeyedDecodingContainer: CodingContainer {}
