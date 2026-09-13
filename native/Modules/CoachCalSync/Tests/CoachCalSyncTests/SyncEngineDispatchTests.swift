import Foundation
import GRDB
import Synchronization
import Testing

import CoachCalCore
import CoachCalPersistence

@testable import CoachCalSync

@Suite
struct SyncEngineDispatchTests {
  @Test
  func overlappingDispatchCallsPushTheSameBatchOnlyOnce() async throws {
    let harness = try makeHarness()
    _ = try await harness.seedOutbox(count: 1)
    await harness.transport.configure(pushDelay: .milliseconds(25))
    let queued = try await harness.database.read { try PendingOp.fetchAll($0) }
    await harness.transport.configure(pushResponse: validAckResponse(for: queued))

    let owner = UUID()
    await harness.engine.bind(owner)
    async let first = harness.engine.dispatch()
    async let second = harness.engine.dispatch()
    _ = try await (first, second)

    #expect(await harness.transport.pushCalls.count == 1)
  }

  @Test
  func successfulAcknowledgementsDeleteOperationsAndBumpCanonicalRows() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 1)
    let op = try #require(operations.first)
    let acceptedOp = UUID()
    await harness.transport.configure(
      pushResponse: PushResponse(
        accepted: [
          PushAcknowledgement(
            opId: op.opId,
            serverVersion: 10,
            acceptedOpId: acceptedOp,
            duplicate: false
          )
        ]
      )
    )

    let owner = UUID()
    await harness.engine.bind(owner)
    let result = try await harness.engine.dispatch()

    #expect(result.acked == 1)
    let pending = try await harness.readPending(opId: op.opId)
    #expect(pending == nil)
    let row = try await harness.readEntry(id: op.recordId)
    #expect(row?.serverVersion == 10)
    #expect(row?.acceptedOpId == acceptedOp)
  }

  @Test
  func transportFailureSchedulesDeterministicBackoffAndLaterReplayIsSafe() async throws {
    let harness = try makeHarness()
    let operations = try await harness.seedOutbox(count: 1)
    let op = try #require(operations.first)
    await harness.transport.configure(failure: SyncTransportFailure())

    let owner = UUID()
    await harness.engine.bind(owner)
    await #expect(throws: SyncTransportFailure.self) {
      try await harness.engine.dispatch()
    }

    var failed = try await harness.readPending(opId: op.opId)
    #expect(failed?.dispatchAttempts == 1)
    #expect(failed?.nextRetryAt == harness.now.addingTimeInterval(1))

    #expect(Backoff.delay(forDispatchAttempts: 1) == .seconds(1))
    #expect(Backoff.delay(forDispatchAttempts: 2) == .seconds(2))
    #expect(Backoff.delay(forDispatchAttempts: 3) == .seconds(4))
    #expect(Backoff.delay(forDispatchAttempts: 6) == .seconds(30))
    #expect(Backoff.delay(forDispatchAttempts: 7) == .seconds(30))

    let acceptedOp = UUID()
    await harness.transport.configure(
      pushResponse: PushResponse(
        accepted: [
          PushAcknowledgement(
            opId: op.opId,
            serverVersion: 11,
            acceptedOpId: acceptedOp,
            duplicate: true
          )
        ]
      ),
      failure: nil
    )
    if let staleOperation = failed {
      let retrying = staleOperation
      try await harness.write { database in
        var operation = retrying
        operation.nextRetryAt = nil
        try operation.update(database)
      }
    }

    _ = try await harness.engine.dispatch()
    failed = try await harness.readPending(opId: op.opId)
    let row = try await harness.readEntry(id: op.recordId)
    #expect(failed == nil)
    #expect(row?.serverVersion == 11)
    #expect(row?.acceptedOpId == acceptedOp)
  }

  @Test
  func permanentlyUndecodableOperationIsDeadLetteredWithoutLosingTheRow() async throws {
    let harness = try makeHarness()
    let poisoned = PendingOp(
      opId: UUID(),
      tableName: "diary_entries",
      recordId: UUID(),
      kind: "upsert",
      snapshot: "not-json",
      clientTimestamp: harness.now,
      createdAt: harness.now
    )
    try await harness.write { try poisoned.insert($0) }
    await harness.engine.bind(UUID())

    for _ in 0..<(SyncEngine.maxOpAttempts - 1) {
      let result = try await harness.engine.dispatch()
      #expect(result.poisoned == 1)
      let retrying = try await harness.readPending(opId: poisoned.opId)
      #expect(retrying?.quarantined == false)
    }

    let final = try await harness.engine.dispatch()
    #expect(final.poisoned == 1)

    let stored = try await harness.readPending(opId: poisoned.opId)
    #expect(stored?.quarantined == true)
    #expect(try await harness.outbox.dueOps(limit: SyncEngine.batchSize).isEmpty)
  }

  @Test
  func debouncedDispatchSurfacesThrownErrorsThroughSink() async throws {
    let harness = try makeHarness(debounceInterval: .milliseconds(20))
    _ = try await harness.seedOutbox(count: 1)
    await harness.transport.configure(failure: SyncTransportFailure())
    let capture = ErrorCapture()
    await harness.engine.setOnError { capture.append($0) }
    await harness.engine.bind(UUID())
    await harness.engine.notifyLocalMutation()
    try await Task.sleep(for: .milliseconds(300))

    #expect(capture.descriptions.count == 1)
    #expect(capture.descriptions.first?.hasPrefix("SyncTransportFailure") == true)
  }

  @Test
  func debouncedDispatchSurfacesPoisonedOperationsThroughSink() async throws {
    let harness = try makeHarness(debounceInterval: .milliseconds(20))
    let poisoned = PendingOp(
      opId: UUID(),
      tableName: "diary_entries",
      recordId: UUID(),
      kind: "upsert",
      snapshot: "not-json",
      clientTimestamp: harness.now,
      createdAt: harness.now
    )
    try await harness.write { try poisoned.insert($0) }
    let capture = ErrorCapture()
    await harness.engine.setOnError { capture.append($0) }
    await harness.engine.bind(UUID())
    await harness.engine.notifyLocalMutation()
    try await Task.sleep(for: .milliseconds(300))

    #expect(capture.descriptions == ["SyncEngineError: poisonedOperations(count: 1)"])
  }

  @Test
  func pullSkipsNewerPendingIntentButAppliesOtherRowsAndAdvancesCursor() async throws {
    let harness = try makeHarness()
    let protectedRecord = UUID()
    let owner = UUID()
    let pendingEntry = DiaryEntry(
      id: protectedRecord,
      userId: owner,
      displayText: "local intent",
      createdAt: harness.now,
      updatedAt: harness.now,
      deletedAt: nil,
      serverVersion: 1,
      acceptedOpId: nil,
      serverUpdatedAt: harness.now
    )
    try await harness.write { try pendingEntry.insert($0) }
    _ = try await harness.seedOutbox(
      count: 1,
      recordId: protectedRecord,
      nextRetryAt: harness.now.addingTimeInterval(3_155_695_200),
      insertMirror: false
    )

    let mergeableRecord = UUID()
    await harness.transport.configure(
      pullResponse: try PullResponse(
        rows: [
          PulledRow(
            table: .diaryEntries,
            recordId: protectedRecord,
            snapshot: DiaryEntrySnapshot(
              id: protectedRecord,
              displayText: "remote newer",
              deletedAt: nil,
              serverVersion: 10,
              acceptedOpId: UUID()
            )
          ),
          PulledRow(
            table: .diaryEntries,
            recordId: mergeableRecord,
            snapshot: DiaryEntrySnapshot(
              id: mergeableRecord,
              displayText: "remote new",
              deletedAt: nil,
              serverVersion: 12,
              acceptedOpId: UUID()
            )
          )
        ],
        cursor: 12
      )
    )

    await harness.engine.bind(owner)
    let result = try await harness.engine.dispatch()

    #expect(result.pulled == 2)
    let protectedRow = try await harness.readEntry(id: protectedRecord)
    #expect(protectedRow?.displayText == "local intent")
    #expect(protectedRow?.serverVersion == 1)
    let appliedRow = try await harness.readEntry(id: mergeableRecord)
    #expect(appliedRow?.displayText == "remote new")
    #expect(try await harness.readCursor() == 12)
  }
}

