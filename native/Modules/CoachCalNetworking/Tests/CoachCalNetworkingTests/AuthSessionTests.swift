import Foundation
import Supabase
import Testing
@testable import CoachCalNetworking

import CoachCalPersistence
import CoachCalSync

private let liveCredentialsConfigured = {
  let environment = ProcessInfo.processInfo.environment
  return environment["SUPABASE_ANON_KEY"] != nil
    && (environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"]) != nil
    && (environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"]) != nil
}()

@Suite(
  .serialized,
  .disabled(if: !liveCredentialsConfigured, Comment("requires a seeded local Supabase and credential env vars"))
)
struct AuthSessionTests {
  @Test
  func liveSignInPersistsAndSecondClientRestoresSession() async throws {
    let environment = ProcessInfo.processInfo.environment
    let email = try #require(
      environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"],
      "missing local test email"
    )
    let password = try #require(
      environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"],
      "missing local test password"
    )
    let supabaseURL = URL(string: environment["SUPABASE_URL"] ?? "http://127.0.0.1:54321")!
    let anonKey = try #require(environment["SUPABASE_ANON_KEY"], "missing local anon key")
    let service = "coachcal.tests.restore.\(UUID().uuidString)"

    let first = AuthSessionStore(supabaseURL: supabaseURL, anonKey: anonKey, keychainService: service)
    let signedIn = try await first.signIn(email: email, password: password)

    let second = AuthSessionStore(supabaseURL: supabaseURL, anonKey: anonKey, keychainService: service)
    #expect(second.currentSession?.user.id == signedIn.user.id)
    let restored = try await second.restoreSession()
    #expect(restored.user.id == signedIn.user.id)
  }

  @Test
  func signOutClearsKeychainForSecondClient() async throws {
    let environment = ProcessInfo.processInfo.environment
    let email = try #require(
      environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"],
      "missing local test email"
    )
    let password = try #require(
      environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"],
      "missing local test password"
    )
    let supabaseURL = URL(string: environment["SUPABASE_URL"] ?? "http://127.0.0.1:54321")!
    let anonKey = try #require(environment["SUPABASE_ANON_KEY"], "missing local anon key")
    let service = "coachcal.tests.signout.\(UUID().uuidString)"

    let first = AuthSessionStore(supabaseURL: supabaseURL, anonKey: anonKey, keychainService: service)
    _ = try await first.signIn(email: email, password: password)
    try await first.signOut()

    let second = AuthSessionStore(supabaseURL: supabaseURL, anonKey: anonKey, keychainService: service)
    #expect(second.currentSession == nil)
    do {
      _ = try await second.restoreSession()
      Issue.record("Expected restored session to be absent")
    } catch {
      #expect(error is AuthError)
    }
  }

  // Proves the Task 1 dispatch wiring at the module level (no app target
  // needed): a real sign-in produces a session whose owner a fresh
  // SyncEngine binds to, and one recordUpsert actually dispatches.
  @Test
  func liveSignInThenSyncEngineBindsAndDispatches() async throws {
    let environment = ProcessInfo.processInfo.environment
    let email = try #require(
      environment["TEST_EMAIL"] ?? environment["COACHCAL_TEST_EMAIL"],
      "missing local test email"
    )
    let password = try #require(
      environment["TEST_PASSWORD"] ?? environment["COACHCAL_TEST_PASSWORD"],
      "missing local test password"
    )
    let supabaseURL = URL(string: environment["SUPABASE_URL"] ?? "http://127.0.0.1:54321")!
    let anonKey = try #require(environment["SUPABASE_ANON_KEY"], "missing local anon key")
    let service = "coachcal.tests.dispatch.\(UUID().uuidString)"

    let store = AuthSessionStore(supabaseURL: supabaseURL, anonKey: anonKey, keychainService: service)
    let session = try await store.signIn(email: email, password: password)

    let directory = FileManager.default.temporaryDirectory
      .appending(component: "coachcal-networking-tests-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let path = directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    let database = try Database.makePool(at: path)
    try Migrations.foundationSync.migrate(database)

    let transport = SupabaseSyncTransport(client: store.client)
    let outbox = OutboxRepository(database: database)
    let merge = SyncMergeRepository(database: database)
    let engine = SyncEngine(transport: transport, outbox: outbox, merge: merge)
    await engine.bind(session.user.id)

    let entries = DiaryEntryRepository(database: database)
    let now = Date()
    let entry = DiaryEntry(
      id: UUID(),
      userId: session.user.id,
      displayText: "module-level dispatch proof",
      createdAt: now,
      updatedAt: now,
      deletedAt: nil,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: now
    )
    _ = try await entries.recordUpsert(entry, now: now)

    let result = try await engine.dispatch()
    #expect(result.pushed == 1)
    #expect(result.acked == 1)

    await engine.stop()
    try FileManager.default.removeItem(at: directory)
  }
}
