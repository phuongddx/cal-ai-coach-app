import XCTest

@testable import CoachCal

nonisolated final class AppLaunchMigrationTests: XCTestCase {
  @MainActor
  func testLaunchBootstrapsMigratedDatabase() async throws {
    let database = PersistenceBootstrap.shared.database

    let migrated = try await database.read { database in
      let migrationCount = try Int.fetchOne(
        database,
        sql: """
          SELECT COUNT(*) FROM grdb_migrations
          WHERE identifier = '1__foundation_sync'
          """
      )
      _ = try Int.fetchOne(database, sql: "SELECT COUNT(*) FROM diary_entries")
      return migrationCount
    }

    XCTAssertEqual(migrated, 1)
  }
}
