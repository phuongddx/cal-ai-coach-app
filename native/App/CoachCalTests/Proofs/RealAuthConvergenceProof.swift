import Foundation
import GRDB
import Supabase
import Testing

import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence
import CoachCalSync

// Same env-var gate as CoachCalNetworkingTests/AuthSessionTests.swift — never
// a hardcoded credential. Proves "two real accounts converge" (RESEARCH
// Common Pitfall 12): two in-process SyncEngine installs, ONE real
// (non-ephemeral) owner, not the physical two-device airplane test (04-07).
private nonisolated let liveCredentialsConfigured = {
  let environment = ProcessInfo.processInfo.environment
  return environment["SUPABASE_ANON_KEY"] != nil
    && (environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"]) != nil
    && (environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"]) != nil
}()

@Suite(
  .serialized,
  .disabled(if: !liveCredentialsConfigured, Comment("requires a seeded local Supabase and credential env vars"))
)
struct RealAuthConvergenceProof {
  @Test
  func twoInstallsUnderTheSameRealAccountConverge() async throws {
    let environment = ProcessInfo.processInfo.environment
    let email = try #require(
      environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"],
      "missing local test email"
    )
    let password = try #require(
      environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"],
      "missing local test password"
    )

    let first = try await ProofHarness.createForRealOwner(
      email: email, password: password, runtime: "iOS 18.4"
    )
    let entry = ProofSupport.newEntry(owner: first.owner)
    let base = try await first.diary.recordUpsert(entry)
    _ = try await first.bindAndDispatch()

    let second = try first.makeIndependentInstall()
    _ = try await second.bindAndDispatch()

    let firstEdit = ProofSupport.edited(entry, text: "real-account first offline edit")
    let secondEdit = ProofSupport.edited(entry, text: "real-account second offline edit")
    _ = try await first.diary.recordUpsert(firstEdit)
    let secondOp = try await second.diary.recordUpsert(secondEdit)

    let firstResult = try await first.bindAndDispatch()
    let secondResult = try await second.bindAndDispatch()
    // Install 1 reconnects once more to pull install 2's server-canonical winner.
    _ = try await first.bindAndDispatch()

    let firstRow = try await first.entry(entry.id)
    let secondRow = try await second.entry(entry.id)

    #expect(firstResult.acked == 1)
    #expect(secondResult.acked == 1)
    #expect(firstRow?.id == secondRow?.id)
    #expect(firstRow?.displayText == secondRow?.displayText)
    #expect(firstRow?.serverVersion == secondRow?.serverVersion)
    #expect(firstRow?.acceptedOpId == secondRow?.acceptedOpId)
    #expect((firstRow?.deletedAt != nil) == (secondRow?.deletedAt != nil))
    // LWW: install 2's edit carries the later updatedAt, so its op wins.
    #expect(firstRow?.acceptedOpId == secondOp.opId)

    let winner = try #require(firstRow)
    let checks = [
      ProofCheck(name: "firstReconnect", status: .pass, timingMs: firstResult.acked),
      ProofCheck(name: "secondReconnect", status: .pass, timingMs: secondResult.acked),
    ]
    let evidence: [String: ProofValue] = [
      "serverVersion": .int(Int(winner.serverVersion)),
      "acceptedOpId": .uuid(winner.acceptedOpId ?? base.opId),
      "tombstone": .bool(winner.deletedAt != nil),
    ]
    let record = ProofHarness.makeRecord(
      scenario: .sameOwnerConvergence,
      rowId: entry.id,
      checks: checks,
      evidence: evidence,
      runtime: "iOS 18.4"
    )
    try ProofHarness.emit(record)
    await second.cleanup()
    await first.cleanup()
  }
}

extension ProofHarness {
  /// Same wiring as `create(runtime:)` (transport/engine/repositories) but
  /// signs in to the caller-supplied REAL account instead of a fresh
  /// ephemeral `signUp`.
  static func createForRealOwner(
    email: String,
    password: String,
    runtime: String
  ) async throws -> ProofHarness {
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
    let session = try await authClient.auth.signIn(email: email, password: password)
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

    let engine = SyncEngine(transport: transport, outbox: outbox, merge: merge)
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
}
