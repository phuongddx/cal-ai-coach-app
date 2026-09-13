import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct DiaryEntryRepositoryTests {
  private struct TestFailure: Error, Sendable {}

  private struct OutboxSnapshot: Decodable, Equatable {
    let id: UUID
    let displayText: String
    let deletedAt: Date?
    let serverVersion: Int
    let acceptedOpId: UUID?
  }

  private func makeRepository() throws -> (DiaryEntryRepository, DatabasePool, String) {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let pool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(pool)
    return (DiaryEntryRepository(database: pool), pool, path)
  }

  private func makeEntry(displayText: String = "Oatmeal") -> DiaryEntry {
    let timestamp = Date(timeIntervalSince1970: 1_768_300_000)
    return DiaryEntry(
      id: UUID(uuidString: "B07537F5-5709-45FA-B4C6-20CB5F0F1A1F")!,
      userId: UUID(uuidString: "04BBB783-BBE3-4A11-BE45-6B77E3D23B20")!,
      displayText: displayText,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: nil,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: timestamp
    )
  }

  @Test
  func recordUpsertWritesDiaryAndOutboxAtomically() async throws {
    let (repository, pool, _) = try makeRepository()
    let entry = makeEntry()
    let now = Date(timeIntervalSince1970: 1_768_300_050)

    let operation = try await repository.recordUpsert(entry, now: now)

    #expect(operation.kind == "upsert")
    #expect(operation.recordId == entry.id)
    let storedEntry = try await pool.read { try DiaryEntry.fetchOne($0, key: entry.id) }
    let storedOperation = try await pool.read { try PendingOp.fetchOne($0, key: operation.opId) }
    #expect(storedEntry == entry)
    #expect(storedOperation == operation)
  }

  @Test
  func midTransactionFailureRollsBackBothWrites() async throws {
    let (repository, pool, _) = try makeRepository()
    let entry = makeEntry()

    do {
      _ = try await repository.recordUpsert(entry, now: Date(), transactionHook: { _ in
        throw TestFailure()
      })
      #expect(Bool(false), "Expected the injected failure to propagate")
    } catch {
      #expect(error is TestFailure)
    }

    let entryCount = try await pool.read { try DiaryEntry.fetchCount($0) }
    let operationCount = try await pool.read { try PendingOp.fetchCount($0) }
    #expect(entryCount == 0)
    #expect(operationCount == 0)
  }

  @Test
  func committedWritesSurvivePoolCloseAndReopen() async throws {
    let (repository, pool, path) = try makeRepository()
    let entry = makeEntry()
    let operation = try await repository.recordUpsert(
      entry,
      now: Date(timeIntervalSince1970: 1_768_300_050)
    )
    try pool.close()

    let reopenedPool = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(reopenedPool)
    let storedEntry = try await reopenedPool.read { try DiaryEntry.fetchOne($0, key: entry.id) }
    let storedOperation = try await reopenedPool.read { try PendingOp.fetchOne($0, key: operation.opId) }
    #expect(storedEntry == entry)
    #expect(storedOperation == operation)
  }

  @Test
  func recordTombstoneWritesTombstoneAndOutboxAtomically() async throws {
    let (repository, pool, _) = try makeRepository()
    let entry = makeEntry()
    _ = try await repository.recordUpsert(entry)

    let deletedAt = Date(timeIntervalSince1970: 1_768_300_100)
    var tombstoned = entry
    tombstoned.deletedAt = deletedAt
    tombstoned.updatedAt = deletedAt
    let operation = try await repository.recordTombstone(tombstoned)

    #expect(operation.kind == "tombstone")
    let storedEntry = try await pool.read { try DiaryEntry.fetchOne($0, key: entry.id) }
    let storedOperation = try await pool.read { try PendingOp.fetchOne($0, key: operation.opId) }
    #expect(storedEntry?.deletedAt == deletedAt)
    #expect(storedOperation?.kind == "tombstone")

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    let snapshot = try decoder.decode(OutboxSnapshot.self, from: Data(operation.snapshot.utf8))
    #expect(
      snapshot == OutboxSnapshot(
        id: entry.id,
        displayText: entry.displayText,
        deletedAt: deletedAt,
        serverVersion: 0,
        acceptedOpId: nil
      )
    )
  }
}
