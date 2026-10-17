import XCTest

nonisolated final class TodayScreenTests: XCTestCase {
  @MainActor
  func testEDSafeRemovesHealthScoreAndSwitchesRingToWeeklyFraming() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccEDSafe", "--ccDisableAnimations"]
    app.launch()

    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(ring.waitForExistence(timeout: 15), "ring must stay visible under ED-Safe")
    XCTAssertEqual(ring.label, "On track", "ED-Safe ring must drop the kcal framing")

    app.swipeUp()
    XCTAssertFalse(
      app.descendants(matching: .any)["today.healthScore"].exists,
      "Health Score card must be removed entirely under ED-Safe"
    )

    let streak = app.descendants(matching: .any)["today.streakCard"]
    XCTAssertTrue(
      streak.waitForExistence(timeout: 10),
      "streak card must stay visible under ED-Safe"
    )
    XCTAssertEqual(
      streak.label,
      "12 day streak, 1 freeze left",
      "streak VoiceOver label must match the seeded engagement state"
    )
    app.terminate()
  }

  @MainActor
  func testNoTargetsLaunchShowsVerbatimEmptyStateNeverBlank() {
    let app = XCUIApplication()
    // Fresh start + no-target seed: wipes any prior seeded store, then seeds the
    // targetless persona so RootView holds Today visible (onboardingPending).
    app.launchArguments = ["--ccFreshStart", "--ccSeedNoTargets", "--ccDisableAnimations"]
    app.launch()

    let emptyState = app.descendants(matching: .any)["today.emptyState"]
    XCTAssertTrue(
      emptyState.waitForExistence(timeout: 15),
      "--ccSeedNoTargets must render the empty state, never a blank screen"
    )
    XCTAssertTrue(
      emptyState.staticTexts["Set up your plan"].exists,
      "verbatim empty-state heading missing"
    )
    XCTAssertTrue(
      app.buttons["today.startSetup"].exists,
      "Start setup CTA missing from the empty state"
    )
    XCTAssertFalse(
      app.descendants(matching: .any)["today.ring"].exists,
      "ring must not render without targets"
    )
    app.terminate()
  }

  @MainActor
  func testSeededLaunchShowsRingWeekStripAndSelectionRequeriesDiary() {
    let app = XCUIApplication()
    relaunchWithSeededState(app)
    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()

    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(ring.waitForExistence(timeout: 15), "today.ring missing on seeded launch")
    let ringLabel = ring.label
    XCTAssertTrue(
      ringLabel.contains("calories remaining") && ringLabel.contains("goal"),
      "ring must carry the combined remaining/goal VoiceOver label, got: \(ringLabel)"
    )

    let strip = app.descendants(matching: .any)["today.weekStrip"]
    XCTAssertTrue(strip.waitForExistence(timeout: 10), "today.weekStrip missing")
    let cells = strip.descendants(matching: .any).matching(identifier: "today.dayCell")
    XCTAssertGreaterThanOrEqual(cells.count, 4, "week strip must expose selectable day cells")

    // Selecting yesterday must re-query the diary for that day (Caesar Salad is
    // the seeded yesterday lunch; today only carries Spaghetti Bolognese).
    let yesterdayCell = cells.element(boundBy: max(cells.count - 2, 0))
    XCTAssertTrue(
      yesterdayCell.waitForExistence(timeout: 5),
      "day cell missing; labels: \(cells.allElementsBoundByIndex.map(\.label))"
    )
    let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
    XCTAssertTrue(
      yesterdayCell.label.contains(yesterday.formatted(.dateTime.weekday(.wide)))
        && yesterdayCell.label.contains(yesterday.formatted(.dateTime.day())),
      "second-to-last cell must be yesterday, got: \(yesterdayCell.label)"
    )
    yesterdayCell.tap()

    app.swipeUp()
    let rows = app.descendants(matching: .any).matching(identifier: "today.foodRow")
    let caesarRow = rows.firstMatch
    XCTAssertTrue(
      caesarRow.waitForExistence(timeout: 10) && caesarRow.label.contains("Caesar Salad"),
      "selecting yesterday must re-render Recent meals with that day's diary data, got: \(caesarRow.label)"
    )
    app.terminate()
  }

  // Tests share one simulator app container: a wipe-based launch leaves the
  // store empty for the next test. Reset = wipe, then a plain launch that
  // re-seeds the full persona, so each test's precondition is its own.
  @MainActor
  private func relaunchWithSeededState(_ app: XCUIApplication) {
    app.terminate()
    app.launchArguments = ["--ccFreshStart"]
    app.launch()
    app.terminate()
  }
}
