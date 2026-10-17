import Foundation
import GRDB

public struct WaterLog: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "water_logs"

  public let id: UUID
  public let userId: UUID
  public var day: String
  public var ml: Int
  public var createdAt: Date

  public init(id: UUID, userId: UUID, day: String, ml: Int, createdAt: Date) {
    self.id = id
    self.userId = userId
    self.day = day
    self.ml = ml
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", day, ml, createdAt = "created_at"
  }
}

public struct WeightLog: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "weight_logs"

  public let id: UUID
  public let userId: UUID
  public var day: String
  public var kg: Double
  public var createdAt: Date

  public init(id: UUID, userId: UUID, day: String, kg: Double, createdAt: Date) {
    self.id = id
    self.userId = userId
    self.day = day
    self.kg = kg
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", day, kg, createdAt = "created_at"
  }
}

public struct ExerciseLog: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "exercise_logs"

  public let id: UUID
  public let userId: UUID
  public var day: String
  public var exerciseType: String
  public var durationMin: Int
  public var kcalBurned: Int?
  public var createdAt: Date

  public init(
    id: UUID,
    userId: UUID,
    day: String,
    exerciseType: String,
    durationMin: Int,
    kcalBurned: Int?,
    createdAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.day = day
    self.exerciseType = exerciseType
    self.durationMin = durationMin
    self.kcalBurned = kcalBurned
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", day
    case exerciseType = "exercise_type", durationMin = "duration_min"
    case kcalBurned = "kcal_burned", createdAt = "created_at"
  }
}
