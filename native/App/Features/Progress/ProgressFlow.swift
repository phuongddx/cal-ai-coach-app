import CoachCalCore
import CoachCalDesignSystem
import CoachCalPersistence
import GRDB
import Observation
import SwiftUI

@MainActor
@Observable
final class ProgressModel {
  struct DayKcal: Identifiable, Equatable, Sendable {
    let day: String
    let kcal: Int?

    var id: String { day }
  }

  struct Snapshot: Equatable, Sendable {
    var target: UserTarget?
    var weights: [WeightLog] = []
    var weekKcals: [DayKcal] = []
    var streak: StreakState?
    var badges: [Badge] = []
    var diaryDays: Set<String> = []
  }

  private(set) var snapshot = Snapshot()

  private let pool: DatabasePool
  private let userId: UUID
  private let tracking: TrackingRepository
  private let engagement: EngagementRepository
  let now: @Sendable () -> Date
  // Task.cancel() is thread-safe; deinit runs nonisolated (Pitfall 1).
  nonisolated(unsafe) private var observationTask: Task<Void, Never>?

  init(
    pool: DatabasePool,
    userId: UUID,
    tracking: TrackingRepository,
    engagement: EngagementRepository,
    now: @escaping @Sendable () -> Date
  ) {
    self.pool = pool
    self.userId = userId
    self.tracking = tracking
    self.engagement = engagement
    self.now = now
    startObservation()
  }

  deinit {
    observationTask?.cancel()
  }

  var weightPoints: [CCChartCard.Point] {
    snapshot.weights.compactMap { log in
      guard let date = Self.date(fromDay: log.day) else { return nil }
      return CCChartCard.Point(date: date, value: log.kg, label: log.day)
    }
  }

  var latestKg: Double? {
    snapshot.weights.last?.kg
  }

  var goalKg: Double? {
    snapshot.target?.goalWeightKg
  }

  var startKg: Double? {
    snapshot.weights.first?.kg
  }

  var weekKcals: [DayKcal] {
    snapshot.weekKcals
  }

  var targetKcal: Int? {
    snapshot.target?.dailyKcal
  }

  // T-P06-02: the wheel offers 40–250 in 0.1 steps, but untrusted numeric
  // input clamps (and snaps to one decimal) at this model boundary.
  static let kgRange = 40.0...250.0

  static func clampKg(_ kg: Double) -> Double {
    let clamped = min(max(kg, kgRange.lowerBound), kgRange.upperBound)
    return (clamped * 10).rounded() / 10
  }

  func logWeight(_ kg: Double) async throws {
    let log = WeightLog(
      id: UUID(),
      userId: userId,
      day: Self.dayString(now(), calendar: Self.databaseCalendar),
      kg: Self.clampKg(kg),
      createdAt: now()
    )
    try await tracking.addWeight(log)
  }

  private func startObservation() {
    observationTask?.cancel()
    let userId = self.userId
    let calendar = Self.databaseCalendar
    let now = now()
    let weekStart = Self.dayString(
      calendar.date(byAdding: .day, value: -6, to: now)!,
      calendar: calendar
    )
    let monthStart = Self.dayString(
      calendar.date(byAdding: .day, value: -29, to: now)!,
      calendar: calendar
    )
    let observation = ValueObservation.tracking { database -> ProgressModel.Snapshot in
      let target = try UserTarget
        .filter(Column("user_id") == userId)
        .order(Column("updated_at").desc)
        .fetchOne(database)
      let weights = try WeightLog
        .filter(Column("user_id") == userId)
        .order(Column("day").desc, Column("created_at").desc)
        .limit(50)
        .fetchAll(database)
      let streak = try StreakState.fetchOne(database)
      let badges = try Badge
        .filter(Column("user_id") == userId)
        .order(Column("code"))
        .fetchAll(database)
      let kcalRows = try Row.fetchAll(
        database,
        sql: """
          SELECT date(e.created_at, 'localtime') AS day, COALESCE(SUM(d.kcal), 0) AS kcal
          FROM diary_entries e
          JOIN diary_entry_details d ON d.entry_id = e.id
          WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at, 'localtime') >= ?
          GROUP BY day
          """,
        arguments: [userId, weekStart]
      )
      let kcalByDay = Dictionary(
        uniqueKeysWithValues: kcalRows.map { (row: Row) -> (String, Int) in
          (row["day"], row["kcal"])
        }
      )
      let weekKcals = (0..<7).reversed().map { offset -> DayKcal in
        let day = Self.dayString(
          calendar.date(byAdding: .day, value: -offset, to: now)!,
          calendar: calendar
        )
        return DayKcal(day: day, kcal: kcalByDay[day])
      }
      let diaryDays = Set(
        try String.fetchAll(
          database,
          sql: """
            SELECT DISTINCT date(e.created_at, 'localtime') FROM diary_entries e
            WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at, 'localtime') >= ?
            """,
          arguments: [userId, monthStart]
        )
      )
      return Snapshot(
        target: target,
        weights: weights.reversed(),
        weekKcals: weekKcals,
        streak: streak,
        badges: badges,
        diaryDays: diaryDays
      )
    }

    observationTask = Task { [weak self] in
      guard let pool = self?.pool else { return }
      do {
        for try await fresh in observation.values(in: pool) {
          self?.snapshot = fresh
          await self?.reconcileStreak()
        }
      } catch {
        // Observation cancelled or pool closed; keep the last snapshot.
      }
    }
  }

