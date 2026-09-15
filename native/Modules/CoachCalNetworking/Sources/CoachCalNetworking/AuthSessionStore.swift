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

  @discardableResult
  public func signInWithApple(idToken: String, nonce: String) async throws -> Session {
    try await client.auth.signInWithIdToken(
      credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
    )
  }

  // Default shared ASWebAuthenticationSession (no `configure:` override — RESEARCH
  // Pitfall 10: ephemeral is a privacy-review decision, not a default).
  @discardableResult
  public func signInWithGoogle(redirectTo: URL) async throws -> Session {
    try await client.auth.signInWithOAuth(provider: .google, redirectTo: redirectTo)
  }

  public func signInWithOTP(email: String, redirectTo: URL) async throws {
    try await client.auth.signInWithOTP(email: email, redirectTo: redirectTo)
  }

  @discardableResult
  public func verifyOTP(email: String, token: String) async throws -> Session {
    let response = try await client.auth.verifyOTP(email: email, token: token, type: .email)
    guard let session = response.session else {
      throw AuthSessionError.otpConfirmationPending
    }
    return session
  }
}

public enum AuthSessionError: Error, Equatable, Sendable {
  /// verifyOTP succeeded but GoTrue returned only a user, no session (email
  /// confirmation still pending server-side).
  case otpConfirmationPending
}
