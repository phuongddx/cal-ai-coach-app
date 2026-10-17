import SwiftUI
import ViewInspector
import XCTest

@testable import CoachCalDesignSystem

nonisolated final class ComponentContractTests: XCTestCase {
  // 1. CCConfidenceBadge — UI-SPEC thresholds (High ≥0.85, Medium ≥0.70, Low <0.70)
  //    with the exact label strings.
  func testConfidenceBadgeMapsTiersWithExactLabels() {
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.92), .high)
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.76), .medium)
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.61), .low)
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.85), .high)
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.70), .medium)
    XCTAssertEqual(CCConfidenceBadge.tier(for: 0.6999), .low)

    XCTAssertEqual(CCConfidenceBadge.label(for: .high), "High — single item")
    XCTAssertEqual(CCConfidenceBadge.label(for: .medium), "Medium — mixed dish")
    XCTAssertEqual(CCConfidenceBadge.label(for: .low), "Low — review needed")
  }

  func testConfidenceBadgeRendersItsLabel() throws {
    let badge = CCConfidenceBadge(confidence: 0.61)
    let texts = try badge.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Low — review needed"), "badge text: \(texts)")
  }

  // 2. CCStepper — steps +10, clamps at 0, adjustable a11y value.
  func testStepperStepsAndClampsAtZero() throws {
    var value = 50
    let stepper = CCStepper(
      name: "Rice",
      value: Binding(get: { value }, set: { value = $0 })
    )
    let inspect = try stepper.inspect()
    try inspect.hStack().button(0).tap()
    XCTAssertEqual(value, 40)
    try inspect.hStack().button(2).tap()
    XCTAssertEqual(value, 50)

    value = 5
    let clamped = try CCStepper(
      name: "Rice",
      value: Binding(get: { value }, set: { value = $0 })
    ).inspect()
    try clamped.hStack().button(0).tap()
    XCTAssertEqual(value, 0, "stepper must clamp at 0 grams")
    try clamped.hStack().button(0).tap()
    XCTAssertEqual(value, 0, "stepper must never go negative")
  }

  func testStepperAdjustableActionMatchesButtons() {
    var value = 180
    let stepper = CCStepper(
      name: "Rice",
      value: Binding(get: { value }, set: { value = $0 })
    )
    stepper.adjust(.decrement)
    XCTAssertEqual(value, 170)
    value = 5
    stepper.adjust(.decrement)
    XCTAssertEqual(value, 0, "adjustable action must clamp at 0 grams")
    stepper.adjust(.decrement)
    XCTAssertEqual(value, 0)
    stepper.adjust(.increment)
    XCTAssertEqual(value, 10)
  }

  // 3. CCOptionCard — selected/unselected visual state mapping.
  func testOptionCardSelectionStateBooleans() {
    let selected = CCOptionCard(title: "Lose weight", icon: "flame", isSelected: true)
    XCTAssertEqual(selected.selectionBorderWidth, 2)
    XCTAssertEqual(selected.selectionBorderColor, Color.ccAccentLime)
    XCTAssertEqual(selected.iconTileColor, Color.ccAccentLime.opacity(0.15))

    let unselected = CCOptionCard(title: "Lose weight", icon: "flame", isSelected: false)
    XCTAssertEqual(unselected.selectionBorderWidth, 1)
    XCTAssertEqual(unselected.selectionBorderColor, Color.ccBorder)
    XCTAssertEqual(unselected.iconTileColor, Color.ccSurface)
  }

  // 4. CCWarningChip — full string with kcal clause, ED-Safe drops it.
  func testWarningChipEDSafeDropsKcalClause() {
    XCTAssertEqual(
      CCWarningChip.text(reason: "Dressing not visible", addedKcal: 160, edSafeMode: false),
      "Dressing not visible — +160 kcal added (editable)"
    )
    XCTAssertEqual(
      CCWarningChip.text(reason: "Dressing not visible", addedKcal: 160, edSafeMode: true),
      "Dressing not visible — review portion"
    )
  }

  func testWarningChipRendersFullStringByDefault() throws {
    let chip = CCWarningChip(reason: "Dressing not visible", addedKcal: 160)
    let texts = try chip.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(
      texts.contains("Dressing not visible — +160 kcal added (editable)"),
      "chip text: \(texts)"
    )
  }

  // 5. CCToast — kcal footnote hidden under ED-Safe.
  func testToastHidesKcalLineUnderEDSafe() {
    XCTAssertNil(CCToast.visibleKcalText("640 kcal added", edSafeMode: true))
    XCTAssertEqual(CCToast.visibleKcalText("640 kcal added", edSafeMode: false), "640 kcal added")
  }

  func testToastRendersTitleAndKcalByDefault() throws {
    let toast = CCToast(
      title: "Saved to Lunch",
      kcalText: "640 kcal added",
      onUndo: {}
    )
    let texts = try toast.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Saved to Lunch"), "toast texts: \(texts)")
    XCTAssertTrue(texts.contains("640 kcal added"), "toast texts: \(texts)")
    // ViewInspector cannot unwrap the optional conditional Button child (nor read
    // Button labels publicly) — the undo affordance's title comes from the API value.
    XCTAssertEqual(toast.undoTitle, "Undo")
    XCTAssertNotNil(toast.onUndo)
  }

  // 6. CCCalorieRing — ED-Safe shows fraction-of-day %, never kcal.
  func testCalorieRingEDSafeShowsPercentOfDayNotKcal() {
    XCTAssertEqual(CCCalorieRing.dayPercentText(0.0), "0% of day")
    XCTAssertEqual(CCCalorieRing.dayPercentText(0.583), "58% of day")
    XCTAssertEqual(CCCalorieRing.dayPercentText(1.4), "100% of day")
  }

  func testCalorieRingDefaultEnvShowsRemaining() throws {
    let ring = CCCalorieRing(consumed: 543, goal: 2150, variant: .hero)
    let texts = try ring.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("1607"), "ring texts: \(texts)")
    XCTAssertTrue(texts.contains("remaining"), "ring texts: \(texts)")
    XCTAssertEqual(ring.a11yLabel, "1607 calories remaining of 2150 goal")
  }

  // 7. CCChartCard — real AX chart descriptor (no .accessibilityChart API exists).
  func testChartCardProducesChartDescriptor() {
    let points = (0..<4).map { index in
      CCChartCard.Point(
        date: Date(timeIntervalSinceReferenceDate: Double(index) * 86_400),
        value: 82.4 - Double(index) * 0.35,
        label: "Day \(index)"
      )
    }
    let descriptor = CCChartDescriptor(points: points).makeChartDescriptor()
    XCTAssertNotNil(descriptor)
    XCTAssertEqual(descriptor.series.count, 1)
    let seriesPoints = descriptor.series.first?.dataPoints ?? []
    XCTAssertEqual(seriesPoints.count, points.count)
  }
}