  // ENG-01: recompute the streak from the observed diary day-set + persisted
  // state; persist through EngagementRepository whenever the outcome changes.
  // The diary day-set is a trailing-window observation, so while the persisted
  // streak is still alive (lastLoggedDay yesterday-or-today) it stays the
  // floor for the current streak.
  private func reconcileStreak() async {
    guard let persisted = snapshot.streak else { return }
    let calendar = Self.databaseCalendar
    let today = Self.dayString(now(), calendar: calendar)
    let yesterday = Self.dayString(
      calendar.date(byAdding: .day, value: -1, to: now())!,
      calendar: calendar
    )
    let outcome = StreakEngine.evaluate(
      StreakInput(
        loggedDays: snapshot.diaryDays,
        freezesLeft: persisted.freezesLeft,
        bestStreak: persisted.bestStreak,
        freezeUsedOn: persisted.freezeUsedOn,
        now: now(),
        calendar: calendar
      )
    )
    let alive = persisted.lastLoggedDay == today || persisted.lastLoggedDay == yesterday
    let updated = StreakState(
      id: persisted.id,
      currentStreak: alive ? max(outcome.currentStreak, persisted.currentStreak) : outcome.currentStreak,
      bestStreak: max(persisted.bestStreak, outcome.bestStreak),
      freezesLeft: outcome.freezesLeft,
      freezeUsedOn: outcome.freezeUsedOn,
      lastLoggedDay: snapshot.diaryDays.max() ?? persisted.lastLoggedDay
    )
    if updated != persisted {
      try? await engagement.saveStreakState(updated)
    }
  }

  // Local calendar so day keys agree with the 'localtime' SQL grouping and
  // the app's Today/week-strip convention.
  static var databaseCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone.current
    return calendar
  }

  static func dayString(_ date: Date, calendar: Calendar) -> String {
    DayKey.string(for: date, calendar: calendar)
  }

  static func date(fromDay day: String) -> Date? {
    let parts = day.split(separator: "-")
    guard parts.count == 3, let year = Int(parts[0]), let month = Int(parts[1]),
      let dayNumber = Int(parts[2])
    else { return nil }
    var components = DateComponents()
    components.year = year
    components.month = month
    components.day = dayNumber
    return databaseCalendar.date(from: components)
  }
}

struct ProgressFlow: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: ProgressModel?

  var body: some View {
    NavigationStack {
      if let model {
        ScrollView {
          VStack(alignment: .leading, spacing: CCSpace.lg) {
            Text("Progress")
              .ccFont(.title)
              .foregroundStyle(Color.ccTextPrimary)
            WeightTrendView(model: model)
            WeeklyEnergyView(model: model)
            AchievementsView(model: model)
          }
          .padding(CCSpace.lg)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color.ccBackground)
      } else {
        Color.ccBackground.overlay(ProgressView())
      }
    }
    .task {
      if model == nil {
        model = ProgressModel(
          pool: environment.database,
          userId: AppEnvironment.demoUserId,
          tracking: environment.trackingRepository,
          engagement: environment.engagementRepository,
          now: environment.now
        )
      }
    }
  }
}
