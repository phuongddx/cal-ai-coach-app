import XCTest

// 04-07: the mechanical E2E path — scan → edit → mid-test offline toggle →
// edit while offline → reconnect — on the one simulator this session has,
// against a real local Supabase stack (`supabase start`). Same env-var gate
// as AuthSessionTests/RealAuthConvergenceProof: skips cleanly (never a false
// pass) when local credentials are absent.
//
// RESEARCH Pitfall 12: this proves the app's OWN isOffline-driven UI/sync
// state only. It is NEVER a claim about real airplane-mode radio behavior or
// true physical two-device convergence — those are Simulator-incapable and
// are handed to the human-operated DEVICE-CHECKPOINT.md runbook instead.
//
// XCUITest's host process does not inherit the invoking shell's environment
// the way `swift test`/hosted CoachCalTests do — credentials must be baked
// into the scheme's Test-action Environment Variables at `xcodegen generate`
// time (project.yml's `$(TEST_EMAIL)`/`$(TEST_PASSWORD)` substitution), which
// XcodeGen resolves to an EMPTY string (never a missing key) when unset — so
// this gate checks non-empty, not just non-nil, to keep "absent" and "blank"
// both landing on skip.
private func nonEmpty(_ environment: [String: String], _ keys: String...) -> Bool {
  keys.contains { !(environment[$0] ?? "").isEmpty }
}

private let liveCredentialsConfigured = {
  let environment = ProcessInfo.processInfo.environment
  return nonEmpty(environment, "SUPABASE_ANON_KEY")
    && nonEmpty(environment, "TEST_EMAIL", "COACHCAL_TEST_EMAIL")
    && nonEmpty(environment, "TEST_PASSWORD", "COACHCAL_TEST_PASSWORD")
}()

