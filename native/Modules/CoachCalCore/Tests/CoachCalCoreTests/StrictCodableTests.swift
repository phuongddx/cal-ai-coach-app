import Foundation
import Testing

@testable import CoachCalCore

@Suite
struct StrictCodableTests {
  private func makeSnapshot(
    id: UUID = UUID(uuidString: "B07537F5-5709-45FA-B4C6-20CB5F0F1A1F")!,
    displayText: String = "Oatmeal",
    deletedAt: Date? = nil,
    serverVersion: Int = 7,
    acceptedOpId: UUID? = nil
  ) -> DiaryEntrySnapshot {
    DiaryEntrySnapshot(
      id: id,
      displayText: displayText,
      deletedAt: deletedAt,
      serverVersion: serverVersion,
      acceptedOpId: acceptedOpId
    )
  }

  private func makeOperation(opId: UUID = UUID()) -> SyncOperation {
    SyncOperation(
      opId: opId,
      table: .diaryEntries,
      recordId: UUID(uuidString: "40604E0E-D515-4AC1-B4F8-79B83FA4B740")!,
      kind: .upsert,
      snapshot: makeSnapshot(),
      clientTimestamp: Date(timeIntervalSince1970: 1_768_300_000)
    )
  }

  @Test
  func snapshotRequiresEveryKeyAndRejectsUnknownKeys() throws {
    let decoder = JSONDecoder()
    let id = "B07537F5-5709-45FA-B4C6-20CB5F0F1A1F"

    let missingDisplay = """
      {"id":"\(id)","deletedAt":null,"serverVersion":7,"acceptedOpId":null}
      """
    #expect(throws: DecodingError.self) {
      try decoder.decode(DiaryEntrySnapshot.self, from: Data(missingDisplay.utf8))
    }

    let missingAccepted = """
      {"id":"\(id)","displayText":"Oatmeal","deletedAt":null,"serverVersion":7}
      """
    #expect(throws: DecodingError.self) {
      try decoder.decode(DiaryEntrySnapshot.self, from: Data(missingAccepted.utf8))
    }

    let unknownUser = """
      {"id":"\(id)","displayText":"Oatmeal","deletedAt":null,"serverVersion":7,"acceptedOpId":null,"userId":"foreign"}
      """
    #expect(throws: DecodingError.self) {
      try decoder.decode(DiaryEntrySnapshot.self, from: Data(unknownUser.utf8))
    }

    let offset = "2026-09-13T14:37:00+07:00"
    let formatter = ISO8601DateFormatter()
    let expectedDate = formatter.date(from: offset)
    let valid = """
      {"id":"\(id)","displayText":"Oatmeal","deletedAt":"\(offset)","serverVersion":7,"acceptedOpId":null}
      """
    let decoded = try decoder.decode(DiaryEntrySnapshot.self, from: Data(valid.utf8))
    #expect(decoded.deletedAt == expectedDate)
  }

  @Test
  func pushResponseAcknowledgementSetMustMatchSubmittedOperationsExactly() throws {
    let firstOp = UUID(uuidString: "41BCA976-477B-4405-8523-2C6F98E2B4F7")!
    let secondOp = UUID(uuidString: "2947D66A-F80B-42DA-8951-679B9B2A5D48")!
    let operations = [makeOperation(opId: firstOp), makeOperation(opId: secondOp)]

    func response(_ acknowledgements: [PushAcknowledgement]) -> PushResponse {
      PushResponse(accepted: acknowledgements)
    }

    #expect(throws: Never.self) {
      try response([ack(opId: firstOp), ack(opId: secondOp)])
        .validateAcknowledgementSet(against: operations)
    }
    #expect(throws: DecodingError.self) {
      try response([ack(opId: firstOp), ack(opId: secondOp), ack(opId: secondOp)])
        .validateAcknowledgementSet(against: operations)
    }
    #expect(throws: DecodingError.self) {
      try response([ack(opId: firstOp)])
        .validateAcknowledgementSet(against: operations)
    }
    #expect(throws: DecodingError.self) {
      try response([ack(opId: firstOp), ack(opId: secondOp)])
        .validateAcknowledgementSet(against: [makeOperation(opId: firstOp)])
    }
    #expect(throws: Never.self) {
      try response([ack(opId: firstOp), ack(opId: secondOp)])
        .validateAcknowledgementSet(against: operations)
    }
  }

  @Test
  func pushRequestRequiresNonEmptyUniqueOperationsAndRoundTrips() throws {
    let duplicateOperation = makeOperation()
    #expect(throws: DecodingError.self) {
      try PushRequest(operations: [])
    }
    #expect(throws: DecodingError.self) {
      try PushRequest(operations: [duplicateOperation, duplicateOperation])
    }

    let operations = [makeOperation()]
    let request = try PushRequest(operations: operations)
    let data = try JSONEncoder().encode(request)
    let decoded = try JSONDecoder().decode(PushRequest.self, from: data)
    #expect(decoded == request)
    #expect(decoded.operations == operations)
  }

  @Test
  func syncTransportSurfaceIsAvailableAndSendable() async throws {
    final class Transport: SyncTransport {
      func push(_ request: PushRequest) async throws -> PushResponse {
        PushResponse(
          accepted: request.operations.map { op in
            PushAcknowledgement(
              opId: op.opId,
              serverVersion: 1,
              acceptedOpId: op.opId,
              duplicate: false
            )
          }
        )
      }

      func pull(cursor: Int) async throws -> PullResponse {
        try PullResponse(rows: [], cursor: cursor)
      }
    }

    let transport: any SyncTransport = Transport()
    let response = try await transport.push(try PushRequest(operations: [makeOperation()]))
    let pulled = try await transport.pull(cursor: 0)
    #expect(response.accepted.count == 1)
    #expect(pulled.rows.isEmpty)
  }

  private func ack(opId: UUID) -> PushAcknowledgement {
    PushAcknowledgement(
      opId: opId,
      serverVersion: 1,
      acceptedOpId: opId,
      duplicate: false
    )
  }
}
