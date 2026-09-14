import Foundation
import GRDB

public struct TrackingRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func water(forDay day: String) async throws -> Int {
    try await database.read { database in
      try Int.fetchOne(
        database,
        sql: "SELECT COALESCE(SUM(ml), 0) FROM water_logs WHERE day = ?",
        arguments: [day]
      ) ?? 0
    }
  }

  public func addWater(ml: Int, day: String, userId: UUID, at date: Date = Date()) async throws {
    let log = WaterLog(id: UUID(), userId: userId, day: day, ml: ml, createdAt: date)
    try await database.write { database in
      try log.insert(database)
    }
  }

  public func weights(limit: Int) async throws -> [WeightLog] {
    try await database.read { database in
      let recent = try WeightLog
        .order(Column("day").desc, Column("created_at").desc)
        .limit(limit)
        .fetchAll(database)
      return recent.reversed()
    }
  }

  public func addWeight(_ log: WeightLog) async throws {
    try await database.write { database in
      try log.insert(database)
    }
  }

  public func exercises(forDay day: String) async throws -> [ExerciseLog] {
    try await database.read { database in
      try ExerciseLog
        .filter(Column("day") == day)
        .order(Column("created_at"))
        .fetchAll(database)
    }
  }

  public func addExercise(_ log: ExerciseLog) async throws {
    try await database.write { database in
      try log.insert(database)
    }
  }
}
