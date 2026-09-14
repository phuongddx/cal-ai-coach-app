import CoachCalDesignSystem
import CoachCalPersistence
import GRDB
import Observation
import SwiftUI

@MainActor
@Observable
final class CoachModel {
  struct WeekStats: Equatable, Sendable {
    var daysLogged: Int = 0
    var daysOnTarget: Int = 0
    var weeksAllLogged: Int = 0
    var kgThisWeek: Double = 0
  }

  private(set) var insights: [Insight] = []
  private(set) var weekStats = WeekStats()
  private(set) var targetKcal: Int?

  private let pool: DatabasePool
  private let userId: UUID
  private let engagement: EngagementRepository
  let now: @Sendable () -> Date
  // Task.cancel() is thread-safe; deinit runs nonisolated (Pitfall 1).
  nonisolated(unsafe) private var observationTask: Task<Void, Never>?

  init(
    pool: DatabasePool,
    userId: UUID,
    engagement: EngagementRepository,
    now: @escaping @Sendable () -> Date
  ) {
    self.pool = pool
    self.userId = userId
    self.engagement = engagement
    self.now = now
    startObservation()
    Task { await refreshInsights() }
  }

  deinit {
    observationTask?.cancel()
  }

  private func startObservation() {
    observationTask?.cancel()
    let userId = self.userId
    let calendar = Self.databaseCalendar
    let today = Self.dayString(now(), calendar: calendar)
    let weekStart = Self.dayString(
      calendar.date(byAdding: .day, value: -6, to: now())!,
      calendar: calendar
    )
    let monthStart = Self.dayString(
      calendar.date(byAdding: .day, value: -27, to: now())!,
      calendar: calendar
    )
    let observation = ValueObservation.tracking { database -> (CoachModel.WeekStats, Int?) in
      let todayDate = calendar.date(from: Self.dayComponents(today))!
      let target = try UserTarget
        .filter(Column("user_id") == userId)
        .order(Column("updated_at").desc)
        .fetchOne(database)

      let kcalRows = try Row.fetchAll(
        database,
        sql: """
          SELECT date(e.created_at) AS day, COALESCE(SUM(d.kcal), 0) AS kcal
          FROM diary_entries e
          JOIN diary_entry_details d ON d.entry_id = e.id
          WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at) >= ?
          GROUP BY day
          """,
        arguments: [userId, weekStart]
      )
      let loggedDays28 = Set(
        try String.fetchAll(
          database,
          sql: """
            SELECT DISTINCT date(e.created_at) FROM diary_entries e
            WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at) >= ?
            """,
          arguments: [userId, monthStart]
        )
      )
      let weekWeights = try WeightLog
        .filter(Column("user_id") == userId)
        .filter(Column("day") >= weekStart)
        .filter(Column("day") <= today)
        .order(Column("day").asc, Column("created_at").asc)
        .fetchAll(database)

      var stats = CoachModel.WeekStats()
      stats.daysLogged = (0..<7).filter { offset in
        let day = Self.dayString(
          calendar.date(byAdding: .day, value: -offset, to: todayDate)!,
          calendar: calendar
        )
        return loggedDays28.contains(day)
      }.count

      let dayKcals: [(day: String, kcal: Int)] = kcalRows.map {
        (day: $0["day"] as String, kcal: $0["kcal"] as Int)
      }
      stats.daysOnTarget = dayKcals.filter { day in
        guard let target else { return false }
        return day.kcal <= target.dailyKcal
      }.count

      // Trailing four weeks: a week qualifies when all 7 of its days are logged.
      stats.weeksAllLogged = (0..<4).filter { week in
        let weekDays = (0..<7).compactMap { dayOffset -> String? in
          guard let date = calendar.date(
            byAdding: .day,
            value: -(week * 7 + dayOffset),
            to: todayDate
          ) else { return nil }
          return Self.dayString(date, calendar: calendar)
        }
        return !weekDays.isEmpty && weekDays.allSatisfy(loggedDays28.contains)
      }.count

      if weekWeights.count >= 2, let first = weekWeights.first, let last = weekWeights.last {
        stats.kgThisWeek = last.kg - first.kg
      }

      return (stats, target?.dailyKcal)
    }

    observationTask = Task { [weak self] in
      guard let pool = self?.pool else { return }
      do {
        for try await (stats, targetKcal) in observation.values(in: pool) {
          self?.weekStats = stats
          self?.targetKcal = targetKcal
          await self?.refreshInsights()
        }
      } catch {
        // Observation cancelled or pool closed; keep the last values.
      }
    }
  }

  // Daily insights flow through EngagementRepository (seeded rows only —
  // no adaptive nudge generation; COA2-01 is v2).
  private func refreshInsights() async {
    let day = Self.dayString(now(), calendar: Self.databaseCalendar)
    insights = (try? await engagement.insights(forDay: day)) ?? []
  }

  static func greeting(for date: Date, calendar: Calendar) -> String {
    switch calendar.component(.hour, from: date) {
    case ..<12:
      "Good morning! 👋"
    case ..<17:
      "Good afternoon! 👋"
    default:
      "Good evening! 👋"
    }
  }

  static var databaseCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
  }

  static func dayString(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  private static func dayComponents(_ day: String) -> DateComponents {
    let parts = day.split(separator: "-")
    var components = DateComponents()
    components.year = Int(parts[0])
    components.month = Int(parts[1])
    components.day = Int(parts[2])
    return components
  }
}

struct CoachFlow: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: CoachModel?

  var body: some View {
    NavigationStack {
      if let model {
        CoachView(
          model: model,
          greeting: CoachModel.greeting(for: environment.now(), calendar: .current)
        )
      } else {
        Color.ccBackground.overlay(ProgressView())
      }
    }
    .task {
      if model == nil {
        model = CoachModel(
          pool: environment.database,
          userId: AppEnvironment.demoUserId,
          engagement: environment.engagementRepository,
          now: environment.now
        )
      }
    }
  }
}
