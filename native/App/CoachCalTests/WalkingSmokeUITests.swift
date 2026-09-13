import XCTest

nonisolated final class WalkingSmokeUITests: XCTestCase {
  func testWalkingScreenShowsTitle() {
    let app = XCUIApplication()
    app.launch()

    let title = app.staticTexts["walking.title"]
    XCTAssertTrue(title.waitForExistence(timeout: 5))
  }

  func testIncrementButtonIncrementsCount() {
    let app = XCUIApplication()
    app.launch()

    let increment = app.buttons["walking.increment"]
    XCTAssertTrue(increment.waitForExistence(timeout: 5))

    increment.tap()

    let count = app.staticTexts["walking.count"]
    XCTAssertTrue(count.waitForExistence(timeout: 5))
    XCTAssertEqual(count.label, "Count: 1")
  }
}
