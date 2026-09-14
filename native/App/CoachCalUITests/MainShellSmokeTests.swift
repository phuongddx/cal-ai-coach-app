import XCTest

nonisolated final class MainShellSmokeTests: XCTestCase {
  func testSeededLaunchRoutesToTodayRingRecentMealsAndScan() {
    let app = XCUIApplication()
    app.launch()

    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(ring.waitForExistence(timeout: 15), "today.ring missing — seed, routing, or observation broken")

    let meals = app.descendants(matching: .any)["today.recentMeals"]
    XCTAssertTrue(meals.waitForExistence(timeout: 10), "today.recentMeals missing")

    app.swipeUp()
    let rows = meals.descendants(matching: .any).matching(identifier: "today.foodRow")
    XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 5), "no CCFoodRow under today.recentMeals — details join broken")
    XCTAssertGreaterThanOrEqual(rows.count, 1)

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 5), "shell.fab missing")
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10), "scan route not presented by FAB")
    app.terminate()
  }

  func testFreshStartRoutesToOnboarding() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccFreshStart"]
    app.launch()

    XCTAssertTrue(
      app.staticTexts["Set up your plan"].waitForExistence(timeout: 15),
      "--ccFreshStart must skip seeding and route to onboarding"
    )
  }
}
