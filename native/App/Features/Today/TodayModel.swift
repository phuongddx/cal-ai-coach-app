import CoachCalDesignSystem
import CoachCalPersistence
import Foundation
import GRDB
import Observation

@MainActor
@Observable
final class TodayModel {
  struct MealRow: Identifiable, Equatable, Sendable {
    let id: UUID
    let title: String
    let mealSlot: String
    let kcal: Int?
    let grams: Int?
    let proteinG: Double?
    let carbsG: Double?
    let fatG: Double?
    let fiberG: Double?
    let confidence: Double?
    let isSynced: Bool
    let loggedAt: Date
  }

  struct Snapshot: Equatable, Sendable {
    var target: UserTarget?
    var meals: [MealRow] = []
  }

  private(set) var snapshot = Snapshot()

  private let pool: DatabasePool
  private let userId: UUID
  private let now: @Sendable () -> Date
  // Task.cancel() is thread-safe; deinit runs nonisolated (Pitfall 1).
  nonisolated(unsafe) private var observationTask: Task<Void, Never>?

  init(
    pool: DatabasePool,
    userId: UUID,
    now: @escaping @Sendable () -> Date
  ) {
    self.pool = pool
    self.userId = userId
    self.now = now
    startObservation()
  }

  deinit {
    observationTask?.cancel()
  }

  var consumedKcal: Int {
    snapshot.meals.compactMap(\.kcal).reduce(0, +)
  }

  var today: Date { now() }

  var dayProgress: Double {
    let calendar = Calendar.current
    let startOfDay = calendar.startOfDay(for: now())
    return now().timeIntervalSince(startOfDay) / 86_400
  }

  var goalKcal: Int? {
    snapshot.target?.dailyKcal
  }

  func consumedMacro(_ macro: CCMacroBar.Macro) -> Double {
    snapshot.meals.reduce(0) { total, meal in
      let value: Double?
      switch macro {
      case .protein: value = meal.proteinG
      case .carbs: value = meal.carbsG
      case .fat: value = meal.fatG
      case .fiber: value = meal.fiberG
      }
      return total + (value ?? 0)
    }
  }

  func goalMacro(_ macro: CCMacroBar.Macro) -> Double {
    guard let target = snapshot.target else { return 0 }
    return switch macro {
    case .protein: Double(target.proteinG)
    case .carbs: Double(target.carbsG)
    case .fat: Double(target.fatG)
    case .fiber: Double(target.fiberGoalG)
    }
  }


  private func startObservation() {
    let day = Self.dayString(now())
    let userId = self.userId
    let observation = ValueObservation.tracking { database -> TodayModel.Snapshot in
      let target = try UserTarget
        .filter(Column("user_id") == userId)
        .order(Column("updated_at").desc)
        .fetchOne(database)
      let rows = try Row.fetchAll(
        database,
        sql: """
          SELECT e.id AS entry_id, d.title AS title, d.meal_slot AS meal_slot,
                 d.kcal AS kcal, d.grams AS grams, d.protein_g AS protein_g,
                 d.carbs_g AS carbs_g, d.fat_g AS fat_g, d.fiber_g AS fiber_g,
                 d.confidence AS confidence,
                 (e.accepted_op_id IS NOT NULL) AS is_synced, e.created_at AS created_at
          FROM diary_entries e
          JOIN diary_entry_details d ON d.entry_id = e.id
          WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at) = ?
          ORDER BY e.created_at
          """,
        arguments: [userId, day]
      )
      let meals = rows.map { row -> TodayModel.MealRow in
        MealRow(
          id: row["entry_id"],
          title: row["title"],
          mealSlot: row["meal_slot"],
          kcal: row["kcal"],
          grams: row["grams"],
          proteinG: row["protein_g"],
          carbsG: row["carbs_g"],
          fatG: row["fat_g"],
          fiberG: row["fiber_g"],
          confidence: row["confidence"],
          isSynced: row["is_synced"],
          loggedAt: row["created_at"]
        )
      }
      return Snapshot(target: target, meals: meals)
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
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
  }
}
