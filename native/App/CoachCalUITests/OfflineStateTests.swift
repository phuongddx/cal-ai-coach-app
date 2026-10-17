import XCTest

nonisolated final class OfflineStateTests: XCTestCase {
  func testForceOfflineShowsBadgeAndKeepsSeededRows() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccForceOffline"]
    app.launch()

    let badge = app.descendants(matching: .any)["offline.badge"]
    XCTAssertTrue(badge.waitForExistence(timeout: 15), "offline.badge missing under --ccForceOffline")

    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(ring.waitForExistence(timeout: 10), "Today content must not go blank offline")

    app.swipeUp()
    let rows = app.descendants(matching: .any).matching(identifier: "today.foodRow")
    XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 5), "seeded rows must still render offline")
  }
}
