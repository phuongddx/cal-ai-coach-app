import Foundation
import GRDB

public struct OutboxStatus: Codable, Equatable, Sendable {
  public let pendingCount: Int
  public let oldestCreatedAt: Date?

  public init(pendingCount: Int, oldestCreatedAt: Date?) {
    self.pendingCount = pendingCount
    self.oldestCreatedAt = oldestCreatedAt
  }
}

public struct OutboxRepository: Sendable {
  public static let batchSize = 50

  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func dueOps(limit: Int) async throws -> [PendingOp] {
    try await database.read { database in
      try PendingOp.fetchAll(
        database,
        sql: """
          SELECT * FROM pending_ops
          WHERE next_retry_at IS NULL OR next_retry_at <= ?
          ORDER BY created_at ASC, op_id ASC
          LIMIT ?
          """,
        arguments: [Date(), min(limit, Self.batchSize)]
      )
    }
  }

  public func markDispatched(opIds: [UUID]) async throws {
    guard !opIds.isEmpty else { return }
    let placeholders = opIds.map { _ in "?" }.joined(separator: ",")
    try await database.write { database in
      try database.execute(
        sql: "DELETE FROM pending_ops WHERE op_id IN (\(placeholders))",
        arguments: StatementArguments(opIds)
      )
    }
  }

  public func markFailed(opIds: [UUID], retryAt: Date) async throws {
    guard !opIds.isEmpty else { return }
    let placeholders = opIds.map { _ in "?" }.joined(separator: ",")
    try await database.write { database in
      try database.execute(
        sql: """
          UPDATE pending_ops
          SET dispatch_attempts = dispatch_attempts + 1,
              next_retry_at = ?
          WHERE op_id IN (\(placeholders))
          """,
        arguments: StatementArguments([retryAt] + opIds)
      )
    }
  }

  public func statusSnapshot() async throws -> OutboxStatus {
    try await database.read { database in
      let row = try Row.fetchOne(
        database,
        sql: """
          SELECT COUNT(*) AS pending_count, MIN(created_at) AS oldest_created_at
          FROM pending_ops
          """
      )
      return OutboxStatus(
        pendingCount: row?["pending_count"] ?? 0,
        oldestCreatedAt: row?["oldest_created_at"]
      )
    }
  }
}
