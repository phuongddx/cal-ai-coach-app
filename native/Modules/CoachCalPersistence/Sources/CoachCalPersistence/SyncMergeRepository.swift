import Foundation
import GRDB

import CoachCalCore

public struct SyncMergeOutcome: Equatable, Sendable {
  public let appliedRowCount: Int
  public let cursor: Int

  public init(appliedRowCount: Int, cursor: Int) {
    self.appliedRowCount = appliedRowCount
    self.cursor = cursor
  }
}

/// Applies server acknowledgements and a fully validated pull response in one
/// local transaction. Acknowledged operations are removed atomically with the
/// canonical row bump; the pull cursor advances only after all rows merge.
public struct SyncMergeRepository: Sendable {
  private let database: DatabasePool

  public init(database: DatabasePool) {
    self.database = database
  }

  public func apply(
    acknowledgements: [PushAcknowledgement],
    pull: PullResponse,
    owner: UUID,
    now: Date = Date()
  ) async throws -> SyncMergeOutcome {
    try await database.write { database in
      for acknowledgement in acknowledgements {
        try applyAcknowledgement(acknowledgement, database: database)
      }

      var applied = 0
      for row in pull.rows {
        if try applyPulledRow(row, owner: owner, now: now, database: database) {
          applied += 1
        }
      }

      if var state = try SyncState.fetchOne(database, key: 1) {
        state.pullCursor = Int64(pull.cursor)
        try state.update(database)
      }

      return SyncMergeOutcome(appliedRowCount: applied, cursor: pull.cursor)
    }
  }

  public func readCursor() async throws -> Int {
    try await database.read { database in
      Int(try SyncState.fetchOne(database, key: 1)?.pullCursor ?? 0)
    }
  }

  private func applyAcknowledgement(
    _ acknowledgement: PushAcknowledgement,
    database: GRDB.Database
  ) throws {
    guard let operation = try PendingOp.fetchOne(database, key: acknowledgement.opId) else {
      return
    }

    if let row = try DiaryEntry.fetchOne(database, key: operation.recordId) {
      let ackVersion = version(
        Int64(acknowledgement.serverVersion),
        acknowledgement.acceptedOpId
      )
      let localVersion = version(row.serverVersion, row.acceptedOpId)
      if isNewer(ackVersion, localVersion) {
        var accepted = row
        accepted.serverVersion = Int64(acknowledgement.serverVersion)
        accepted.acceptedOpId = acknowledgement.acceptedOpId
        accepted.updatedAt = Date()
        try accepted.update(database)
      }
    }

    try operation.delete(database)
  }

  private func applyPulledRow(
    _ pulled: PulledRow,
    owner: UUID,
    now: Date,
    database: GRDB.Database
  ) throws -> Bool {
    let recordId = pulled.recordId
    let hasPendingIntent = try PendingOp.filter(sql: "record_id = ?", arguments: [recordId])
      .fetchOne(database) != nil
    if hasPendingIntent {
      return false
    }

    let remote = version(
      Int64(pulled.snapshot.serverVersion),
      pulled.snapshot.acceptedOpId
    )

    if var local = try DiaryEntry.fetchOne(database, key: recordId) {
      let localVersion = version(local.serverVersion, local.acceptedOpId)
      guard isNewer(remote, localVersion) else { return false }

      local.displayText = pulled.snapshot.displayText
      local.deletedAt = pulled.snapshot.deletedAt
      local.serverVersion = Int64(pulled.snapshot.serverVersion)
      local.acceptedOpId = pulled.snapshot.acceptedOpId
      local.updatedAt = now
      local.serverUpdatedAt = now
      try local.update(database)
      return true
    }

    let row = DiaryEntry(
      id: recordId,
      userId: owner,
      displayText: pulled.snapshot.displayText,
      createdAt: now,
      updatedAt: now,
      deletedAt: pulled.snapshot.deletedAt,
      serverVersion: Int64(pulled.snapshot.serverVersion),
      acceptedOpId: pulled.snapshot.acceptedOpId,
      serverUpdatedAt: now
    )
    try row.insert(database)
    return true
  }

  private func version(
    _ serverVersion: Int64,
    _ acceptedOpId: UUID?
  ) -> (version: Int, opId: String) {
    (
      Int(serverVersion),
      acceptedOpId?.uuidString ?? ""
    )
  }

  private func isNewer(
    _ candidate: (version: Int, opId: String),
    _ incumbent: (version: Int, opId: String)
  ) -> Bool {
    if candidate.version != incumbent.version {
      return candidate.version > incumbent.version
    }
    return candidate.opId > incumbent.opId
  }
}