nonisolated final class E2ESyncConvergenceTests: XCTestCase {
  // Fixed so verify-e2e-sync.ts can locate the exact row this run produces
  // by (owner, created_at, display_text) — a deterministic identity, never
  // IPC with this process.
  private static let fixedClockISO = "2025-06-01T12:00:00Z"

  @MainActor
  func testScanEditOfflineEditReconnectConvergesOnRealSupabase() throws {
    try XCTSkipUnless(
      liveCredentialsConfigured,
      "requires a seeded local Supabase and TEST_EMAIL/TEST_PASSWORD (same gate as AuthSessionTests)"
    )
    let credentials = ProcessInfo.processInfo.environment
    let email = credentials["TEST_EMAIL"] ?? credentials["COACHCAL_TEST_EMAIL"] ?? ""
    let password = credentials["TEST_PASSWORD"] ?? credentials["COACHCAL_TEST_PASSWORD"] ?? ""

    let app = XCUIApplication()
    app.launchArguments = [
      "--ccRequireSignIn", "--ccDisableAnimations",
      "--ccFixedClock", Self.fixedClockISO,
      "--ccScanScenario", "200",
    ]
    // Never hardcoded — same env-var idiom as AuthSessionTests, injected via
    // launchEnvironment so only THIS app process sees the credential.
    app.launchEnvironment["TEST_EMAIL"] = email
    app.launchEnvironment["TEST_PASSWORD"] = password
    app.launch()

    // Signed in for real, TodayModel's Steps card makes a genuine
    // HKHealthStore.requestAuthorization call once Today first renders
    // (RESEARCH Pitfall 12 — this IS a real system permission UX the
    // Simulator can present, unlike background delivery timing) — on a
    // simulator account that has never answered it, iOS presents its own
    // in-process sheet OR alert (the exact presentation has varied run to
    // run on a fresh Simulator privacy database). This test doesn't
    // exercise HealthKit; dismiss whichever form appears — before it can
    // both block AND silently absorb the next real tap this test makes.
    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 20), "real sign-in never completed / shell never appeared")
    dismissHealthKitPromptIfPresent(app)

    // Scan → edit → save: the row verify-e2e-sync.ts locates server-side.
    // Signed in, AppEnvironment.api routes to LiveApiClient → the real local
    // analyze-food Edge Function, whose local VLM_PROVIDER defaults to
    // 'fixture' (deterministic chicken-rice @ 320g) — never a live model call.
    scanEditSave(app, expectedGrams: "340 grams")
    let firstSavedToast = app.descendants(matching: .any)["scan.savedToast"]
    XCTAssertTrue(firstSavedToast.waitForExistence(timeout: 10), "first save never landed")
    app.buttons["scan.viewDiary"].tap()

    // Mid-test offline: the new #if DEBUG runtime seam — never
    // --ccForceOffline, which is DebugLaunchArguments-parsed once at init()
    // and can't flip state after a save already happened.
    openProfileSettings(app)
    let toggle = app.descendants(matching: .any)["debug.toggleOffline"]
    XCTAssertTrue(toggle.waitForExistence(timeout: 10), "debug.toggleOffline control missing")
    toggle.tap()

    openTab(app, "Today")
    XCTAssertTrue(
      app.descendants(matching: .any)["offline.badge"].waitForExistence(timeout: 10),
      "offline badge must show after the mid-test toggle"
    )

    // Edit while offline: a second scan+edit+save enqueues a second
    // pending_op, proving the write path itself never blocks on isOffline
    // (PLT-02) — the app's own concern, never a claim the real network was
    // actually cut (RESEARCH Pitfall 12).
    scanEditSave(app, expectedGrams: "330 grams", steps: 1)
    XCTAssertTrue(
      app.descendants(matching: .any)["scan.savedToast"].waitForExistence(timeout: 10),
      "the offline save must still land locally — nothing blocks the write (PLT-02)"
    )
    app.buttons["scan.viewDiary"].tap()

    // Reconnect: the offline badge clears and the sync-pending glyph
    // ("Syncs later", CCFoodRow's syncPending text — the 03-07 backstop)
    // clears from every recent-meal row. Both are UI-visible signals; never
    // a claim about real radio state.
    openProfileSettings(app)
    app.descendants(matching: .any)["debug.toggleOffline"].tap()

    openTab(app, "Today")
    let badge = app.descendants(matching: .any)["offline.badge"]
    XCTAssertTrue(waitForNonExistence(badge, timeout: 15), "offline badge must clear after reconnect")

    let pendingRows = app.descendants(matching: .any)
      .matching(identifier: "today.foodRow")
      .matching(NSPredicate(format: "label CONTAINS %@", "Syncs later"))
    XCTAssertTrue(
      waitForZeroMatches(pendingRows, timeout: 15),
      "every recent-meal row's sync-pending glyph must clear after reconnect"
    )
    app.terminate()
  }

  // MARK: - Helpers

  // fab.tap() → shutter → review → grams edit → save, leaving phase == .saved.
  // A stray system alert (HealthKit, first render only) can absorb a tap
  // gesture into its own default-dismiss handler instead of the app ever
  // seeing it — retry the fab tap once if the cover never presents, rather
  // than fail on an interruption this test doesn't care about.
  @MainActor
  private func scanEditSave(_ app: XCUIApplication, expectedGrams: String, steps: Int = 2) {
    let fab = app.buttons["shell.fab"]
    XCTAssertTrue(fab.waitForExistence(timeout: 15), "shell.fab missing")
    fab.tap()

    let shutter = app.buttons["scan.shutter"]
    if !shutter.waitForExistence(timeout: 6) {
      dismissHealthKitPromptIfPresent(app)
      fab.tap()
    }
    XCTAssertTrue(shutter.waitForExistence(timeout: 10), "scan cover did not present the viewfinder")
    shutter.tap()

    let review = app.descendants(matching: .any)["scan.review"]
    XCTAssertTrue(review.waitForExistence(timeout: 15), "live scan never reached review")

    let stepper = app.descendants(matching: .any)["scan.grams.0"].firstMatch
    XCTAssertTrue(stepper.waitForExistence(timeout: 5), "grams stepper missing on review sheet")
    for _ in 0..<steps {
      tapIncrement(stepper)
    }
    XCTAssertEqual(
      stepper.value as? String, expectedGrams,
      "edited grams (320 fixture + \(steps)×10 step) is the value verify-e2e-sync.ts proves reached the server"
    )

    let saveButton = app.buttons["scan.save"]
    XCTAssertTrue(saveButton.waitForExistence(timeout: 5))
    saveButton.tap()
  }

  // CCStepper folds its ± buttons into one adjustable element; coordinate
  // taps hit the physical + control at the trailing edge — same convention
  // as ScanFlowTests.tapIncrement.
  @MainActor
  private func tapIncrement(_ stepper: XCUIElement) {
    let plus = stepper.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5))
    plus.tap()
  }

  // Covers both forms observed on a fresh Simulator: the full-detail
  // AuthSheet ("Don't Allow"/"Allow") and the simpler plain Alert ("OK",
  // XCTest's own default interruption handler already dismisses that one on
  // its own if a synthesized event catches it mid-presentation) — a no-op
  // when neither is showing.
  @MainActor
  private func dismissHealthKitPromptIfPresent(_ app: XCUIApplication) {
    let sheetCancel = app.buttons["UIA.Health.AuthSheet.CancelButton"]
    if sheetCancel.waitForExistence(timeout: 3) {
      sheetCancel.tap()
      return
    }
    let alert = app.alerts.firstMatch
    if alert.waitForExistence(timeout: 2) {
      alert.buttons.firstMatch.tap()
    }
  }

  // Profile → Settings: a no-op if Settings is already pushed on top from an
  // earlier call in this same test (Pitfall 7 — the push survives tab
  // round-trips, so `profile.row.settings` won't exist a second time).
  @MainActor
  private func openProfileSettings(_ app: XCUIApplication) {
    openTab(app, "Profile")
    let settingsRow = app.descendants(matching: .any)["profile.row.settings"]
    if settingsRow.waitForExistence(timeout: 5) {
      settingsRow.tap()
    }
  }

  @MainActor
  private func openTab(_ app: XCUIApplication, _ name: String) {
    let tabButton = app.tabBars.buttons[name]
    XCTAssertTrue(tabButton.waitForExistence(timeout: 10), "\(name) tab missing")
    tabButton.tap()
  }

  @MainActor
  private func waitForNonExistence(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
    let predicate = NSPredicate(format: "exists == false")
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
    return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
  }

  @MainActor
  private func waitForZeroMatches(_ query: XCUIElementQuery, timeout: TimeInterval) -> Bool {
    let predicate = NSPredicate(format: "count == 0")
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: query)
    return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
  }
}
