import Foundation

// Pure streak/freeze evaluation (ENG-01): a set-based recount over logged
// diary days, anchoring on yesterday-or-today, with at most ONE single-day
// gap bridged while a freeze remains — the bridged day joins the chain
// without adding to the count. Zero imports by contract (must stay macOS
// `swift test`-able); deterministic under the injected now/calendar.

public struct StreakInput: Sendable {
  public var loggedDays: Set<String>
  public var freezesLeft: Int
  public var bestStreak: Int
  public var freezeUsedOn: String?
  public var now: Date
  public var calendar: Calendar

  public init(
    loggedDays: Set<String>,
    freezesLeft: Int,
    bestStreak: Int,
    freezeUsedOn: String?,
    now: Date,
    calendar: Calendar = .current
  ) {
    self.loggedDays = loggedDays
    self.freezesLeft = freezesLeft
    self.bestStreak = bestStreak
    self.freezeUsedOn = freezeUsedOn
    self.now = now
    self.calendar = calendar
  }
}

public struct StreakOutcome: Equatable, Sendable {
  public var currentStreak: Int
  public var bestStreak: Int
  public var freezesLeft: Int
  public var freezeUsedOn: String?
  public var freezeConsumedToday: Bool

  public init(
    currentStreak: Int,
    bestStreak: Int,
    freezesLeft: Int,
    freezeUsedOn: String?,
    freezeConsumedToday: Bool
  ) {
    self.currentStreak = currentStreak
    self.bestStreak = bestStreak
    self.freezesLeft = freezesLeft
    self.freezeUsedOn = freezeUsedOn
    self.freezeConsumedToday = freezeConsumedToday
  }
}

public enum StreakEngine {
  // Walk bound keeps the recount O(n) over real usage (T-P06-04).
  private static let maxLookbackDays = 730

  public static func evaluate(_ input: StreakInput) -> StreakOutcome {
    let calendar = input.calendar
    let today = dayString(input.now, calendar: calendar)
    let yesterdayDate = calendar.date(byAdding: .day, value: -1, to: input.now)
    let yesterday = yesterdayDate.map { dayString($0, calendar: calendar) }

    var current = 0
    var bridgedDay: String?
    var cursorDate: Date?
    if input.loggedDays.contains(today) {
      cursorDate = input.now
    } else if let yesterdayDate, let yesterday, input.loggedDays.contains(yesterday) {
      cursorDate = yesterdayDate
    }

    if cursorDate != nil {
      current = 1
      for _ in 0..<maxLookbackDays {
        guard let cursor = cursorDate,
          let previousDate = calendar.date(byAdding: .day, value: -1, to: cursor)
        else { break }
        let previousDay = dayString(previousDate, calendar: calendar)
        if input.loggedDays.contains(previousDay) {
          current += 1
          cursorDate = previousDate
          continue
        }
        // Bridge candidate: only a single-day gap with a logged segment
        // directly before it, and only once per evaluation.
        let dayBeforeGap = calendar.date(byAdding: .day, value: -1, to: previousDate)
        if bridgedDay == nil, input.freezesLeft > 0, let dayBeforeGap,
          input.loggedDays.contains(dayString(dayBeforeGap, calendar: calendar))
        {
          bridgedDay = previousDay
          cursorDate = dayBeforeGap
          current += 1
          continue
        }
        break
      }
    }

    let consumed = bridgedDay != nil
    return StreakOutcome(
      currentStreak: current,
      bestStreak: max(input.bestStreak, current),
      freezesLeft: input.freezesLeft - (consumed ? 1 : 0),
      freezeUsedOn: consumed ? bridgedDay : input.freezeUsedOn,
      freezeConsumedToday: consumed
    )
  }

  private static func dayString(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}
