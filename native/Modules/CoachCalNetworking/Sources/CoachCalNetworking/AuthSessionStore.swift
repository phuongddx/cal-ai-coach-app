import Foundation
import Supabase

public struct AuthSessionStore: Sendable {
  public let client: SupabaseClient

  public init(
    supabaseURL: URL,
    anonKey: String,
    keychainService: String = "com.nextlabs.coachcal.auth"
  ) {
    client = SupabaseClient(
      supabaseURL: supabaseURL,
      supabaseKey: anonKey,
      options: SupabaseClientOptions(
        auth: .init(storage: KeychainLocalStorage(service: keychainService))
      )
    )
  }

  public var currentSession: Session? {
    client.auth.currentSession
  }

  public var authStateChanges: AsyncStream<(event: AuthChangeEvent, session: Session?)> {
    client.auth.authStateChanges
  }

  @discardableResult
  public func signIn(email: String, password: String) async throws -> Session {
    try await client.auth.signIn(email: email, password: password)
  }

  public func restoreSession() async throws -> Session {
    try await client.auth.session
  }

  public func signOut() async throws {
    try await client.auth.signOut()
  }
}
