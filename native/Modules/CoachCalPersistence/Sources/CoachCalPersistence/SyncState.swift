import GRDB

public struct SyncState: Codable, Equatable, FetchableRecord, PersistableRecord, Sendable {
  public static let databaseTableName = "sync_state"

  public let id: Int
  public var pullCursor: Int64

  public init(id: Int = 1, pullCursor: Int64 = 0) {
    self.id = id
    self.pullCursor = pullCursor
  }

  private enum CodingKeys: String, CodingKey {
    case id
    case pullCursor = "pull_cursor"
  }
}
