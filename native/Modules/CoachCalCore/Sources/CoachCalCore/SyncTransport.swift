public protocol SyncTransport: Sendable {
  func push(_ request: PushRequest) async throws -> PushResponse
  func pull(cursor: Int) async throws -> PullResponse
}
