import Foundation
import GRDB
import os
import Supabase

import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence
import CoachCalSync

/// One ephemeral account plus one isolated GRDB install wired to the real
/// local Supabase transport and real sync engine.
struct ProofHarness: Sendable {
  let owner: UUID
  let database: DatabasePool
  let client: SupabaseClient
  let authClient: SupabaseClient
  let diary: DiaryEntryRepository
  let outbox: OutboxRepository
  let merge: SyncMergeRepository
  let engine: SyncEngine
  let transport: ProofTimingTransport
  let databasePath: String

  static func create(runtime: String) async throws -> ProofHarness {
    guard let rawURL = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
          let url = URL(string: rawURL),
          let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
          !anonKey.isEmpty
    else {
      throw ProofHarnessError.missingConfiguration
    }

    let tokenBox = ProofTokenBox()
    let storage = InMemoryProofStorage()
    let authClient = SupabaseClient(
      supabaseURL: url,
      supabaseKey: anonKey,
      options: SupabaseClientOptions(auth: .init(storage: storage))
    )
    let client = SupabaseClient(
      supabaseURL: url,
      supabaseKey: anonKey,
      options: SupabaseClientOptions(
        auth: .init(
          storage: storage,
          accessToken: ProofTokenBox.provider(tokenBox)
        )
      )
    )
    let email = ["proof-\(UUID().uuidString)", "proof.test"].joined(separator: "@")
    let password = String("\(UUID().uuidString)\(UUID().uuidString)A1!".prefix(40))
    let authResponse = try await authClient.auth.signUp(email: email, password: password)
    guard let session = authResponse.session, authResponse.user.id == session.user.id else {
      throw ProofHarnessError.sessionUnavailable
    }
    tokenBox.set(session.accessToken)

    let directory = FileManager.default.temporaryDirectory
      .appending(component: "coachcal-proofs-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let database = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(database)
    let transport = ProofTimingTransport(base: SupabaseSyncTransport(client: client))
    let outbox = OutboxRepository(database: database)
    let merge = SyncMergeRepository(database: database)

    let engine = SyncEngine(
      transport: transport,
      outbox: outbox,
      merge: merge
    )
    await engine.bind(session.user.id)

    return ProofHarness(
      owner: session.user.id,
      database: database,
      client: client,
      authClient: authClient,
      diary: DiaryEntryRepository(database: database),
      outbox: outbox,
      merge: merge,
      engine: engine,
      transport: transport,
      databasePath: path
    )
  }

  func makeIndependentInstall() throws -> ProofHarness {
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "coachcal-proofs-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let database = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(database)
    let transport = ProofTimingTransport(base: SupabaseSyncTransport(client: client))
    let outbox = OutboxRepository(database: database)
    let merge = SyncMergeRepository(database: database)
    let engine = SyncEngine(
      transport: transport,
      outbox: outbox,
      merge: merge
    )

    return ProofHarness(
      owner: owner,
      database: database,
      client: client,
      authClient: authClient,
      diary: DiaryEntryRepository(database: database),
      outbox: outbox,
      merge: merge,
      engine: engine,
      transport: transport,
      databasePath: path
    )
  }

  func bindAndDispatch() async throws -> DispatchResult {
    await engine.bind(owner)
    transport.beginDispatch(with: UUID())
    return try await engine.dispatch()
  }

  func entry(_ id: UUID) async throws -> DiaryEntry? {
    try await database.read { try DiaryEntry.fetchOne($0, key: id) }
  }

  func pendingCount() async throws -> Int {
    try await outbox.statusSnapshot().pendingCount
  }

  func cleanup() async {
    await engine.stop()
    try? await authClient.auth.signOut()
    try? FileManager.default.removeItem(atPath: databasePath)
  }

  static func emit(_ record: ProofRecord) throws {
    let data = try ProofRecordSerializer.data(for: record)
    // xcodebuild does not propagate host env into the simulator test
    // process, so default to the test process's own tmp directory and
    // honor the override when the host managed to pass it through.
    let directory = ProcessInfo.processInfo.environment["COACHCAL_PROOF_RECORDS_DIR"]
      ?? FileManager.default.temporaryDirectory
        .appending(component: "coachcal-proof-records")
        .path(percentEncoded: false)
    try FileManager.default.createDirectory(
      atPath: directory,
      withIntermediateDirectories: true
    )
    try data.write(
      to: URL(fileURLWithPath: directory, isDirectory: true)
        .appending(component: "\(record.scenario.rawValue)-\(record.runId.uuidString).json"),
      options: .atomic
    )
  }

  static func makeRecord(
    scenario: ProofScenario,
    rowId: UUID? = nil,
    checks: [ProofCheck],
    evidence: [String: ProofValue] = [:],
    runtime: String
  ) -> ProofRecord {
    ProofRecord(
      scenario: scenario,
      runId: UUID(),
      rowId: rowId,
      startedAt: Date(),
      environment: ProofEnvironment(stack: "local-supabase", runtime: runtime),
      checks: checks,
      evidence: evidence
    )
  }
}

enum ProofHarnessError: Error {
  case missingConfiguration
  case sessionUnavailable
}

/// Supplies the ephemeral account's access token directly to the client.
/// supabase-swift's internal session persistence is unreliable in the test
/// host, so proofs inject the token explicitly via `auth.accessToken`.
final class ProofTokenBox: Sendable {
  nonisolated private let state = OSAllocatedUnfairLock<String?>(initialState: nil)

  nonisolated var token: String? {
    state.withLock { $0 }
  }

  nonisolated func set(_ value: String) {
    state.withLock { $0 = value }
  }

  nonisolated static func provider(_ box: ProofTokenBox) -> @Sendable () async throws -> String? {
    { box.token }
  }
}

final class InMemoryProofStorage: AuthLocalStorage, @unchecked Sendable {
  private var value: Data?

  func store(key: String, value: Data) throws { self.value = value }
  func retrieve(key: String) throws -> Data? { value }
  func remove(key: String) throws { value = nil }
}

/// Captures dispatch-correlated transport timings without changing sync
/// semantics. Proofs are serialized, so one ID identifies the active run.
final class ProofTimingTransport: SyncTransport, @unchecked Sendable {
  struct Call {
    let startedAt: Date
    let endedAt: Date
  }

  private struct State {
    var dispatchId: UUID?
    var pushCall: Call?
    var pullCall: Call?
  }

  private let base: any SyncTransport
  private let state = OSAllocatedUnfairLock<State>(initialState: State())

  init(base: any SyncTransport) {
    self.base = base
  }

  func beginDispatch(with id: UUID) {
    state.withLock { state in
      state.dispatchId = id
      state.pushCall = nil
      state.pullCall = nil
    }
  }

  func push(_ request: PushRequest) async throws -> PushResponse {
    let startedAt = Date()
    let response = try await base.push(request)
    state.withLock { $0.pushCall = Call(startedAt: startedAt, endedAt: Date()) }
    return response
  }

  func pull(cursor: Int) async throws -> PullResponse {
    let startedAt = Date()
    let response = try await base.pull(cursor: cursor)
    state.withLock { $0.pullCall = Call(startedAt: startedAt, endedAt: Date()) }
    return response
  }

  func successfulCall() -> (push: Call, pull: Call?, dispatchId: UUID?)? {
    state.withLock { state in
      guard let push = state.pushCall else { return nil }
      return (push, state.pullCall, state.dispatchId)
    }
  }
}

extension Date {
  var epochMilliseconds: Int {
    Int(timeIntervalSince1970 * 1000)
  }
}
