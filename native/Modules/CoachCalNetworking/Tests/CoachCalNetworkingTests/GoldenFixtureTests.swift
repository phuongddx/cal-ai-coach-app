import Foundation
import Testing
import CoachCalCore

@Suite
struct GoldenFixtureTests {
  private let decoder = JSONDecoder()

  @Test
  func livePushAndPullFixturesDecodeStrictly() throws {
    let pushRequest = try decodeFixture("sync_push_request", PushRequest.self)
    let pushResponse = try decodeFixture("sync_push_response", PushResponse.self)
    let pullResponse = try decodeFixture("sync_pull_response", PullResponse.self)

    #expect(!pushRequest.operations.isEmpty)
    try pushResponse.validateAcknowledgementSet(against: pushRequest.operations)
    #expect(pullResponse.cursor >= pullResponse.rows.map(\.snapshot.serverVersion).max() ?? 0)
  }

  @Test
  func pushFixtureRejectsUnknownMissingWrongTypeAndForeignAcks() throws {
    let fixture = try readFixture("sync_push_response")

    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PushResponse.self,
        from: mutatedFixture(fixture) { $0["unknownKey"] = true }
      )
    }
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PushResponse.self,
        from: mutatedFixture(fixture) { $0.removeValue(forKey: "accepted") }
      )
    }
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PushResponse.self,
        from: mutatedFixture(fixture) { $0["accepted"] = "not-an-array" }
      )
    }

    let request = try decodeFixture("sync_push_request", PushRequest.self)
    var foreignObject = try rootObject(fixture)
    var acknowledgements = try #require(
      foreignObject["accepted"] as? [[String: Any]],
      "accepted is not an acknowledgement array"
    )
    acknowledgements[0] = try replacementAcknowledgement(acknowledgements[0])
    foreignObject["accepted"] = acknowledgements
    let foreign = try JSONSerialization.data(withJSONObject: foreignObject)
    let foreignResponse = try decoder.decode(PushResponse.self, from: foreign)
    #expect(throws: DecodingError.self) {
      try foreignResponse.validateAcknowledgementSet(against: request.operations)
    }
  }

  @Test
  func pullFixtureRejectsUnknownMissingAndWrongTypes() throws {
    let fixture = try readFixture("sync_pull_response")

    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PullResponse.self,
        from: mutatedFixture(fixture) { $0["unknownKey"] = true }
      )
    }
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PullResponse.self,
        from: mutatedFixture(fixture) { $0.removeValue(forKey: "rows") }
      )
    }
    #expect(throws: DecodingError.self) {
      try decoder.decode(
        PullResponse.self,
        from: mutatedFixture(fixture) { $0["cursor"] = "not-an-int" }
      )
    }
  }

  private func readFixture(_ name: String) throws -> Data {
    let fixturesDirectory = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appendingPathComponent("Fixtures", isDirectory: true)
    return try Data(contentsOf: fixturesDirectory.appendingPathComponent("\(name).golden.json"))
  }

  private func decodeFixture<T: Decodable>(_ name: String, _ type: T.Type) throws -> T {
    try decoder.decode(type, from: readFixture(name))
  }

  private func mutatedFixture(
    _ data: Data,
    mutation: (inout [String: Any]) -> Void
  ) throws -> Data {
    var object = try rootObject(data)
    mutation(&object)
    return try JSONSerialization.data(withJSONObject: object)
  }

  private func rootObject(_ data: Data) throws -> [String: Any] {
    try #require(
      JSONSerialization.jsonObject(with: data) as? [String: Any],
      "Fixture root is not an object"
    )
  }

  private func replacementAcknowledgement(_ acknowledgement: Any) throws -> [String: Any] {
    var replacement = try #require(
      acknowledgement as? [String: Any],
      "Acknowledgement is not an object"
    )
    replacement["opId"] = UUID().uuidString
    return replacement
  }
}
