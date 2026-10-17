import Foundation
import GRDB

public struct DiaryEntry: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "diary_entries"

  public let id: UUID
  public let userId: UUID
  public var displayText: String
  public let createdAt: Date
  public var updatedAt: Date
  public var deletedAt: Date?
  public var serverVersion: Int64
  public var acceptedOpId: UUID?
  public var serverUpdatedAt: Date

  public init(
    id: UUID,
    userId: UUID,
    displayText: String,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date?,
    serverVersion: Int64,
    acceptedOpId: UUID?,
    serverUpdatedAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.displayText = displayText
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.deletedAt = deletedAt
    self.serverVersion = serverVersion
    self.acceptedOpId = acceptedOpId
    self.serverUpdatedAt = serverUpdatedAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", displayText = "display_text", createdAt = "created_at"
    case updatedAt = "updated_at", deletedAt = "deleted_at"
    case serverVersion = "server_version", acceptedOpId = "accepted_op_id"
    case serverUpdatedAt = "server_updated_at"
  }
}
