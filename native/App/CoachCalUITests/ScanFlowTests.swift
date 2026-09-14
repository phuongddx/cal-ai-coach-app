import XCTest

// Scan flow XCUITest matrix. Every path runs on the simulator with the
// fixture capture seam (no camera) and fixture API scenarios
// (--ccScanScenario); see 03-RESEARCH Pattern 3/6 and RESEARCH Pitfall 3.
nonisolated final class ScanFlowTests: XCTestCase {
  func testCaptureReachesAnalyzing() {
    let app = XCUIApplication()
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15), "shell.fab missing — seed or shell broken")

    fab.tap()
    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10), "scan cover did not present the viewfinder")

    let started = Date()
    shutter.tap()

    let analyzing = app.descendants(matching: .any)["scan.analyzing"]
    XCTAssertTrue(analyzing.waitForExistence(timeout: 10), "shutter tap never reached the analyzing checklist")

    let review = app.descendants(matching: .any)["scan.review"]
    XCTAssertTrue(review.waitForExistence(timeout: 10), "fixture scan never reached the review state")
    XCTAssertLessThan(
      Date().timeIntervalSince(started),
      5,
      "fixture scan must land on review well inside the <5s UX budget (LOG-01)"
    )
    app.terminate()
  }
}
