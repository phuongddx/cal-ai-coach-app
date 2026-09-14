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

  func testPhotoScanReachesReview() {
    let app = XCUIApplication()
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))

    let started = Date()
    shutter.tap()

    // Existence check order: the analyzing screen must appear (at least
    // transiently) before the review sheet — the state machine is real.
    let analyzing = app.descendants(matching: .any)["scan.analyzing"]
    XCTAssertTrue(analyzing.waitForExistence(timeout: 10), "analyzing screen never appeared before review")

    let review = app.descendants(matching: .any)["scan.review"]
    XCTAssertTrue(review.waitForExistence(timeout: 10))
    XCTAssertLessThan(Date().timeIntervalSince(started), 5, "LOG-01 <5s budget")

    let badge = app.descendants(matching: .any)["scan.badge"]
    XCTAssertTrue(badge.waitForExistence(timeout: 5), "confidence badge missing on review sheet")
    let badgeLabel = badge.label
    XCTAssertTrue(badgeLabel.contains("High"), "0.92 fixture confidence must badge High — got: \(badgeLabel)")
    app.terminate()
  }

  func testQuotaReachedShowsManualPath() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccScanScenario", "402"]
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))
    shutter.tap()

    let quotaTitle = app.staticTexts["You've used all 3 free scans this week"]
    XCTAssertTrue(quotaTitle.waitForExistence(timeout: 10), "402 fixture never reached the quota state")
    let quotaBody = app.staticTexts.matching(
      NSPredicate(format: "label CONTAINS %@", "You can still log everything manually")
    ).firstMatch
    XCTAssertTrue(quotaBody.exists, "TRU-02 manual-logging reassurance copy missing")
    XCTAssertTrue(app.buttons["scan.seePlans"].exists)
    XCTAssertTrue(app.buttons["scan.logManually"].exists)

    app.buttons["scan.logManually"].tap()
    let addFood = app.staticTexts["Add food"]
    XCTAssertTrue(addFood.waitForExistence(timeout: 10), "Log manually must open the Add Food sheet")
    app.terminate()
  }

  func testBarcodeNotFound() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccScanScenario", "404"]
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))
    shutter.tap()

    let heading = app.staticTexts["We couldn't find that barcode"]
    XCTAssertTrue(heading.waitForExistence(timeout: 10), "404 fixture never reached the inline error card")
    let body = app.staticTexts["Search the food database or add it as a custom food."]
    XCTAssertTrue(body.exists)
    XCTAssertTrue(app.buttons["scan.searchManually"].exists, "Search manually escape missing")
    app.terminate()
  }

  func testAnalysisFailure() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccScanScenario", "422"]
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))
    shutter.tap()

    let heading = app.staticTexts["We couldn't analyze that photo"]
    XCTAssertTrue(heading.waitForExistence(timeout: 10), "422 fixture never reached the inline error card")
    XCTAssertTrue(app.buttons["scan.tryAgain"].exists)

    app.buttons["scan.tryAgain"].tap()
    XCTAssertTrue(shutter.waitForExistence(timeout: 5), "Try again must return to the capture screen")
    app.terminate()
  }

  func testUnresolvedItemBlocksSave() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccScanScenario", "200-unresolved"]
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))
    shutter.tap()

    let reviewNeeded = app.staticTexts["Review needed"]
    XCTAssertTrue(reviewNeeded.waitForExistence(timeout: 10), "unresolved item never rendered Review needed")

    let save = app.buttons["scan.save"]
    XCTAssertTrue(save.waitForExistence(timeout: 5))
    XCTAssertFalse(save.isEnabled, "save must stay disabled while any item is unresolved")

    // Resolving via Fix Issue (correction capture) is the only way forward.
    let fixIssue = app.buttons["scan.fixIssue.0"]
    XCTAssertTrue(fixIssue.waitForExistence(timeout: 5))
    fixIssue.tap()
    let saveNote = app.buttons["scan.correction.save"]
    XCTAssertTrue(saveNote.waitForExistence(timeout: 5))
    saveNote.tap()

    let resolved = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "isEnabled == true"),
      object: save
    )
    XCTAssertEqual(XCTWaiter.wait(for: [resolved], timeout: 10), .completed, "save never re-enabled after resolution")
    XCTAssertFalse(reviewNeeded.exists, "Fix Issue resolution must clear Review needed")
    app.terminate()
  }

  func testGramsStepperRecomputesKcal() {
    let app = XCUIApplication()
    app.launch()

    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15))
    fab.tap()
    let shutter = app.buttons["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10))
    shutter.tap()
    let review = app.descendants(matching: .any)["scan.review"]
    XCTAssertTrue(review.waitForExistence(timeout: 10))

    let kcalLabel = app.staticTexts["scan.itemKcal.0"]
    XCTAssertTrue(kcalLabel.waitForExistence(timeout: 5))
    XCTAssertEqual(kcalLabel.label, "464 kcal")

    let stepper = app.descendants(matching: .any)["scan.grams.0"].firstMatch
    XCTAssertTrue(stepper.waitForExistence(timeout: 5))
    tapIncrement(stepper)
    tapIncrement(stepper)
    tapIncrement(stepper)

    // 145 × 350 / 100 = 507.5 → 508, recomputed from current grams.
    XCTAssertEqual(kcalLabel.label, "508 kcal", "kcal must recompute from steppers, never echo the fixture")
    app.terminate()

    // ED-Safe run: kcal framing absent, grams framing intact.
    let edSafeApp = XCUIApplication()
    edSafeApp.launchArguments = ["--ccEDSafe"]
    edSafeApp.launch()
    let edSafeFab = edSafeApp.buttons["shell.fab"]
    XCTAssertTrue(edSafeFab.waitForExistence(timeout: 15))
    edSafeFab.tap()
    let edSafeShutter = edSafeApp.buttons["scan.shutter"]
    XCTAssertTrue(edSafeShutter.waitForExistence(timeout: 10))
    edSafeShutter.tap()
    let edSafeReview = edSafeApp.descendants(matching: .any)["scan.review"]
    XCTAssertTrue(edSafeReview.waitForExistence(timeout: 10))

    XCTAssertFalse(
      edSafeApp.staticTexts["scan.itemKcal.0"].waitForExistence(timeout: 2),
      "ED-Safe must hide the per-item kcal label"
    )
    let edSafeStepper = edSafeApp.descendants(matching: .any)["scan.grams.0"].firstMatch
    XCTAssertTrue(edSafeStepper.waitForExistence(timeout: 5))
    XCTAssertEqual(edSafeStepper.value as? String, "320 grams")
    tapIncrement(edSafeStepper)
    tapIncrement(edSafeStepper)
    XCTAssertEqual(edSafeStepper.value as? String, "340 grams", "grams must keep stepping in ED-Safe")
    edSafeApp.terminate()
  }

  // CCStepper folds its ± buttons into one adjustable element; coordinate
  // taps hit the physical + control at the trailing edge of that element.
  private func tapIncrement(_ stepper: XCUIElement) {
    let plus = stepper.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5))
    plus.tap()
  }
}
