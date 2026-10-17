import Foundation
import Testing

@testable import CoachCalCore

@Suite
struct StreakEngineTests {
  // Fixtures pin a UTC calendar so day strings match the app's diary
  // day-string convention (yyyy-MM-dd, UTC) under a fixed `now`.
  private let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
  }()

  private var now: Date {
    ISO8601DateFormatter().date(from: "2026-09-15T12:00:00Z")!
  }

  private func days(_ offsetsFromToday: [Int]) -> Set<String> {
    Set(offsetsFromToday.map { Self.dayString(offset: $0, now: now, calendar: calendar) })
  }

  private static func dayString(offset: Int, now: Date, calendar: Calendar) -> String {
    let day = calendar.date(byAdding: .day, value: offset, to: now)!
    let parts = calendar.dateComponents([.year, .month, .day], from: day)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
  }

  private func evaluate(
    _ offsets: [Int],
    freezesLeft: Int = 0,
    bestStreak: Int = 0,
    freezeUsedOn: String? = nil
  ) -> StreakOutcome {
    StreakEngine.evaluate(
      StreakInput(
        loggedDays: days(offsets),
        freezesLeft: freezesLeft,
        bestStreak: bestStreak,
        freezeUsedOn: freezeUsedOn,
        now: now,
        calendar: calendar
      )
    )
  }

  @Test
  func consecutiveLoggedDaysEndingTodayCountFully() {
    let outcome = evaluate([-4, -3, -2, -1, 0], freezesLeft: 1, bestStreak: 3)
    #expect(outcome.currentStreak == 5)
    #expect(outcome.bestStreak == 5)
    #expect(outcome.freezesLeft == 1)
    #expect(outcome.freezeUsedOn == nil)
    #expect(!outcome.freezeConsumedToday)
  }

  @Test
  func streakEndingYesterdayStillCountsWhenTodayIsUnlogged() {
    let outcome = evaluate([-4, -3, -2, -1], freezesLeft: 1, bestStreak: 9)
    #expect(outcome.currentStreak == 4)
    #expect(outcome.bestStreak == 9)
  }

  @Test
  func gapWithoutFreezeStartsFreshStreakAtOne() {
    let outcome = evaluate([-7, -6, -5, -4, -3, -2, 0], freezesLeft: 0, bestStreak: 3)
    // "Day 1 streak started!" surfaces from current == 1.
    #expect(outcome.currentStreak == 1)
    #expect(outcome.bestStreak == 3)
    #expect(!outcome.freezeConsumedToday)
  }

  @Test
  func freezeBridgesSingleMissedDayAndIsConsumed() {
    // Seeded-history shape: 12 logged days ending 2 days ago, yesterday
    // missed, today logged, 1 freeze → 12 + today, freeze spent on yesterday.
    let twelveDaysEndingDayBeforeYesterday = Array(-13 ... -2)
    let outcome = evaluate(
      twelveDaysEndingDayBeforeYesterday + [0],
      freezesLeft: 1,
      bestStreak: 12
    )
    #expect(outcome.currentStreak == 13)
    #expect(outcome.freezesLeft == 0)
    #expect(outcome.freezeUsedOn == "2026-09-14")
    #expect(outcome.freezeConsumedToday)
    #expect(outcome.bestStreak == 13)
  }

  @Test
  func freezeUnavailableLeavesTheGapBroken() {
    let twelveDaysEndingDayBeforeYesterday = Array(-13 ... -2)
    let outcome = evaluate(
      twelveDaysEndingDayBeforeYesterday + [0],
      freezesLeft: 0,
      bestStreak: 12,
      freezeUsedOn: nil
    )
    #expect(outcome.currentStreak == 1)
    #expect(outcome.freezeUsedOn == nil)
    #expect(!outcome.freezeConsumedToday)
  }

  @Test
  func bestStreakNeverRegresses() {
    let outcome = evaluate([-1, 0], freezesLeft: 1, bestStreak: 18)
    #expect(outcome.currentStreak == 2)
    #expect(outcome.bestStreak == 18)
  }

  @Test
  func staleHistoryWithoutRecentLogsResetsToZero() {
    let outcome = evaluate([-5, -4], freezesLeft: 0, bestStreak: 7)
    #expect(outcome.currentStreak == 0)
    #expect(outcome.bestStreak == 7)
  }

  @Test
  func freezeIsNotBurnedWithoutSegmentBeforeTheGap() {
    let outcome = evaluate([0], freezesLeft: 1, bestStreak: 1)
    #expect(outcome.currentStreak == 1)
    #expect(outcome.freezesLeft == 1)
    #expect(!outcome.freezeConsumedToday)
  }

  @Test
  func twoDayGapIsNeverBridged() {
    let outcome = evaluate([-5, -4, -3, 0], freezesLeft: 1, bestStreak: 3)
    #expect(outcome.currentStreak == 1)
    #expect(outcome.freezesLeft == 1)
    #expect(!outcome.freezeConsumedToday)
  }

  @Test
  func existingFreezeStampIsPreservedWhenNoNewFreezeIsConsumed() {
    let outcome = evaluate(
      [-2, -1, 0],
      freezesLeft: 1,
      bestStreak: 3,
      freezeUsedOn: "2026-08-30"
    )
    #expect(outcome.currentStreak == 3)
    #expect(outcome.freezeUsedOn == "2026-08-30")
    #expect(outcome.freezesLeft == 1)
  }

  @Test
  func evaluationIsDeterministicUnderFixedNow() {
    let input = StreakInput(
      loggedDays: days([-2, -1, 0]),
      freezesLeft: 1,
      bestStreak: 2,
      freezeUsedOn: nil,
      now: now,
      calendar: calendar
    )
    #expect(StreakEngine.evaluate(input) == StreakEngine.evaluate(input))
  }
}
