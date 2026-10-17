import Foundation
import GRDB

public struct EngagementRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func streakState() async throws -> StreakState? {
    try await database.read { database in
      try StreakState.fetchOne(database)
    }
  }

  public func saveStreakState(_ state: StreakState) async throws {
    try await database.write { database in
      try state.upsert(database)
    }
  }

  public func badges() async throws -> [Badge] {
    try await database.read { database in
      try Badge.order(Column("code")).fetchAll(database)
    }
  }

  public func awardBadge(_ badge: Badge) async throws {
    try await database.write { database in
      try badge.insert(database)
    }
  }

  public func insights(forDay day: String) async throws -> [Insight] {
    try await database.read { database in
      try Insight
        .filter(Column("day") == day)
        .order(Column("created_at").desc)
        .fetchAll(database)
    }
  }
}
