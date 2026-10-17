import Foundation
import UserNotifications

// ENG-03: local-only meal-reminder + end-of-day-recap scheduling. No APNs
// anywhere (04-RESEARCH.md's APNs Decision) — UNUserNotificationCenter
// calendar triggers are the entire mechanism. `pendingRequests` is the pure
// [DiaryState] -> [UNNotificationRequest] core (UserNotifications is
// available on macOS, so this stays `swift test`-able without a real
// notification center); `refresh()` is the only place that talks to the
// system center, called from the existing write/foreground seam
// (AppEnvironment.notifyLocalMutation()) — never a second observer.
public struct NotificationScheduler: Sendable {
  public enum MealSlot: Sendable, Hashable {
    case lunch
    case dinner
  }

  public static let allIdentifiers = ["meal.lunch", "meal.dinner", "eod.recap"]

  private let mealsLoggedToday: @MainActor @Sendable () async -> Set<MealSlot>
  private let edSafeMode: @MainActor @Sendable () -> Bool
  private let now: @MainActor @Sendable () -> Date
  nonisolated(unsafe) private let center: UNUserNotificationCenter

  public init(
    mealsLoggedToday: @escaping @MainActor @Sendable () async -> Set<MealSlot>,
    edSafeMode: @escaping @MainActor @Sendable () -> Bool,
    now: @escaping @MainActor @Sendable () -> Date = { Date() },
    center: UNUserNotificationCenter = .current()
  ) {
    self.mealsLoggedToday = mealsLoggedToday
    self.edSafeMode = edSafeMode
    self.now = now
    self.center = center
  }

  /// Pure reschedule logic: every input is a parameter, nothing is read from
  /// the real notification center, so this is fully unit-testable. Suppresses
  /// a meal reminder once that slot is logged today; the EOD recap is always
  /// present and never shows a raw kcal figure while ED-Safe Mode is on
  /// (T-P44-01).
  public static func pendingRequests(
    mealsLoggedToday: Set<MealSlot>,
    edSafeMode: Bool,
    now: Date = Date()
  ) -> [UNNotificationRequest] {
    var requests: [UNNotificationRequest] = []

    if !mealsLoggedToday.contains(.lunch) {
      requests.append(
        request(
          identifier: "meal.lunch",
          title: "Time to log lunch",
          body: "Snap a photo or search to log your lunch.",
          hour: 12,
          minute: 30
        )
      )
    }
    if !mealsLoggedToday.contains(.dinner) {
      requests.append(
        request(
          identifier: "meal.dinner",
          title: "Time to log dinner",
          body: "Snap a photo or search to log your dinner.",
          hour: 18,
          minute: 30
        )
      )
    }

    requests.append(
      request(
        identifier: "eod.recap",
        title: "Your day, wrapped",
        body: edSafeMode
          ? "See your day in the Diary tab."
          : "See how today's calories added up.",
        hour: 21,
        minute: 0
      )
    )

    return requests
  }

  private static func request(
    identifier: String,
    title: String,
    body: String,
    hour: Int,
    minute: Int
  ) -> UNNotificationRequest {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    var components = DateComponents()
    components.hour = hour
    components.minute = minute
    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
    return UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
  }

  /// Idempotent replace: always removes every pending CoachCal request
  /// before re-adding the current set (T-P44-02 — at most 3 pending at any
  /// time, never additive). Authorization is requested here, lazily, on
  /// first scheduling attempt — never at launch.
  public func refresh() async {
    let logged = await mealsLoggedToday()
    let requests = Self.pendingRequests(
      mealsLoggedToday: logged,
      edSafeMode: await edSafeMode(),
      now: await now()
    )
    _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    center.removePendingNotificationRequests(withIdentifiers: Self.allIdentifiers)
    for request in requests {
      try? await center.add(request)
    }
  }
}
