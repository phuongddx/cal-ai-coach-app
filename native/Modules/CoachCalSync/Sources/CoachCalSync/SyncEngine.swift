import Foundation

import CoachCalCore
import CoachCalPersistence

public struct DispatchResult: Equatable, Sendable {
  public let pushed: Int
  public let acked: Int
  public let pulled: Int
  public let poisoned: Int
  public let cursorAdvanced: Bool

  public static let empty = DispatchResult(
    pushed: 0,
    acked: 0,
    pulled: 0,
    poisoned: 0,
    cursorAdvanced: false
  )
}

public enum SyncEngineError: Error, Equatable, Sendable {
  case notBound
  /// Reported through the error sink when a dispatch finished but left
  /// undecodable ops behind (see `maxOpAttempts`).
  case poisonedOperations(count: Int)
}

/// Owner-bound reconciliation actor.
///
/// A dispatch exposes actor suspension points, so its generation token is
/// re-checked after every awaited repository/transport call. While one run is
/// active, later calls request exactly one trailing rerun instead of pushing a
/// second copy of the same batch.
public actor SyncEngine {
  public static let batchSize = 50
  public static let defaultDebounceInterval: Duration = .milliseconds(500)
  /// Decode failures are deterministic; after this many attempts the op is
  /// dead-lettered instead of occupying a batch slot forever.
  public static let maxOpAttempts = 5

  private let transport: any SyncTransport
  private let outbox: OutboxRepository
  private let merge: SyncMergeRepository
  private let now: @Sendable () -> Date
  private let debounceInterval: Duration

  private var owner: UUID?
  private var stopped = false
  private var dispatchGeneration = 0
  private var isDispatching = false
  private var trailingDispatchRequested = false
  private var drainWaiters: [CheckedContinuation<Void, Never>] = []
  private var isDraining = false
  private var debounceTask: Task<Void, Never>?
  private var debounceGeneration = 0
  private var errorSink: (@Sendable (any Error) -> Void)?

  public init(
    debounceInterval: Duration = SyncEngine.defaultDebounceInterval,
    transport: any SyncTransport,
    outbox: OutboxRepository,
    merge: SyncMergeRepository,
    now: @escaping @Sendable () -> Date = { Date() }
  ) {
    self.debounceInterval = debounceInterval
    self.transport = transport
    self.outbox = outbox
    self.merge = merge
    self.now = now
  }

  /// Stops scheduling and drains any in-flight dispatch before resolving.
  /// A bind attempted while draining waits for that barrier.
  public func stop() async {
    stopped = true
    owner = nil
    dispatchGeneration += 1
    trailingDispatchRequested = false
    debounceTask?.cancel()
    debounceTask = nil

    if isDispatching {
      isDraining = true
      await waitForDispatch()
      isDraining = false
    }
  }

  /// Rebinds only after the previous owner's active dispatch has drained.
  public func bind(_ newOwner: UUID) async {
    await waitForDispatchIfActive()
    debounceTask?.cancel()
    debounceTask = nil
    debounceGeneration += 1
    stopped = false
    owner = newOwner
    dispatchGeneration += 1
    trailingDispatchRequested = false
  }

  public func currentOwner() -> UUID? {
    owner
  }

  /// Trailing-edge mutation debounce. A burst resets the interval, and only
  /// the final scheduled task reaches dispatch.
  public func notifyLocalMutation() {
    guard !stopped, let owner else { return }
    debounceTask?.cancel()
    debounceGeneration += 1
    let generation = debounceGeneration
    let interval = debounceInterval

    debounceTask = Task { [interval] in
      try? await Task.sleep(for: interval)
      await self.fireDebounce(generation: generation, owner: owner)
    }
  }

  /// Observability seam for background-triggered dispatches (debounced local
  /// mutations, foreground, network, BGTask), whose results are not thrown to
  /// any caller.
  public func setOnError(_ handler: (@Sendable (any Error) -> Void)?) {
    errorSink = handler
  }

  private func reportError(_ error: any Error) {
    errorSink?(error)
  }

  private func fireDebounce(generation: Int, owner: UUID) async {
    guard generation == debounceGeneration, !stopped, owner == self.owner else { return }
    do {
      let result = try await dispatch()
      if result.poisoned > 0 {
        reportError(SyncEngineError.poisonedOperations(count: result.poisoned))
      }
    } catch {
      reportError(error)
    }
  }

  public func dispatch() async throws -> DispatchResult {
    if isDispatching {
      trailingDispatchRequested = true
      return .empty
    }

    guard !stopped, let owner else {
      throw SyncEngineError.notBound
    }

    dispatchGeneration += 1
    let generation = dispatchGeneration
    isDispatching = true

    let result: DispatchResult
    do {
      result = try await runDispatch(owner: owner, generation: generation)
    } catch {
      finishDispatch()
      throw error
    }
    finishDispatch()

    if trailingDispatchRequested, !stopped, generation == dispatchGeneration {
      trailingDispatchRequested = false
      let trailing = try await dispatch()
      return result.pushed == 0 ? trailing : result
    }

    return result
  }

  private func runDispatch(
    owner: UUID,
    generation: Int
  ) async throws -> DispatchResult {
    let storedOperations = try await outbox.dueOps(limit: Self.batchSize)
    guard generation == dispatchGeneration else { return .empty }

    var operations: [SyncOperation] = []
    var poisonedCount = 0
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    for stored in storedOperations {
      do {
        let snapshot = try decoder.decode(DiaryEntrySnapshot.self, from: Data(stored.snapshot.utf8))
        guard let table = SyncedTable(rawValue: stored.tableName),
              let kind = MutationKind(rawValue: stored.kind)
        else {
          throw DecodingError.dataCorrupted(
            DecodingError.Context(
              codingPath: [],
              debugDescription: "unsupported sync table or mutation kind"
            )
          )
        }
        let operation = SyncOperation(
          opId: stored.opId,
          table: table,
          recordId: stored.recordId,
          kind: kind,
          snapshot: snapshot,
          clientTimestamp: stored.clientTimestamp
        )
        operations.append(operation)
      } catch {
        poisonedCount += 1
        if stored.dispatchAttempts + 1 >= Self.maxOpAttempts {
          try await outbox.quarantine(opId: stored.opId)
        } else {
          try await outbox.markFailed(
            opIds: [stored.opId],
            retryAt: now().addingTimeInterval(
              TimeInterval(Backoff.delay(forDispatchAttempts: stored.dispatchAttempts + 1).components.seconds)
            )
          )
        }
        guard generation == dispatchGeneration else { return .empty }
      }
    }

    var ackedCount = 0
    if !operations.isEmpty {
      let request: PushRequest
      let response: PushResponse
      do {
        request = try PushRequest(operations: operations)
        response = try await transport.push(request)
        guard generation == dispatchGeneration else { return .empty }

        // No response mutation is allowed until the complete submitted/acknowledged
        // identity set matches. Core owns this exact-set integrity check.
        try response.validateAcknowledgementSet(against: request.operations)
      } catch {
        try await markBatchFailed(
          operations,
          attempts: storedOperations.map(\.dispatchAttempts),
          error: error,
          generation: generation
        )
        throw error
      }

      do {
        let oldCursor = try await readCursor()
        let outcome = try await merge.apply(
          acknowledgements: response.accepted,
          pull: .init(rows: [], cursor: oldCursor),
          owner: owner,
          now: now()
        )
        _ = outcome
        ackedCount = response.accepted.count
        guard generation == dispatchGeneration else { return .empty }
        try await outbox.markDispatched(opIds: response.accepted.map(\.opId))
        guard generation == dispatchGeneration else { return .empty }
      } catch {
        try await markBatchFailed(
          operations,
          attempts: storedOperations.map(\.dispatchAttempts),
          error: error,
          generation: generation
        )
        throw error
      }
    }

    let cursor = try await readCursor()
    guard generation == dispatchGeneration else { return .empty }
    let pullResponse = try await transport.pull(cursor: cursor)
    guard generation == dispatchGeneration else { return .empty }

    do {
      let outcome = try await merge.apply(
        acknowledgements: [],
        pull: pullResponse,
        owner: owner,
        now: now()
      )
      guard generation == dispatchGeneration else { return .empty }
      return DispatchResult(
        pushed: operations.count,
        acked: ackedCount,
        pulled: pullResponse.rows.count,
        poisoned: poisonedCount,
        cursorAdvanced: outcome.cursor != cursor || !pullResponse.rows.isEmpty
      )
    } catch {
      throw error
    }
  }

  private func markBatchFailed(
    _ operations: [SyncOperation],
    attempts: [Int],
    error: any Error,
    generation: Int
  ) async throws {
    let attempt = (attempts.max() ?? 0) + 1
    let retryAt = now().addingTimeInterval(
      TimeInterval(Backoff.delay(forDispatchAttempts: attempt).components.seconds)
    )
    try await outbox.markFailed(
      opIds: operations.map(\.opId),
      retryAt: retryAt
    )
    guard generation == dispatchGeneration else { return }
  }

  private func readCursor() async throws -> Int {
    try await merge.readCursor()
  }

  private func finishDispatch() {
    isDispatching = false
    resumeDrainWaiters()
  }

  private func waitForDispatchIfActive() async {
    guard isDispatching || isDraining else { return }
    await waitForDispatch()
  }

  private func waitForDispatch() async {
    await withCheckedContinuation { continuation in
      drainWaiters.append(continuation)
    }
  }

  private func resumeDrainWaiters() {
    let waiters = drainWaiters
    drainWaiters.removeAll()
    waiters.forEach { $0.resume() }
  }

}
