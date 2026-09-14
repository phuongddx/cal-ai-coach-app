import XCTest

// TRU-04 phase backstop: under --ccEDSafe no kcal survives anywhere on the
// walked surfaces — neither in visible content (cards removed) nor in
// accessibility labels (VoiceOver parity, T-P07-02) — while grams/% framing,
// confidence badges and habit stats remain.
nonisolated final class EdSafeTests: XCTestCase {
  @MainActor
  func testEDSafeWalkKeepsKcalOutOfContentAndAnnouncedLabels() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccEDSafe", "--ccDisableAnimations"]
    app.launch()

    // --- Today ---
    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(ring.waitForExistence(timeout: 15), "ring must stay visible under ED-Safe")
    XCTAssertEqual(ring.label, "On track", "ED-Safe ring must drop the kcal framing")
    XCTAssertFalse(
      app.descendants(matching: .any)["today.healthScore"].exists,
      "Health Score card must be removed under ED-Safe"
    )
    let streak = app.descendants(matching: .any)["today.streakCard"]
    XCTAssertTrue(streak.waitForExistence(timeout: 10), "streak card must remain")
    XCTAssertEqual(streak.label, "12 day streak, 1 freeze left")
    app.swipeUp()
    assertNoKcalAnnouncements(app, on: "Today")

    // --- Diary (sheet over Today) ---
    let mealRow = app.descendants(matching: .any)["today.foodRow"].firstMatch
    XCTAssertTrue(mealRow.waitForExistence(timeout: 10), "a recent meal row must exist")
    mealRow.tap()
    let addFood = app.descendants(matching: .any)["diary.addFood.breakfast"]
    XCTAssertTrue(addFood.waitForExistence(timeout: 10), "diary sheet must open")
    XCTAssertFalse(
      app.staticTexts["Eaten"].exists,
      "Eaten/Goal/Left summary must be hidden under ED-Safe"
    )
    XCTAssertFalse(
      app.staticTexts["Left"].exists,
      "Left summary column must be hidden under ED-Safe"
    )
    app.swipeUp()
    assertNoKcalAnnouncements(app, on: "Diary")
    // A center swipeDown scrolls the sheet; dismissal needs a drag from the
    // sheet's top edge.
    let window = app.windows.firstMatch
    window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08))
      .press(forDuration: 0.05, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
    let ringAfterDiary = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(
      ringAfterDiary.waitForExistence(timeout: 10),
      "diary sheet must dismiss before the scan walk (Today ring visible again)"
    )

    // --- Review (scan fixture → review sheet) ---
    let fab = app.descendants(matching: .any)["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 10), "scan FAB missing")
    fab.tap()
    let shutter = app.descendants(matching: .any)["scan.shutter"]
    XCTAssertTrue(shutter.waitForExistence(timeout: 10), "shutter missing")
    shutter.tap()
    let badge = app.descendants(matching: .any)["scan.badge"]
    XCTAssertTrue(
      badge.waitForExistence(timeout: 15),
      "confidence badge must remain under ED-Safe (AI accuracy ≠ morality)"
    )
    XCTAssertFalse(
      app.descendants(matching: .any)["scan.totalKcal"].exists,
      "total kcal must be hidden under ED-Safe"
    )
    let stepper = app.descendants(matching: .any)["scan.grams.0"]
    XCTAssertTrue(
      stepper.waitForExistence(timeout: 10),
      "grams steppers must remain editable under ED-Safe"
    )
    let gramsFraming = [stepper.label, stepper.value as? String ?? ""]
      .contains { $0.contains("320") }
    XCTAssertTrue(
      gramsFraming,
      "grams framing must stay visible under ED-Safe, got label: \(stepper.label) value: \(stepper.value)"
    )
    assertNoKcalAnnouncements(app, on: "Review")
    let closeScan = app.descendants(matching: .any)["scan.close"]
    XCTAssertTrue(closeScan.exists, "scan close missing")
    closeScan.tap()

    // --- Progress ---
    let progressTab = app.tabBars.buttons["Progress"]
    XCTAssertTrue(progressTab.waitForExistence(timeout: 10), "Progress tab missing")
    progressTab.tap()
    let logWeight = app.descendants(matching: .any)["progress.logWeight"]
    XCTAssertTrue(logWeight.waitForExistence(timeout: 10), "weight trend must render")
    app.swipeUp()
    XCTAssertFalse(
      app.staticTexts.matching(
        NSPredicate(format: "label CONTAINS %@", "deficit")
      ).firstMatch.exists,
      "weekly energy deficit framing must be hidden under ED-Safe"
    )
    assertNoKcalAnnouncements(app, on: "Progress")

    // --- Coach: weekly-average habit stat swap ---
    let coachTab = app.tabBars.buttons["Coach"]
    XCTAssertTrue(coachTab.waitForExistence(timeout: 10), "Coach tab missing")
    coachTab.tap()
    let weeksStat = app.staticTexts["Weeks with all meals logged"]
    XCTAssertTrue(
      weeksStat.waitForExistence(timeout: 10),
      "ED-Safe must swap kcal-derived stats for the weekly habit stat"
    )
    XCTAssertFalse(
      app.staticTexts["% on target"].exists,
      "% on target is kcal-derived and must vanish under ED-Safe"
    )
    XCTAssertFalse(
      app.staticTexts["kg this week"].exists,
      "kg framing must vanish from the weekly review under ED-Safe"
    )
    assertNoKcalAnnouncements(app, on: "Coach")
    app.terminate()
  }

  // T-P07-02: content hidden visually but still announced is a disclosure
  // failure for exactly the users ED-Safe protects.
  @MainActor
  private func assertNoKcalAnnouncements(_ app: XCUIApplication, on screen: String) {
    let leaking = app.descendants(matching: .any).allElementsBoundByIndex.compactMap {
      element -> String? in
      guard element.label.lowercased().contains("kcal") else { return nil }
      return "'\(element.label)'"
    }
    XCTAssertTrue(
      leaking.isEmpty,
      "\(screen) announces kcal under ED-Safe (label parity breach): \(leaking.joined(separator: ", "))"
    )
  }

  // Tests share one simulator app container: wipe, then a plain launch that
  // re-seeds the full persona, so each test's precondition is its own.
  @MainActor
  private func relaunchWithSeededState(_ app: XCUIApplication) {
    app.terminate()
    app.launchArguments = ["--ccFreshStart"]
    app.launch()
    app.terminate()
  }
}
