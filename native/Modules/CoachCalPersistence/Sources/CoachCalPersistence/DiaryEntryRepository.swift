import Foundation
import GRDB

public struct DiaryEntryRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func recordUpsert(_ entry: DiaryEntry, now: Date = Date()) async throws -> PendingOp {
    try await recordUpsert(entry, now: now) { _ in }
  }

  public func recordTombstone(_ entry: DiaryEntry, now: Date = Date()) async throws -> PendingOp {
    try await recordTombstone(entry, now: now) { _ in }
  }

  func recordUpsert(
    _ entry: DiaryEntry,
    now: Date,
    transactionHook: @Sendable @escaping (GRDB.Database) throws -> Void
  ) async throws -> PendingOp {
    try await makeOperation(entry: entry, kind: "upsert", now: now) { database in
      try entry.upsert(database)
      try transactionHook(database)
    }
  }

  func recordTombstone(
    _ entry: DiaryEntry,
    now: Date,
    transactionHook: @Sendable @escaping (GRDB.Database) throws -> Void
  ) async throws -> PendingOp {
    let tombstoned = DiaryEntry(
      id: entry.id,
      userId: entry.userId,
      displayText: entry.displayText,
      createdAt: entry.createdAt,
      updatedAt: now,
      deletedAt: entry.deletedAt ?? now,
      serverVersion: entry.serverVersion,
      acceptedOpId: entry.acceptedOpId,
      serverUpdatedAt: entry.serverUpdatedAt
    )

    return try await makeOperation(entry: tombstoned, kind: "tombstone", now: now) { database in
      try tombstoned.upsert(database)
      try transactionHook(database)
    }
  }

  private func makeOperation(
    entry: DiaryEntry,
    kind: String,
    now: Date,
    write: @Sendable @escaping (GRDB.Database) throws -> Void
  ) async throws -> PendingOp {
    let operation = PendingOp(
      opId: UUID(),
      tableName: "diary_entries",
      recordId: entry.id,
      kind: kind,
      snapshot: Self.snapshot(for: entry),
      clientTimestamp: now,
      createdAt: now
    )

    return try await database.write { database in
      try write(database)
      try operation.insert(database)
      return operation
    }
  }

  private static func snapshot(for entry: DiaryEntry) -> String {
    struct Snapshot: Encodable {
      let id: UUID
      let displayText: String
      let deletedAt: Date?
      let serverVersion: Int64
      let acceptedOpId: UUID?

      func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(displayText, forKey: .displayText)
        try container.encode(deletedAt, forKey: .deletedAt)
        try container.encode(serverVersion, forKey: .serverVersion)
        try container.encode(acceptedOpId, forKey: .acceptedOpId)
      }

      private enum CodingKeys: String, CodingKey {
        case id, displayText, deletedAt, serverVersion, acceptedOpId
      }
    }

    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601

    let payload = Snapshot(
      id: entry.id,
      displayText: entry.displayText,
      deletedAt: entry.deletedAt,
      serverVersion: entry.serverVersion,
      acceptedOpId: entry.acceptedOpId
    )
    let data = try! encoder.encode(payload)
    return String(decoding: data, as: UTF8.self)
  }
}