struct SyncTransportFailure: Error, Equatable {}

final class ErrorCapture: Sendable {
  private let entries = Mutex<[String]>([])

  func append(_ error: any Error) {
    entries.withLock { $0.append("\(type(of: error)): \(error)") }
  }

  var descriptions: [String] {
    entries.withLock { $0 }
  }
}

actor MockTransport: SyncTransport {
  var pushCalls: [[SyncOperation]] = []
  var pullCalls: [Int] = []
  var pushResponse = PushResponse(accepted: [])
  var pullResponse = try! PullResponse(rows: [], cursor: 0)
  var pushDelay: Duration = .zero
  var pushWait: (@Sendable () async -> Void)?
  var failure: Error?

  func configure(
    pushResponse: PushResponse? = nil,
    pullResponse: PullResponse? = nil,
    failure: (any Error)? = nil,
    pushDelay: Duration? = nil,
    pushWait: (@Sendable () async -> Void)? = nil
  ) {
    if let pushResponse {
      self.pushResponse = pushResponse
    }
    if let pullResponse {
      self.pullResponse = pullResponse
    }
    self.failure = failure
    if let pushDelay {
      self.pushDelay = pushDelay
    }
    self.pushWait = pushWait
  }

  func push(_ request: PushRequest) async throws -> PushResponse {
    pushCalls.append(request.operations)
    await pushWait?()
    if pushDelay > .zero {
      try await Task.sleep(for: pushDelay)
    }
    if let failure {
      throw failure
    }
    return pushResponse
  }

  func pull(cursor: Int) async throws -> PullResponse {
    pullCalls.append(cursor)
    if let failure {
      throw failure
    }
    return pullResponse
  }
}

