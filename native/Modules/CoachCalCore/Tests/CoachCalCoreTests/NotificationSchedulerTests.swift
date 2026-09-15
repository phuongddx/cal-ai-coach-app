import Testing
import UserNotifications

@testable import CoachCalCore

@Suite
struct NotificationSchedulerTests {
  @Test
  func allThreeRequestsWhenNothingLoggedAndNotEdSafe() {
    let requests = NotificationScheduler.pendingRequests(
      mealsLoggedToday: [],
      edSafeMode: false,
      now: Date()
    )
    #expect(requests.count == 3)
    #expect(Set(requests.map(\.identifier)) == Set(["meal.lunch", "meal.dinner", "eod.recap"]))
  }

  @Test
  func lunchReminderSuppressedOnceLunchLogged() {
    let requests = NotificationScheduler.pendingRequests(
      mealsLoggedToday: [.lunch],
      edSafeMode: false,
      now: Date()
    )
    #expect(requests.count == 2)
    #expect(!requests.contains { $0.identifier == "meal.lunch" })
  }

  @Test
  func dinnerReminderSuppressedOnceDinnerLogged() {
    let requests = NotificationScheduler.pendingRequests(
      mealsLoggedToday: [.dinner],
      edSafeMode: false,
      now: Date()
    )
    #expect(requests.count == 2)
    #expect(!requests.contains { $0.identifier == "meal.dinner" })
  }

  @Test
  func eodRecapAlwaysPresentRegardlessOfWhatsLogged() {
    let combinations: [Set<NotificationScheduler.MealSlot>] = [[], [.lunch], [.dinner], [.lunch, .dinner]]
    for logged in combinations {
      let requests = NotificationScheduler.pendingRequests(
        mealsLoggedToday: logged,
        edSafeMode: false,
        now: Date()
      )
      #expect(requests.contains { $0.identifier == "eod.recap" })
    }
  }

  @Test
  func edSafeRecapBodyContainsNoDigitCharacters() {
    let requests = NotificationScheduler.pendingRequests(
      mealsLoggedToday: [],
      edSafeMode: true,
      now: Date()
    )
    let recap = requests.first { $0.identifier == "eod.recap" }
    #expect(recap != nil)
    let body = recap?.content.body ?? ""
    #expect(!body.isEmpty)
    #expect(!body.contains { $0.isNumber })
  }

  @Test
  func triggerTimesMatchDocumentedSchedule() {
    let requests = NotificationScheduler.pendingRequests(
      mealsLoggedToday: [],
      edSafeMode: false,
      now: Date()
    )
    let expectedTimes: [String: (hour: Int, minute: Int)] = [
      "meal.lunch": (12, 30),
      "meal.dinner": (18, 30),
      "eod.recap": (21, 0),
    ]
    #expect(requests.count == expectedTimes.count)
    for request in requests {
      let trigger = request.trigger as? UNCalendarNotificationTrigger
      #expect(trigger != nil)
      let expected = expectedTimes[request.identifier]
      #expect(trigger?.dateComponents.hour == expected?.hour)
      #expect(trigger?.dateComponents.minute == expected?.minute)
      #expect(trigger?.repeats == true)
    }
  }

  @Test
  func identicalInputProducesByteIdenticalRequests() {
    let now = Date()
    let first = NotificationScheduler.pendingRequests(mealsLoggedToday: [.lunch], edSafeMode: true, now: now)
    let second = NotificationScheduler.pendingRequests(mealsLoggedToday: [.lunch], edSafeMode: true, now: now)
    #expect(first.map(\.identifier) == second.map(\.identifier))
    #expect(first.map { $0.content.title } == second.map { $0.content.title })
    #expect(first.map { $0.content.body } == second.map { $0.content.body })
  }
}
