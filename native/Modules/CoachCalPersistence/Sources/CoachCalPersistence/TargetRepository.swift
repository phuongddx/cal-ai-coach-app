import Foundation
import GRDB

public struct TargetRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func activeTarget(user: UUID) async throws -> UserTarget? {
    try await database.read { database in
      try UserTarget
        .filter(Column("user_id") == user)
        .order(Column("updated_at").desc)
        .fetchOne(database)
    }
  }

  public func saveTarget(_ target: UserTarget) async throws {
    try await database.write { database in
      try target.upsert(database)
    }
  }
}
