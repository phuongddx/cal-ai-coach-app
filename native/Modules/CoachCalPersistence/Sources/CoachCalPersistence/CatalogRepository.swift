import Foundation
import GRDB

public struct CatalogRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func searchFoods(query: String, limit: Int = 25) async throws -> [Food] {
    try await database.read { database in
      let pattern = "%\(Self.escapedLikePattern(query))%"
      return try Food.fetchAll(
        database,
        sql: "SELECT * FROM foods WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?",
        arguments: [pattern, limit]
      )
    }
  }

  public func recentFoods(limit: Int) async throws -> [Food] {
    try await database.read { database in
      try Food.order(Column("created_at").desc).limit(limit).fetchAll(database)
    }
  }

  public func savedMeals() async throws -> [SavedMeal] {
    try await database.read { database in
      try SavedMeal.order(Column("created_at").desc).fetchAll(database)
    }
  }

  public func saveMeal(_ meal: SavedMeal) async throws {
    try await database.write { database in
      try meal.upsert(database)
    }
  }

  public func deleteSavedMeal(id: UUID) async throws {
    try await database.write { database in
      _ = try SavedMeal.deleteOne(database, key: id)
    }
  }

  public func customFoods() async throws -> [CustomFood] {
    try await database.read { database in
      try CustomFood.order(Column("created_at").desc).fetchAll(database)
    }
  }

  public func saveCustomFood(_ food: CustomFood) async throws {
    try await database.write { database in
      try food.upsert(database)
    }
  }

  private static func escapedLikePattern(_ query: String) -> String {
    query
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "%", with: "\\%")
      .replacingOccurrences(of: "_", with: "\\_")
  }
}
