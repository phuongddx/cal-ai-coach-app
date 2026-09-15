import Foundation

// Canonical "yyyy-MM-dd" day key. Single convention for every surface that
// groups or filters diary data: a day is the user's LOCAL calendar day (the
// Today/week-strip convention), never the UTC day of the stored timestamp —
// SQL sites pair this with date(e.created_at, 'localtime').
public enum DayKey {
  public static func string(for date: Date, calendar: Calendar = .current) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}
