import CoachCalCore
import CoachCalPersistence
import Foundation
import GRDB
import Observation

@MainActor
@Observable
final class DiaryDayModel {
  struct FoodItem: Identifiable, Equatable, Sendable {
    let id: UUID
    let title: String
    let mealSlot: String
    let kcal: Int?
    let grams: Int?
    let confidence: Double?
    let isSynced: Bool
    let loggedAt: Date
    // Full mirror row kept so the delete path can tombstone without a re-read.
    let entry: DiaryEntry
  }

  struct MealSection: Identifiable, Equatable {
    let slot: String
    let items: [FoodItem]
    var id: String { slot }
  }

  struct ExerciseRow: Identifiable, Equatable {
    let id: UUID
    let type: String
    let durationMin: Int
    let kcalBurned: Int?
  }

  struct Snapshot: Equatable {
    var target: UserTarget?
    var sections: [MealSection] = []
    var exercises: [ExerciseRow] = []
  }

  static let slotOrder = ["breakfast", "lunch", "dinner", "snacks"]

  private(set) var snapshot = Snapshot()
  private(set) var day: Date

  private let pool: DatabasePool
  private let userId: UUID
  private let now: @Sendable () -> Date
  nonisolated(unsafe) private var observationTask: Task<Void, Never>?

  init(pool: DatabasePool, userId: UUID, day: Date, now: @escaping @Sendable () -> Date) {
    self.pool = pool
    self.userId = userId
    self.day = day
    self.now = now
    startObservation()
  }

  deinit {
    observationTask?.cancel()
  }

  var dayHeading: String {
    day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
  }

  var isToday: Bool {
    Calendar.current.isDate(day, inSameDayAs: now())
  }

  // Eaten/Goal/Left summary — details are the kcal authority (written only via
  // KcalArithmetic); the model sums them, never re-derives from fixtures.
  var eatenKcal: Int {
    snapshot.sections.reduce(0) { $0 + $1.items.compactMap(\.kcal).reduce(0, +) }
  }

  var goalKcal: Int? {
    snapshot.target?.dailyKcal
  }

  var leftKcal: Int? {
    guard let goal = goalKcal else { return nil }
    return max(goal - eatenKcal, 0)
  }

  func sectionKcal(_ section: MealSection) -> Int {
    section.items.compactMap(\.kcal).reduce(0, +)
  }

  func items(in slot: String) -> [FoodItem] {
    snapshot.sections.first { $0.slot == slot }?.items ?? []
  }

  func selectDay(_ date: Date) {
    guard !Calendar.current.isDate(date, inSameDayAs: day) else { return }
    day = date
    startObservation()
  }

  func delete(_ item: FoodItem) async throws {
    // Tombstone (not hard delete) keeps the sync history; the detail row goes
    // with it. Both writes are local; outbox dispatch is wired in Phase 4.
    _ = try await DiaryEntryRepository(database: pool).recordTombstone(
      item.entry,
      now: now()
    )
    try await DiaryDetailRepository(database: pool).delete(entryId: item.id)
  }

  // Undo path: tombstone by id without needing the observed FoodItem.
  func deleteEntry(id: UUID) async throws {
    let entryId = id
    guard let entry = try await pool.read({ database in
      try DiaryEntry.fetchOne(database, key: entryId)
    }) else { return }
    _ = try await DiaryEntryRepository(database: pool).recordTombstone(entry, now: now())
    try await DiaryDetailRepository(database: pool).delete(entryId: id)
  }

  func addExercise(type: String, durationMin: Int, kcalBurned: Int?) async throws {
    let log = ExerciseLog(
      id: UUID(),
      userId: userId,
      day: Self.dayString(day),
      exerciseType: type,
      durationMin: durationMin,
      kcalBurned: kcalBurned,
      createdAt: now()
    )
    try await TrackingRepository(database: pool).addExercise(log)
  }

  private func startObservation() {
    observationTask?.cancel()
    let dayString = Self.dayString(day)
    let userId = self.userId
    let observation = ValueObservation.tracking { database -> DiaryDayModel.Snapshot in
      let target = try UserTarget
        .filter(Column("user_id") == userId)
        .order(Column("updated_at").desc)
        .fetchOne(database)
      let rows = try Row.fetchAll(
        database,
        sql: """
          SELECT e.id AS entry_id, e.user_id AS user_id, e.display_text AS display_text,
                 e.created_at AS created_at, e.updated_at AS updated_at, e.deleted_at AS deleted_at,
                 e.server_version AS server_version, e.accepted_op_id AS accepted_op_id,
                 e.server_updated_at AS server_updated_at,
                 d.title AS title, d.meal_slot AS meal_slot, d.kcal AS kcal, d.grams AS grams,
                 d.confidence AS confidence,
                 (e.accepted_op_id IS NOT NULL) AS is_synced
          FROM diary_entries e
          JOIN diary_entry_details d ON d.entry_id = e.id
          WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at, 'localtime') = ?
          ORDER BY e.created_at
          """,
        arguments: [userId, dayString]
      )
      var bySlot: [String: [DiaryDayModel.FoodItem]] = [:]
      for row in rows {
        let entry = DiaryEntry(
          id: row["entry_id"],
          userId: row["user_id"],
          displayText: row["display_text"],
          createdAt: row["created_at"],
          updatedAt: row["updated_at"],
          deletedAt: row["deleted_at"],
          serverVersion: row["server_version"],
          acceptedOpId: row["accepted_op_id"],
          serverUpdatedAt: row["server_updated_at"]
        )
        let item = FoodItem(
          id: row["entry_id"],
          title: row["title"],
          mealSlot: row["meal_slot"],
          kcal: row["kcal"],
          grams: row["grams"],
          confidence: row["confidence"],
          isSynced: row["is_synced"],
          loggedAt: row["created_at"],
          entry: entry
        )
        bySlot[item.mealSlot, default: []].append(item)
      }
      let sections = Self.slotOrder.map { slot in
        MealSection(slot: slot, items: bySlot[slot] ?? [])
      }
      let exercises = try ExerciseLog
        .filter(Column("day") == dayString)
        .order(Column("created_at"))
        .fetchAll(database)
        .map { DiaryDayModel.ExerciseRow(
          id: $0.id,
          type: $0.exerciseType,
          durationMin: $0.durationMin,
          kcalBurned: $0.kcalBurned
        ) }
      return Snapshot(target: target, sections: sections, exercises: exercises)
    }

    observationTask = Task { [weak self] in
      guard let pool = self?.pool else { return }
      do {
        for try await fresh in observation.values(in: pool) {
          self?.snapshot = fresh
        }
      } catch {
        // Observation cancelled or pool closed; keep the last snapshot.
      }
    }
  }

  static func dayString(_ date: Date) -> String {
    DayKey.string(for: date)
  }
}