struct EngineHarness {
  let database: DatabasePool
  let transport: MockTransport
  let outbox: OutboxRepository
  let engine: SyncEngine
  let now: Date

  func seedOutbox(
    count: Int,
    recordId: UUID? = nil,
    nextRetryAt: Date? = nil,
    insertMirror: Bool = true
  ) async throws -> [PendingOp] {
    let owner = UUID()
    var operations: [PendingOp] = []

    for index in 0..<count {
      let id = recordId ?? UUID()
      let entry = DiaryEntry(
        id: id,
        userId: owner,
        displayText: "operation \(index)",
        createdAt: now,
        updatedAt: now,
        deletedAt: nil,
        serverVersion: 0,
        acceptedOpId: nil,
        serverUpdatedAt: now
      )
      let snapshot = DiaryEntrySnapshot(
        id: id,
        displayText: entry.displayText,
        deletedAt: nil,
        serverVersion: 0,
        acceptedOpId: nil
      )
      let operation = PendingOp(
        opId: UUID(),
        tableName: "diary_entries",
        recordId: id,
        kind: "upsert",
        snapshot: try Self.snapshotData(snapshot),
        clientTimestamp: now,
        createdAt: now.addingTimeInterval(TimeInterval(index)),
        nextRetryAt: nextRetryAt
      )
      operations.append(operation)
      try await write {
        if insertMirror {
          try entry.insert($0)
        }
        try operation.insert($0)
      }
    }
    return operations
  }

  func readPending(opId: UUID) async throws -> PendingOp? {
    try await database.read { try PendingOp.fetchOne($0, key: opId) }
  }

  func readEntry(id: UUID) async throws -> DiaryEntry? {
    try await database.read { try DiaryEntry.fetchOne($0, key: id) }
  }

  func readCursor() async throws -> Int64 {
    try await database.read { database in
      try SyncState.fetchOne(database, key: 1)?.pullCursor ?? 0
    }
  }

  func write(_ work: @escaping @Sendable (GRDB.Database) throws -> Void) async throws {
    try await database.write { database in
      try work(database)
    }
  }

  static func snapshotData(_ snapshot: DiaryEntrySnapshot) throws -> String {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    return String(decoding: try encoder.encode(snapshot), as: UTF8.self)
  }
}

func validAckResponse(for operations: [PendingOp]) -> PushResponse {
  PushResponse(
    accepted: operations.map { operation in
      PushAcknowledgement(
        opId: operation.opId,
        serverVersion: 1,
        acceptedOpId: UUID(),
        duplicate: false
      )
    }
  )
}

func makeHarness(
  debounceInterval: Duration = SyncEngine.defaultDebounceInterval
) throws -> EngineHarness {
  let directory = FileManager.default.temporaryDirectory
    .appending(component: "sync-engine-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  let database = try Database.makePool(
    at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
  )
  try Migrations.foundationSync.migrate(database)

  let now = Date(timeIntervalSince1970: 1_768_300_000)
  let transport = MockTransport()
  let outbox = OutboxRepository(database: database)
  let merge = SyncMergeRepository(database: database)
  let engine = SyncEngine(
    debounceInterval: debounceInterval,
    transport: transport,
    outbox: outbox,
    merge: merge,
    now: { now }
  )
  return EngineHarness(
    database: database,
    transport: transport,
    outbox: outbox,
    engine: engine,
    now: now
  )
}
