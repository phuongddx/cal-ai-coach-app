import Foundation
import Supabase
import Testing
@testable import CoachCalNetworking

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
}
