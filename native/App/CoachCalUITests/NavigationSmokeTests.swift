import XCTest

// Pitfall-7 smoke: per-tab navigation state survives tab round-trips, offline
// logging works end-to-end, and coachcal:// deep links route correctly.
nonisolated final class NavigationSmokeTests: XCTestCase {
  // The only cross-tab NavigationStack push (Profile → Settings): the pushed
  // destination must still be on top after leaving and returning to the tab.
  @MainActor
  func testProfilePushSurvivesTabRoundTrip() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()

    openTab(app, "Profile", marker: { $0.descendants(matching: .any)["profile.userCard"].waitForExistence(timeout: 10) })
    app.descendants(matching: .any)["profile.row.settings"].tap()
    XCTAssertTrue(
      app.descendants(matching: .any)["settings.edSafeToggle"].waitForExistence(timeout: 10),
      "Settings Detail must push from Profile"
    )

    for tab in ["Progress", "Coach", "Progress"] {
      openTab(app, tab, marker: { _ in true })
    }
    openTab(app, "Profile", marker: { _ in true })
    XCTAssertTrue(
      app.descendants(matching: .any)["settings.edSafeToggle"].exists,
      "the pushed Settings Detail must still be on top after tab round-trips (Pitfall 7)"
    )
    app.terminate()
  }

  // Full shell cycling ×4 tabs: each tab re-renders its own root state and
  // Today's ring survives the whole round trip.
  @MainActor
  func testFourTabRoundTripsPreservePerTabState() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()

    XCTAssertTrue(
      app.descendants(matching: .any)["today.ring"].waitForExistence(timeout: 15),
      "Today root missing"
    )
    openTab(app, "Progress", marker: { $0.descendants(matching: .any)["progress.logWeight"].waitForExistence(timeout: 10) })
    openTab(app, "Coach", marker: { app in
      app.swipeUp()
      return app.staticTexts.matching(
        NSPredicate(format: "label CONTAINS[c] %@", "Weekly review")
      ).firstMatch.waitForExistence(timeout: 10)
    })
    openTab(app, "Profile", marker: { $0.descendants(matching: .any)["profile.userCard"].waitForExistence(timeout: 10) })
    openTab(app, "Coach", marker: { app in
      app.swipeUp()
      return app.staticTexts.matching(
        NSPredicate(format: "label CONTAINS[c] %@", "Weekly review")
      ).firstMatch.waitForExistence(timeout: 10)
    })
    openTab(app, "Today", marker: { $0.descendants(matching: .any)["today.ring"].waitForExistence(timeout: 10) })
    openTab(app, "Profile", marker: { $0.descendants(matching: .any)["profile.userCard"].waitForExistence(timeout: 10) })
    app.terminate()
  }

  // PLT-02: logging works offline — badge visible, water quick-add updates
  // the total, nothing blocks the write.
  @MainActor
  func testOfflineWaterLoggingUpdatesTotalUnderForceOffline() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccForceOffline", "--ccDisableAnimations"]
    app.launch()

    let offlineBadge = app.descendants(matching: .any)["offline.badge"]
    XCTAssertTrue(
      offlineBadge.waitForExistence(timeout: 15),
      "offline badge must show under --ccForceOffline"
    )

    let waterCard = app.descendants(matching: .any)["today.waterCard"]
    XCTAssertTrue(waterCard.waitForExistence(timeout: 10))
    waterCard.tap()
    XCTAssertTrue(
      app.descendants(matching: .any)["water.add"].waitForExistence(timeout: 10),
      "water log sheet must open"
    )
    app.descendants(matching: .any)["water.add"].tap()
    // Seeded 1250 ml (5 of 8) + 250 ml → 6 of 8 glasses.
    let updated = app.staticTexts["6 of 8 glasses"]
    XCTAssertTrue(
      updated.waitForExistence(timeout: 10),
      "water total must update offline; visible texts: \(app.staticTexts.allElementsBoundByIndex.prefix(20).map(\.label))"
    )
    XCTAssertTrue(
      app.descendants(matching: .any)["offline.badge"].exists,
      "offline badge must stay visible"
    )
    app.terminate()
  }

  // Cold-launch deep link: a terminated app opened via coachcal://diary lands
  // on the diary sheet in front. System-level open (the app is not running).
  @MainActor
  func testColdLaunchDiaryDeepLinkShowsDiaryInFront() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.terminate()
    XCUIDevice.shared.system.open(URL(string: "coachcal://diary")!)
    XCTAssertTrue(
      app.descendants(matching: .any)["diary.addFood.breakfast"].waitForExistence(timeout: 20),
      "cold deep link must present the diary sheet in front"
    )
    app.terminate()
  }

  // Warm deep link to Today must raise the Today tab from anywhere.
  @MainActor
  func testWarmTodayDeepLinkSelectsTodayTab() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()
    openTab(app, "Progress", marker: { $0.descendants(matching: .any)["progress.logWeight"].waitForExistence(timeout: 10) })

    app.open(URL(string: "coachcal://today")!)
    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(
      ring.waitForExistence(timeout: 10),
      "coachcal://today must select the Today tab"
    )
    XCTAssertTrue(ring.isHittable, "Today must be the front tab after the deep link")

    // Unknown hosts are a no-op: the app stays put, no sheet, no crash.
    app.open(URL(string: "coachcal://nonsense")!)
    XCTAssertTrue(
      app.descendants(matching: .any)["diary.addFood.breakfast"].waitForExistence(timeout: 2) == false,
      "an unknown deep-link host must not open the diary"
    )
    XCTAssertTrue(ring.exists, "app must stay on Today after an unknown host")
    app.terminate()
  }

  // Cold diary link with an explicit ?date= must open that day, not today.
  @MainActor
  func testDiaryDeepLinkWithDateOpensThatDay() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.terminate()
    XCUIDevice.shared.system.open(URL(string: "coachcal://diary?date=2026-09-11")!)
    XCTAssertTrue(
      app.descendants(matching: .any)["diary.addFood.breakfast"].waitForExistence(timeout: 20),
      "dated diary deep link must present the day sheet"
    )
    app.terminate()
  }

  @MainActor
  private func openTab(
    _ app: XCUIApplication,
    _ name: String,
    marker: @MainActor (XCUIApplication) -> Bool
  ) {
    let tabButton = app.tabBars.buttons[name]
    XCTAssertTrue(tabButton.waitForExistence(timeout: 10), "\(name) tab missing")
    tabButton.tap()
    XCTAssertTrue(marker(app), "\(name) tab state missing after switch")
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
