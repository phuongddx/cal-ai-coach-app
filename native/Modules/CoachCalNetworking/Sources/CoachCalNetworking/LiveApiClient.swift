import Foundation
import Supabase

/// Injectable telemetry sink: the seam owns observability, the caller
/// decides where events go (mirrors SyncEngine.setOnError) — no analytics
/// SDK call is baked directly into this client.
public struct ScanTelemetryEvent: Equatable, Sendable {
  public let tier: String
  public let durationMs: Int
  public let escalated: Bool

  public init(tier: String, durationMs: Int, escalated: Bool) {
    self.tier = tier
    self.durationMs = durationMs
    self.escalated = escalated
  }
}

// Real Edge-Function-backed CoachCalAPI conformer (Phase 4 flip target).
// Decodes into the SAME ScanResponse FixtureApiClient decodes, and maps a
// non-2xx envelope into the SAME ScanAPIError.envelope FixtureApiClient's
// golden 402/404/422 fixtures produce — Phase 2's wire contract is
// unchanged end to end; ScanModel/ScanRequest/ScanResponse/ScanAPIError
// never change for this conformer.
public struct LiveApiClient: CoachCalAPI, Sendable {
  // Past this, the server almost certainly ran a Tier-2 escalation re-run
  // rather than a merely-slow Tier-1 call — a duration threshold, mirroring
  // ScanModel's own inference, since the wire response carries no tier field.
  private static let escalationThresholdMs = 5_000

  private let client: SupabaseClient
  private let onTelemetry: (@Sendable (ScanTelemetryEvent) -> Void)?

  public init(
    client: SupabaseClient,
    onTelemetry: (@Sendable (ScanTelemetryEvent) -> Void)? = nil
  ) {
    self.client = client
    self.onTelemetry = onTelemetry
  }

  public func analyzeFood(_ request: ScanRequest) async throws -> ScanResponse {
    let startedAt = Date()
    let response: ScanResponse
    do {
      response = try await client.functions.invoke(
        "analyze-food",
        options: FunctionInvokeOptions(body: request)
      )
    } catch let error as FunctionsError {
      // A decodable {error:{code,details,entitlement}} envelope becomes the
      // same typed ScanAPIError the fixture path throws; a relay error or an
      // undecodable body (infra failure, no envelope) rethrows as-is —
      // ScanModel's generic catch already routes any thrown error to
      // .failed(.analysisFailure) safely.
      if case .httpError(_, let data) = error,
        let envelope = try? JSONDecoder().decode(FixtureErrorEnvelope.self, from: data)
      {
        throw ScanAPIError.envelope(
          code: envelope.error.code,
          details: envelope.error.details,
          entitlement: envelope.error.entitlement
        )
      }
      throw error
    }
    let durationMs = Int(Date().timeIntervalSince(startedAt) * 1_000)
    let escalated = durationMs > Self.escalationThresholdMs
    onTelemetry?(
      ScanTelemetryEvent(
        tier: escalated ? "tier2" : "tier1",
        durationMs: durationMs,
        escalated: escalated
      )
    )
    return response
  }
}
