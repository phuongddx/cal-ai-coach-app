import Foundation
import GRDB

import CoachCalCore
import CoachCalPersistence

enum ProofSupport {
  static func newEntry(owner: UUID, id: UUID = UUID()) -> DiaryEntry {
    let now = Date()
    return DiaryEntry(
      id: id,
      userId: owner,
      displayText: "offline proof",
      createdAt: now,
      updatedAt: now,
      deletedAt: nil,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: now
    )
  }

  static func edited(_ original: DiaryEntry, text: String) -> DiaryEntry {
    var edited = original
    edited.displayText = text
    edited.updatedAt = Date()
    return edited
  }

  static func operation(for pending: PendingOp) throws -> SyncOperation {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return SyncOperation(
      opId: pending.opId,
      table: .diaryEntries,
      recordId: pending.recordId,
      kind: .upsert,
      snapshot: try decoder.decode(
        DiaryEntrySnapshot.self,
        from: Data(pending.snapshot.utf8)
      ),
      clientTimestamp: pending.clientTimestamp
    )
  }
}

