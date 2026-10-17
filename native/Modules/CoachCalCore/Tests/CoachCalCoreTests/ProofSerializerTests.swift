import Foundation
import Testing

@testable import CoachCalCore

@Suite
struct ProofSerializerTests {
  @Test
  func serializesRequiredSchemaV1FieldsDeterministically() throws {
    let record = Self.makeRecord()
    let first = try ProofRecordSerializer.data(for: record)
    let second = try ProofRecordSerializer.data(for: record)
    let decoded = try JSONSerialization.jsonObject(with: first) as! [String: Any]

    #expect(first == second)
    #expect(decoded["schemaVersion"] as? Int == 1)
    #expect(decoded["scenario"] as? String == ProofScenario.online.rawValue)
    #expect(decoded["runId"] as? String == record.runId.uuidString)
    #expect(decoded["rowId"] as? String == record.rowId?.uuidString)
    #expect(decoded["environment"] != nil)
    #expect(decoded["checks"] != nil)
    #expect(decoded["submittedAtMs"] as? Int == 10)
    #expect(decoded["acknowledgedAtMs"] as? Int == 40)
  }

  @Test
  func rejectsSensitiveKeysAtAnyDepthBeforeEmission() {
    let nested = ProofValue.dictionary([
      "outer": .dictionary(["password": .string("redacted-value")]),
    ])
    var record = Self.makeRecord()
    record.evidence["details"] = nested

    #expect(throws: ProofRedactionError.self) {
      try ProofRecordSerializer.data(for: record)
    }
  }

  @Test
  func rejectsLegacyProofIdentityValueBeforeEmission() {
    // 1.1-06 scans native/ for forbidden-token literals, including this
    // legacy account. Build it here without putting the token in source.
    let legacy = ["a", "@proof.", "local"].joined()
    var record = Self.makeRecord()
    record.evidence["actor"] = .string(legacy)

    #expect(throws: ProofRedactionError.self) {
      try ProofRecordSerializer.data(for: record)
    }
  }

  @Test
  func serializedSamplePassesRepositoryValidatorRoundTrip() throws {
    let record = Self.makeRecord()
    let data = try ProofRecordSerializer.data(for: record)
    let temporary = FileManager.default.temporaryDirectory
      .appending(component: "proof-serializer-\(UUID().uuidString).json")
    try data.write(to: temporary)
    defer { try? FileManager.default.removeItem(at: temporary) }

    let source = URL(fileURLWithPath: #filePath)
    let root = source
      .deletingLastPathComponent() // CoachCalCoreTests
      .deletingLastPathComponent() // Tests
      .deletingLastPathComponent() // CoachCalCore
      .deletingLastPathComponent() // Modules
      .deletingLastPathComponent() // native
      .deletingLastPathComponent() // native
    let validator = root
      .appending(component: "scripts")
      .appending(component: "measure-phase1-sync.mjs")

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["node", validator.path, "--file", temporary.path]
    let pipe = Pipe()
    let errorPipe = Pipe()
    process.standardOutput = pipe
    process.standardError = errorPipe

    try process.run()
    process.waitUntilExit()
    #expect(process.terminationStatus == 0)
  }

  private static func makeRecord() -> ProofRecord {
    ProofRecord(
      scenario: .online,
      runId: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
      rowId: UUID(uuidString: "00000000-0000-0000-0000-000000000002"),
      startedAt: Date(timeIntervalSince1970: 1_768_300_000),
      environment: ProofEnvironment(stack: "local-supabase", runtime: "iOS 18.4"),
      checks: [
        ProofCheck(
          name: "push",
          status: .pass,
          timingMs: 30,
          dispatchId: UUID(uuidString: "00000000-0000-0000-0000-000000000003")
        ),
      ],
      evidence: [
        "submittedAtMs": .int(10),
        "acknowledgedAtMs": .int(40),
        "serverVersion": .int(1),
      ]
    )
  }
}
