import Foundation
import GRDB

public struct PendingOp: Codable, Equatable, FetchableRecord, PersistableRecord, Sendable {
  public static let databaseTableName = "pending_ops"

  public let opId: UUID
  public let tableName: String
  public let recordId: UUID
  public let kind: String
  public let snapshot: String
  public let clientTimestamp: Date
  public let createdAt: Date
  public var dispatchAttempts: Int
  public var nextRetryAt: Date?

  public init(
    opId: UUID,
    tableName: String,
    recordId: UUID,
    kind: String,
    snapshot: String,
    clientTimestamp: Date,
    createdAt: Date,
    dispatchAttempts: Int = 0,
    nextRetryAt: Date? = nil
  ) {
    self.opId = opId
    self.tableName = tableName
    self.recordId = recordId
    self.kind = kind
    self.snapshot = snapshot
    self.clientTimestamp = clientTimestamp
    self.createdAt = createdAt
    self.dispatchAttempts = dispatchAttempts
    self.nextRetryAt = nextRetryAt
  }

  private enum CodingKeys: String, CodingKey {
    case opId = "op_id", tableName = "table_name", recordId = "record_id", kind
    case snapshot
    case clientTimestamp = "client_timestamp", createdAt = "created_at"
    case dispatchAttempts = "dispatch_attempts", nextRetryAt = "next_retry_at"
  }
}
