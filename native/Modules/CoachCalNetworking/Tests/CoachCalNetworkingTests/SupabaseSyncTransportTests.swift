import Foundation
import Supabase
import Testing
import CoachCalCore
@testable import CoachCalNetworking

@Suite(.serialized)
struct SupabaseSyncTransportTests {
  @Test
  func pushCallsSyncPushAndReturnsStrictDecodedAcknowledgements() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 200, json: [
      "accepted": [
        [
          "opId": operationID.uuidString,
          "serverVersion": 12,
          "acceptedOpId": operationID.uuidString,
          "duplicate": false,
        ]
      ]
    ])
    let transport = SupabaseSyncTransport(client: makeClient())
    let request = try PushRequest(operations: [makeOperation()])

    let response = try await transport.push(request)

    let recorded = try #require(RecordingURLProtocol.requests.first)
    #expect(recorded.url?.path == "/rest/v1/rpc/sync_push")
    let body = try #require(
      JSONSerialization.jsonObject(with: try requestBody(recorded)) as? [String: Any]
    )
    let operations = try #require(body["p_ops"] as? [[String: Any]])
    #expect(operations.count == 1)
    #expect(operations.first?["opId"] as? String == operationID.uuidString)
    #expect(response.accepted.map(\.opId) == [operationID])
  }

  @Test
  func pullCallsSyncPullAndReturnsStrictDecodedRows() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 200, json: [
      "rows": [
        [
          "table": "diary_entries",
          "recordId": recordID.uuidString,
          "snapshot": [
            "id": recordID.uuidString,
            "displayText": "Pulled",
            "deletedAt": nil,
            "serverVersion": 12,
            "acceptedOpId": operationID.uuidString,
          ],
        ]
      ],
      "cursor": 12,
    ])
    let transport = SupabaseSyncTransport(client: makeClient())

    let response = try await transport.pull(cursor: 0)

    let recorded = try #require(RecordingURLProtocol.requests.first)
    #expect(recorded.url?.path == "/rest/v1/rpc/sync_pull")
    let body = try #require(
      JSONSerialization.jsonObject(with: try requestBody(recorded)) as? [String: Any]
    )
    #expect(body["p_cursor"] as? Int == 0)
    #expect(response.cursor == 12)
    #expect(response.rows.map(\.recordId) == [recordID])
  }

  @Test
  func rpcFailureSurfacesAsSyncTransportError() async throws {
    RecordingURLProtocol.reset()
    RecordingURLProtocol.respond(with: 400, json: [
      "code": "42501",
      "message": "operation targets a record owned by another user",
    ])
    let transport = SupabaseSyncTransport(client: makeClient())
    let request = try PushRequest(operations: [makeOperation()])

    do {
      _ = try await transport.push(request)
      Issue.record("Expected sync_push failure")
    } catch {
      #expect(error is SyncTransportError)
    }
  }

  private let operationID = UUID(uuidString: "826FA3C6-D8A7-4405-B28B-9DBCD75BC4C5")!
  private let recordID = UUID(uuidString: "26277672-8328-4B1A-9B77-C2DA2631F63C")!

  private func makeOperation() -> SyncOperation {
    SyncOperation(
      opId: operationID,
      table: .diaryEntries,
      recordId: recordID,
      kind: .upsert,
      snapshot: DiaryEntrySnapshot(
        id: recordID,
        displayText: "Transport",
        deletedAt: nil,
        serverVersion: 0,
        acceptedOpId: nil
      ),
      clientTimestamp: Date(timeIntervalSince1970: 1_768_300_000)
    )
  }

  private func makeClient() -> SupabaseClient {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [RecordingURLProtocol.self]
    return SupabaseClient(
      supabaseURL: URL(string: "https://project-ref.supabase.co")!,
      supabaseKey: "local-test-key",
      options: SupabaseClientOptions(
        auth: .init(storage: EmptyLocalStorage()),
        global: .init(session: URLSession(configuration: configuration))
      )
    )
  }

  private func requestBody(_ request: URLRequest) throws -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var body = Data()
    let bufferSize = 1024
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
    defer { buffer.deallocate() }
    while stream.hasBytesAvailable {
      let read = stream.read(buffer, maxLength: bufferSize)
      if read <= 0 { break }
      body.append(buffer, count: read)
    }
    return body
  }
}

private final class EmptyLocalStorage: AuthLocalStorage, @unchecked Sendable {
  func store(key: String, value: Data) throws {}
  func retrieve(key: String) throws -> Data? { nil }
  func remove(key: String) throws {}
}

private final class RecordingURLProtocol: URLProtocol {
  nonisolated(unsafe) private static var _requests: [URLRequest] = []
  nonisolated(unsafe) private static var response = (200, Data())

  static var requests: [URLRequest] {
    get { _requests }
    set { _requests = newValue }
  }

  static func reset() {
    _requests = []
    response = (200, Data())
  }

  static func respond(with status: Int, json: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: json)
    response = (status, data)
  }

  static var requestCount: Int { requests.count }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canInit(with task: URLSessionTask) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    Self._requests.append(request)
    let (status, data) = Self.response
    let response = HTTPURLResponse(
      url: request.url!,
      statusCode: status,
      httpVersion: "HTTP/1.1",
      headerFields: [
        "Content-Type": "application/json",
        "Content-Length": String(data.count),
      ]
    )!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: data)
    client?.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}
