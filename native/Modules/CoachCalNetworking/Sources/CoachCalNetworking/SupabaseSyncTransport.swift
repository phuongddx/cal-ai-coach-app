import Foundation
import Supabase
import CoachCalCore

public enum SyncTransportError: Error, Equatable, Sendable {
  case rpc(code: String?, message: String)
  case request(String)
}

public struct SupabaseSyncTransport: SyncTransport {
  private let client: SupabaseClient

  public init(client: SupabaseClient) {
    self.client = client
  }

  public func push(_ request: PushRequest) async throws -> PushResponse {
    do {
      let response: PostgrestResponse<PushResponse> = try await client
        .rpc("sync_push", params: RPCParams(key: "p_ops", value: request.operations))
        .execute()
      let decoded = response.value
      try decoded.validateAcknowledgementSet(against: request.operations)
      return decoded
    } catch let error as PostgrestError {
      throw SyncTransportError.rpc(code: error.code, message: error.message)
    } catch {
      throw SyncTransportError.request(String(describing: error))
    }
  }

  public func pull(cursor: Int) async throws -> PullResponse {
    do {
      let response: PostgrestResponse<PullResponse> = try await client
        .rpc("sync_pull", params: RPCParams(key: "p_cursor", value: cursor))
        .execute()
      return response.value
    } catch let error as PostgrestError {
      throw SyncTransportError.rpc(code: error.code, message: error.message)
    } catch {
      throw SyncTransportError.request(String(describing: error))
    }
  }
}

private struct RPCParams<Value: Encodable>: Encodable {
  let key: String
  let value: Value

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: DynamicKey.self)
    try container.encode(value, forKey: DynamicKey(key))
  }

  private struct DynamicKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init(_ stringValue: String) {
      self.stringValue = stringValue
      self.intValue = nil
    }

    init?(stringValue: String) {
      self.init(stringValue)
    }

    init?(intValue: Int) {
      nil
    }
  }
}
