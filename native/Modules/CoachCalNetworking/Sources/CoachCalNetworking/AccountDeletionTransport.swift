import Foundation
import Supabase

public enum AccountDeletionError: Error, Equatable, Sendable {
  case http(code: Int)
  case relay
  case request(String)
}

// Invokes the server-side delete-account Edge Function over the caller's own
// authenticated session — the secret key and admin.deleteUser call never
// exist on-device (RESEARCH Pattern 4 / Security Domain V4).
public struct AccountDeletionTransport: Sendable {
  private let client: SupabaseClient

  public init(client: SupabaseClient) {
    self.client = client
  }

  public func deleteAccount() async throws {
    do {
      try await client.functions.invoke("delete-account")
    } catch let error as FunctionsError {
      switch error {
      case .httpError(let code, _):
        throw AccountDeletionError.http(code: code)
      case .relayError:
        throw AccountDeletionError.relay
      }
    } catch {
      throw AccountDeletionError.request(String(describing: error))
    }
  }
}
