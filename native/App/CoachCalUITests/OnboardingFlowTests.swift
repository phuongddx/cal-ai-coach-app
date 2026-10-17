import XCTest

nonisolated final class OnboardingFlowTests: XCTestCase {
  func testFreshStartWalksAllEightStepsToMainShellWithPersistedTargets() {
    let app = XCUIApplication()
    app.launchArguments = ["--ccFreshStart", "--ccDisableAnimations"]
    app.launch()

    // 1. Value Hero
    let getStarted = app.buttons["onboarding.getStarted"]
    XCTAssertTrue(getStarted.waitForExistence(timeout: 15), "Value Hero missing")
    getStarted.tap()

    // 2. Goal Picker
    let loseCard = app.buttons["onboarding.goalCard.lose"]
    XCTAssertTrue(loseCard.waitForExistence(timeout: 10), "goal cards missing")
    loseCard.tap()
    tapContinue(app)

    // 3. Body Metrics — drive the DOB wheel to an adult year.
    let dobWheel = app.pickerWheels.element(boundBy: 2)
    XCTAssertTrue(dobWheel.waitForExistence(timeout: 10), "DOB wheel missing")
    dobWheel.adjust(toPickerWheelValue: "1990")
    tapContinue(app)

    // 4. Goal Weight & Pace — nudge the slider; clamping stays engine-owned.
    let slider = app.sliders["onboarding.paceSlider"]
    XCTAssertTrue(slider.waitForExistence(timeout: 10), "pace slider missing")
    slider.adjust(toNormalizedSliderPosition: 0.3)
    tapContinue(app)

    // 5. Activity & Diet
    let moderateCard = app.buttons["onboarding.activityCard.moderate"]
    XCTAssertTrue(moderateCard.waitForExistence(timeout: 10), "activity cards missing")
    moderateCard.tap()
    tapContinue(app)

    // 6. Projection — kg + weeks stats, never calorie framing.
    let kgStat = app.descendants(matching: .any)["onboarding.projectionKg"]
    XCTAssertTrue(kgStat.waitForExistence(timeout: 10), "projection stats missing")
    tapContinue(app)

    // 7. Privacy & Health — HealthKit stub must not prompt.
    let healthConnect = app.buttons["onboarding.healthConnect"]
    XCTAssertTrue(healthConnect.waitForExistence(timeout: 10), "health connect stub missing")
    healthConnect.tap()
    XCTAssertTrue(
      app.staticTexts["onboarding.healthConnectNote"].waitForExistence(timeout: 5),
      "tapping the stub must reveal the footnote, never a permission dialog"
    )
    tapContinue(app)

    // 8. Generating → Plan Reveal (animations disabled: instant flip).
    let reveal = app.descendants(matching: .any)["plan.reveal"]
    XCTAssertTrue(reveal.waitForExistence(timeout: 15), "generation must land on plan reveal")
    tapContinue(app)

    // Handoff: targets persisted through TargetRepository → RootView → MainShell.
    let ring = app.descendants(matching: .any)["today.ring"]
    XCTAssertTrue(
      ring.waitForExistence(timeout: 15),
      "onboarding completion must land on MainShell with persisted targets"
    )
  }

  private func tapContinue(_ app: XCUIApplication) {
    let continueButton = app.buttons["onboarding.continue"]
    XCTAssertTrue(continueButton.waitForExistence(timeout: 10), "pinned continue CTA missing")
    continueButton.tap()
  }
}
