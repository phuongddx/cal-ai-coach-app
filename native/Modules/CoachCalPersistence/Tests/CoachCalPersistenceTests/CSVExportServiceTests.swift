import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct CSVExportServiceTests {
  private let user = UUID(uuidString: "04BBB783-BBE3-4A11-BE45-6B77E3D23B20")!

  private func makeService() throws -> (CSVExportService, DatabasePool) {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let pool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(pool)
    return (CSVExportService(database: pool), pool)
  }

  private func insertInsight(_ pool: DatabasePool, title: String, body: String) async throws {
    try await pool.write { database in
      try database.execute(
        sql: """
          INSERT INTO insights (id, user_id, day, kind, title, body, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """,
        arguments: [
          UUID().uuidString, user.uuidString, "2026-09-15", "streak", title, body,
          Date(timeIntervalSince1970: 1_768_300_000),
        ]
      )
    }
  }

  // Naive RFC4180 field parser — only needs to invert what csvField itself
  // escaped moments earlier in the same test, not the full grammar (Don't
  // Hand-Roll table, RESEARCH Pattern 10).
  private func parseCSVRows(_ csv: String) -> [[String]] {
    var rows: [[String]] = []
    var row: [String] = []
    var field = ""
    var inQuotes = false
    let chars = Array(csv)
    var i = 0
    while i < chars.count {
      let char = chars[i]
      if inQuotes {
        if char == "\"" {
          if i + 1 < chars.count, chars[i + 1] == "\"" {
            field.append("\"")
            i += 2
            continue
          }
          inQuotes = false
          i += 1
          continue
        }
        field.append(char)
        i += 1
      } else if char == "\"" {
        inQuotes = true
        i += 1
      } else if char == "," {
        row.append(field)
        field = ""
        i += 1
      } else if char == "\n" {
        row.append(field)
        rows.append(row)
        row = []
        field = ""
        i += 1
      } else {
        field.append(char)
        i += 1
      }
    }
    if !field.isEmpty || !row.isEmpty {
      row.append(field)
      rows.append(row)
    }
    return rows
  }

  @Test
  func csvFieldEscapesEmbeddedCommaQuoteAndNewline() {
    #expect(CSVExportService.csvField("plain") == "plain")
    #expect(CSVExportService.csvField("a,b") == "\"a,b\"")
    #expect(CSVExportService.csvField("say \"hi\"") == "\"say \"\"hi\"\"\"")
    #expect(CSVExportService.csvField("line1\nline2") == "\"line1\nline2\"")
  }

  @Test
  func buildFullExportCSVRoundTripsEmbeddedEdgeCasesPerRow() async throws {
    let (service, pool) = try makeService()
    try await insertInsight(pool, title: "Comma, here", body: "plain body")
    try await insertInsight(pool, title: "Quote \"here\"", body: "plain body")
    try await insertInsight(pool, title: "Newline title", body: "line one\nline two")

    let data = try await service.buildFullExportCSV(userId: user)
    let csv = String(decoding: data, as: UTF8.self)
    let rows = parseCSVRows(csv)

    // insights columns (SELECT * order matches the migration's declaration
    // order): id, user_id, day, kind, title, body, created_at.
    let titles = rows.filter { $0.count > 5 }.map { $0[4] }
    let bodies = rows.filter { $0.count > 5 }.map { $0[5] }
    #expect(titles.contains("Comma, here"))
    #expect(titles.contains("Quote \"here\""))
    #expect(bodies.contains("line one\nline two"))
  }

  @Test
  func buildFullExportCSVIncludesEveryCanonicalDomainTable() async throws {
    let (service, _) = try makeService()
    let data = try await service.buildFullExportCSV(userId: user)
    let csv = String(decoding: data, as: UTF8.self)

    // Cross-referenced with Migrations.swift's "3__domain_core" migration (11
    // tables + app_settings) plus "1__foundation_sync"'s diary_entries mirror —
    // pending_ops/sync_state are sync-internal bookkeeping, deliberately
    // excluded from this user-facing export. Update both lists together if a
    // domain table is ever added or renamed (drift caught in review).
    let canonicalDomainTables = [
      "user_targets", "diary_entry_details", "foods", "saved_meals", "custom_foods",
      "water_logs", "weight_logs", "exercise_logs", "streak_state", "badges", "insights",
      "app_settings", "diary_entries",
    ]
    #expect(canonicalDomainTables == CSVExportService.exportedTables)
    for table in canonicalDomainTables {
      #expect(csv.contains("# \(table)\n"), "missing section header for \(table)")
    }
  }
}
