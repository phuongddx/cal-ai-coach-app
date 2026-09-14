import CoachCalPersistence
import Foundation
import GRDB

@MainActor
final class PersistenceBootstrap {
  static let shared = PersistenceBootstrap()

  let database: DatabasePool

  private init() {
    #if DEBUG
    if ProcessInfo.processInfo.arguments.contains("--ccFreshStart") {
      Self.removeDatabaseFiles()
    }
    #endif
    do {
      database = try Database.makePool(at: Self.defaultDatabasePath)
      try Migrations.foundationSync.migrate(database)
    } catch {
      fatalError("CoachCal persistence could not be initialized: \(error)")
    }
  }

  private static func removeDatabaseFiles() {
    let path = defaultDatabasePath
    for suffix in ["", "-wal", "-shm"] {
      try? FileManager.default.removeItem(atPath: path + suffix)
    }
  }

  private static var defaultDatabasePath: String {
    let applicationSupport = URL.applicationSupportDirectory
    let directory = applicationSupport.appending(
      component: Bundle.main.bundleIdentifier ?? "CoachCal",
      directoryHint: .isDirectory
    )
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
  }
}
