import Foundation
import GRDB

public struct StreakState: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "streak_state"

  public let id: Int
  public var currentStreak: Int
  public var bestStreak: Int
  public var freezesLeft: Int
  public var freezeUsedOn: String?
  public var lastLoggedDay: String?

  public init(
    id: Int,
    currentStreak: Int,
    bestStreak: Int,
    freezesLeft: Int,
    freezeUsedOn: String?,
    lastLoggedDay: String?
  ) {
    self.id = id
    self.currentStreak = currentStreak
    self.bestStreak = bestStreak
    self.freezesLeft = freezesLeft
    self.freezeUsedOn = freezeUsedOn
    self.lastLoggedDay = lastLoggedDay
  }

  private enum CodingKeys: String, CodingKey {
    case id
    case currentStreak = "current_streak", bestStreak = "best_streak"
    case freezesLeft = "freezes_left", freezeUsedOn = "freeze_used_on"
    case lastLoggedDay = "last_logged_day"
  }
}

public struct Badge: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "badges"

  public let id: UUID
  public let userId: UUID
  public var code: String
  public var label: String
  public var detail: String?
  public var earnedAt: Date?
  public var progress: Int
  public var target: Int

  public init(
    id: UUID,
    userId: UUID,
    code: String,
    label: String,
    detail: String?,
    earnedAt: Date?,
    progress: Int,
    target: Int
  ) {
    self.id = id
    self.userId = userId
    self.code = code
    self.label = label
    self.detail = detail
    self.earnedAt = earnedAt
    self.progress = progress
    self.target = target
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", code, label, detail
    case earnedAt = "earned_at", progress, target
  }
}

public struct Insight: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "insights"

  public let id: UUID
  public let userId: UUID
  public var day: String
  public var kind: String
  public var title: String
  public var body: String
  public var createdAt: Date

  public init(
    id: UUID,
    userId: UUID,
    day: String,
    kind: String,
    title: String,
    body: String,
    createdAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.day = day
    self.kind = kind
    self.title = title
    self.body = body
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", day, kind, title, body, createdAt = "created_at"
  }
}

public struct AppSettings: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "app_settings"

  public var key: String
  public var value: String

  public init(key: String, value: String) {
    self.key = key
    self.value = value
  }

  private enum CodingKeys: String, CodingKey {
    case key, value
  }
}
