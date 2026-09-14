import Foundation
import GRDB

public struct DiaryDetailRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func detail(forEntryId entryId: UUID) async throws -> DiaryEntryDetail? {
    try await database.read { database in
      try DiaryEntryDetail.fetchOne(database, key: entryId)
    }
  }

  public func details(forDay day: String, mealSlot: String) async throws -> [DiaryEntryDetail] {
    try await database.read { database in
      try DiaryEntryDetail.fetchAll(
        database,
        sql: """
          SELECT d.* FROM diary_entry_details d
          JOIN diary_entries e ON e.id = d.entry_id
          WHERE e.deleted_at IS NULL AND date(e.created_at) = ? AND d.meal_slot = ?
          ORDER BY e.created_at
          """,
        arguments: [day, mealSlot]
      )
    }
  }

  public func upsert(_ detail: DiaryEntryDetail) async throws {
    try await database.write { database in
      try detail.upsert(database)
    }
  }

  public func delete(entryId: UUID) async throws {
    try await database.write { database in
      _ = try DiaryEntryDetail.deleteOne(database, key: entryId)
    }
  }
}
