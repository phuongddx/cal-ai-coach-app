import Foundation
import GRDB
import Testing

@testable import CoachCalPersistence

@Suite
struct OutboxRepositoryTests {
  private func makeDatabase() throws -> (OutboxRepository, DatabasePool) {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
    return (OutboxRepository(database: pool), pool)
  }

  private func makeOperation(
    opId: UUID,
    createdAt: Date,
    nextRetryAt: Date? = nil
  ) -> PendingOp {
    PendingOp(
      opId: opId,
      tableName: "diary_entries",
      recordId: UUID(),
      kind: "upsert",
      snapshot: "{}",
      clientTimestamp: createdAt,
      createdAt: createdAt,
      nextRetryAt: nextRetryAt
    )
  }

  @Test
  func dueOpsReturnsOldestFiftyAndExcludesFutureRetries() async throws {
    let (repository, pool) = try makeDatabase()
    let base = Date(timeIntervalSince1970: 1_768_300_000)
    let futureOperation = makeOperation(
      opId: UUID(),
      createdAt: base,
      nextRetryAt: base.addingTimeInterval(3_155_695_200)
    )
    let operations = (1...55).map { index in
      makeOperation(opId: UUID(), createdAt: base.addingTimeInterval(TimeInterval(index)))
    }

    try await pool.write { database in
      try futureOperation.insert(database)
      for operation in operations {
        try operation.insert(database)
      }
    }

    let due = try await repository.dueOps(limit: 100)
    #expect(due.count == 50)
    #expect(due.first?.createdAt == base.addingTimeInterval(1))
    #expect(due.last?.createdAt == base.addingTimeInterval(50))
    #expect(!due.contains { $0.opId == futureOperation.opId })
  }

  @Test
  func acknowledgementDeletesAndFailureSchedulesRetry() async throws {
    let (repository, pool) = try makeDatabase()
    let base = Date(timeIntervalSince1970: 1_768_300_000)
    let acked = makeOperation(opId: UUID(), createdAt: base)
    let failed = makeOperation(opId: UUID(), createdAt: base.addingTimeInterval(1))
    let untouched = makeOperation(opId: UUID(), createdAt: base.addingTimeInterval(2))
    try await pool.write { database in
      for operation in [acked, failed, untouched] {
        try operation.insert(database)
      }
    }

    try await repository.markDispatched(opIds: [acked.opId])
    let retryAt = base.addingTimeInterval(31)
    try await repository.markFailed(opIds: [failed.opId], retryAt: retryAt)

    let ackedCount = try await pool.read { try PendingOp.fetchOne($0, key: acked.opId) }
    let storedFailed = try await pool.read { try PendingOp.fetchOne($0, key: failed.opId) }
    let untouchedOperation = try await pool.read {
      try PendingOp.fetchOne($0, key: untouched.opId)
    }
    #expect(ackedCount == nil)
    #expect(storedFailed?.dispatchAttempts == 1)
    #expect(storedFailed?.nextRetryAt == retryAt)
    #expect(untouchedOperation == untouched)
  }

  @Test
  func statusSnapshotReturnsPendingCountAndOldestCreation() async throws {
    let (repository, pool) = try makeDatabase()
    let base = Date(timeIntervalSince1970: 1_768_300_000)

    let emptyStatus = try await repository.statusSnapshot()
    #expect(emptyStatus == OutboxStatus(pendingCount: 0, oldestCreatedAt: nil))

    let operations = [
      makeOperation(opId: UUID(), createdAt: base.addingTimeInterval(2)),
      makeOperation(opId: UUID(), createdAt: base),
      makeOperation(
        opId: UUID(),
        createdAt: base.addingTimeInterval(3),
        nextRetryAt: base.addingTimeInterval(60)
      ),
    ]
    try await pool.write { database in
      for operation in operations {
        try operation.insert(database)
      }
    }

    let status = try await repository.statusSnapshot()
    #expect(status == OutboxStatus(pendingCount: 3, oldestCreatedAt: base))
  }
}
