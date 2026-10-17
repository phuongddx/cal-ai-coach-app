import XCTest

// Task 3: sign-in UI reachability only — never scripted past a real system
// Apple/Google authentication dialog (no human present in CI). --ccRequireSignIn
// forces the DEBUG sign-in gate so the app launches straight into SignInView.
nonisolated final class SignInFlowTests: XCTestCase {
  @MainActor
  func testSignInEntryPointsAreReachable() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccFreshStart", "--ccRequireSignIn", "--ccDisableAnimations"]
    app.launch()

    XCTAssertTrue(
      app.descendants(matching: .any)["auth.signInApple"].waitForExistence(timeout: 10),
      "Apple sign-in entry point must be reachable"
    )
    XCTAssertTrue(
      app.descendants(matching: .any)["auth.signInGoogle"].exists,
      "Google sign-in entry point must be reachable"
    )
    XCTAssertTrue(
      app.descendants(matching: .any)["auth.emailField"].exists,
      "email OTP entry point must be reachable"
    )
    XCTAssertTrue(
      app.descendants(matching: .any)["auth.sendCode"].exists,
      "Send code button must be reachable before any code has been requested"
    )
    app.terminate()
  }

  // Existence check only on the presented system sheet — the real Apple ID
  // credential flow cannot be completed without a human present in CI.
  @MainActor
  func testTappingContinueWithApplePresentsSystemCredentialSheet() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccFreshStart", "--ccRequireSignIn", "--ccDisableAnimations"]
    app.launch()

    let appleButton = app.descendants(matching: .any)["auth.signInApple"]
    XCTAssertTrue(appleButton.waitForExistence(timeout: 10))
    appleButton.tap()

    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let presented = springboard.alerts.firstMatch.waitForExistence(timeout: 10)
      || springboard.sheets.firstMatch.waitForExistence(timeout: 5)
      || springboard.otherElements.firstMatch.waitForExistence(timeout: 5)
    XCTAssertTrue(presented, "tapping Continue with Apple must present a system credential sheet")
    app.terminate()
  }
}
