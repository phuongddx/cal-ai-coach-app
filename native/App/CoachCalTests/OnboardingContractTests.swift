import CoachCalCore
import SwiftUI
import ViewInspector
import XCTest

@testable import CoachCal

nonisolated final class OnboardingContractTests: XCTestCase {
  @MainActor
  private func makeModel(
    birthYear: Int = OnboardingModel.defaultBirthYear,
    now: @escaping @Sendable () -> Date = { Date() }
  ) -> OnboardingModel {
    let model = OnboardingModel(userId: UUID(), now: now)
    model.birthYear = birthYear
    return model
  }

  // Option cards are single-select: choosing a goal deselects the previous one
  // and the draft mutation lands in the model.
  @MainActor
  func testGoalPickerSingleSelectUpdatesDraft() throws {
    let model = makeModel()
    let view = GoalPickerView(model: model)
    let buttons = try view.inspect().findAll(ViewType.Button.self)

    try buttons[0].tap()
    XCTAssertEqual(model.draft.goal, .lose)
    try buttons[2].tap()
    XCTAssertEqual(model.draft.goal, .gain, "picking a new goal must move the single selection")
  }

  @MainActor
  func testValueHeroShowsHeroCopyAndEdSafeLine() throws {
    let view = ValueHeroView(model: makeModel())
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Track calories with a photo"), "hero texts: \(texts)")
    XCTAssertTrue(texts.contains("The honest AI calorie coach"), "hero texts: \(texts)")
    XCTAssertTrue(texts.contains(OnboardingCopy.edSafeTitle), "hero texts: \(texts)")
    XCTAssertTrue(texts.contains(OnboardingCopy.edSafeSubtitle), "hero texts: \(texts)")
    // The hero CTA ("Get started", identifier onboarding.getStarted) is the
    // scaffold's CCPrimaryButton — its label Text is asserted above via texts.
    let buttons = try view.inspect().findAll(ViewType.Button.self)
    XCTAssertGreaterThanOrEqual(buttons.count, 1, "hero must render a CTA button")
  }

  @MainActor
  func testUnder18DobGateBlocksContinueAndShowsVerbatimFootnote() throws {
    let fixedNow = ISO8601DateFormatter().date(from: "2026-09-14T00:00:00Z")!
    let model = makeModel(birthYear: 2014, now: { fixedNow })
    XCTAssertTrue(model.isDobGateBlocked, "a 12-year-old must trip the DOB gate")

    let view = BodyMetricsView(model: model)
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(
      texts.contains("Must be 18+ to use CoachCal"),
      "verbatim gate footnote missing: \(texts)"
    )

    model.advance() // value hero → goal
    model.advance() // goal → body metrics
    model.advance() // blocked by the gate
    XCTAssertEqual(
      model.path.last, .bodyMetrics,
      "advance() must be a no-op while the DOB gate blocks"
    )
  }

  @MainActor
  func testAdultDobAllowsContinue() {
    let fixedNow = ISO8601DateFormatter().date(from: "2026-09-14T00:00:00Z")!
    let model = makeModel(birthYear: 1995, now: { fixedNow })
    XCTAssertFalse(model.isDobGateBlocked)
    model.advance() // value hero → goal
    model.advance() // goal → body metrics
    model.advance() // body metrics → goal weight & pace
    XCTAssertEqual(model.path.last, .goalWeightPace)
  }

  @MainActor
  func testPaceAboveSafeLimitClampsAndShowsVerbatimSafetyFloorBanner() throws {
    let model = makeModel()
    model.setPace(1.5)
    XCTAssertEqual(
      model.draft.requestedPaceKgPerWeek, 0.45,
      "the draft must land on the engine's clamped pace, not the raw slider value"
    )
    XCTAssertTrue(model.paceClamped)

    let view = GoalWeightPaceView(model: model)
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(
      texts.contains { $0.contains("Safety floor:") && $0.contains("1,500 kcal/day for men") },
      "verbatim safety-floor banner missing: \(texts)"
    )
  }

  @MainActor
  func testSafePacePassesThroughUnclamped() {
    let model = makeModel()
    model.setPace(0.3)
    XCTAssertEqual(model.draft.requestedPaceKgPerWeek, 0.3)
    XCTAssertFalse(model.paceClamped)
  }

  // WR-05: maintain→lose must land the draft on an engine-clamped pace —
  // the old re-clamp-only-if-set path kept nil, so the slider displayed 0.50
  // while the engine computed (and persisted) pace 0.
  @MainActor
  func testMaintainToLoseRoundtripReclampsPaceThroughEngine() {
    let model = makeModel()
    model.setPace(0.3)
    model.selectGoal(.maintain)
    XCTAssertNil(model.draft.requestedPaceKgPerWeek)

    model.selectGoal(.lose)
    let clamped = model.draft.requestedPaceKgPerWeek
    XCTAssertNotNil(clamped, "the roundtrip must restore a concrete pace, never nil")
    XCTAssertEqual(
      clamped,
      TargetsEngine.targets(for: model.draft).paceKgPerWeek,
      "the displayed pace must equal what the engine computes for the draft"
    )
    XCTAssertGreaterThan(clamped ?? 0, 0, "a lose goal can never carry pace 0")
  }

  @MainActor
  func testRevealKcalEditReclampsThroughEngineFloors() {
    let model = makeModel()
    model.draft.requestedPaceKgPerWeek = nil
    model.advance() // goal
    model.advance() // body metrics
    model.advance() // goal weight & pace
    model.advance() // activity & diet
    model.advance() // projection
    model.advance() // privacy & health
    model.finishGenerationForTesting()
    XCTAssertNotNil(model.reveal)

    model.adjustRevealKcal(by: model.reveal!.dailyKcal * -1 + 900)
    XCTAssertEqual(model.reveal!.dailyKcal, 1200, "edited kcal must clamp at the female floor")
    XCTAssertTrue(model.reveal!.floored)
    // Macros re-derive from the floored target at 30/40/30.
    XCTAssertEqual(model.reveal!.proteinG, 90)
    XCTAssertEqual(model.reveal!.carbsG, 120)
    XCTAssertEqual(model.reveal!.fatG, 40)
  }
}
