import CoreTransferable
import Foundation
import GRDB
import UniformTypeIdentifiers

/// TRU-03: the complete local data inventory as one CSV, one section per table.
public struct CSVExportService: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  /// Every locally-owned domain table — cross-referenced with Migrations.swift's
  /// "3__domain_core" migration (11 tables + app_settings) plus "1__foundation_sync"'s
  /// diary_entries mirror. Deliberately excludes pending_ops/sync_state: those are
  /// sync-machinery bookkeeping, not the user's own domain data. Update this list
  /// whenever Migrations.swift gains or renames a domain table — drift is caught in
  /// code review, not silently.
  public static let exportedTables = [
    "user_targets", "diary_entry_details", "foods", "saved_meals", "custom_foods",
    "water_logs", "weight_logs", "exercise_logs", "streak_state", "badges", "insights",
    "app_settings", "diary_entries",
  ]

  /// Reads every table above wholesale, matching `performLocalAccountReset`'s own
  /// unfiltered per-table sweep — the on-device database holds one active account's
  /// data at a time, so there is no other user's row to exclude. `userId` documents
  /// the call-site contract for any future multi-account support; no table here is
  /// currently filtered by it.
  public func buildFullExportCSV(userId: UUID) async throws -> Data {
    try await database.read { database in
      var csv = ""
      for table in Self.exportedTables {
        csv += "# \(table)\n"
        let rows = try Row.fetchCursor(database, sql: "SELECT * FROM \(table)")
        var wroteHeader = false
        while let row = try rows.next() {
          if !wroteHeader {
            csv += row.columnNames.map(Self.csvField).joined(separator: ",") + "\n"
            wroteHeader = true
          }
          csv += row.databaseValues.map { Self.csvField(Self.stringify($0)) }.joined(separator: ",") + "\n"
        }
        csv += "\n"
      }
      return Data(csv.utf8)
    }
  }

  /// RFC4180's real edge cases for this known schema: wrap-in-quotes + doubled
  /// embedded quotes when a comma, quote, or newline is present (RESEARCH Pattern 10).
  public static func csvField(_ value: String) -> String {
    guard value.contains(",") || value.contains("\"") || value.contains("\n") else { return value }
    return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
  }

  private static func stringify(_ value: DatabaseValue) -> String {
    switch value.storage {
    case .null: return ""
    case .int64(let int): return String(int)
    case .double(let double): return String(double)
    case .string(let string): return string
    case .blob: return ""
    }
  }
}

/// TRU-03: the ShareLink-transferable wrapper around a built CSV export.
public struct CSVDocument: Transferable, Sendable {
  public let data: Data

  public init(data: Data) {
    self.data = data
  }

  public static var transferRepresentation: some TransferRepresentation {
    DataRepresentation(exportedContentType: .commaSeparatedText) { document in
      document.data
    }
  }
}
