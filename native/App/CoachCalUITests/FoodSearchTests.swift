import XCTest

nonisolated final class FoodSearchTests: XCTestCase {
  @MainActor
  func testSearchFindsSeededFoods() {
    let app = launchToFoodSearch()

    app.textFields["search.field"].tap()
    app.textFields["search.field"].typeText("chicken")

    let row = app.descendants(matching: .any).matching(identifier: "search.foodRow").firstMatch
    XCTAssertTrue(
      row.waitForExistence(timeout: 10) && row.label.contains("Chicken Breast"),
      "search must surface seeded foods, got: \(row.label)"
    )
    app.terminate()
  }

  @MainActor
  func testEmptyResultsShowVerbatimStateAndCreateEntry() {
    let app = launchToFoodSearch()

    app.textFields["search.field"].tap()
    app.textFields["search.field"].typeText("qqzzxx")

    let empty = app.descendants(matching: .any)["search.emptyState"]
    XCTAssertTrue(
      empty.waitForExistence(timeout: 10),
      "verbatim empty state must render for a query with no matches"
    )
    XCTAssertTrue(empty.staticTexts["No results for “qqzzxx”"].exists)
    XCTAssertTrue(
      empty.staticTexts["Try a different search or create a custom food."].exists
    )
    XCTAssertTrue(
      app.buttons["search.createCustom"].exists,
      "persistent Create custom food row missing"
    )
    app.terminate()
  }

  @MainActor
  func testCustomFoodCreateThenRefind() {
    let app = launchToFoodSearch()

    // Query first so the verbatim empty state offers the create entry, and the
    // pending query re-runs when the custom food is saved.
    app.textFields["search.field"].tap()
    XCTAssertTrue(app.keyboards.element.waitForExistence(timeout: 5), "keyboard missing")
    app.textFields["search.field"].typeText("punch")

    let empty = app.descendants(matching: .any)["search.emptyState"]
    XCTAssertTrue(empty.waitForExistence(timeout: 10), "empty state missing for 'punch'")

    app.buttons["search.createCustom"].tap()
    let nameField = app.textFields["custom.nameField"]
    XCTAssertTrue(nameField.waitForExistence(timeout: 10), "custom food sheet missing")
    nameField.tap()
    nameField.typeText("Mila Punch")
    let kcalField = app.textFields["custom.kcalField"]
    kcalField.tap()
    kcalField.typeText("120\n")
    app.buttons["custom.save"].tap()

    let row = app.descendants(matching: .any).matching(identifier: "search.foodRow").firstMatch
    XCTAssertTrue(
      row.waitForExistence(timeout: 10) && row.label.contains("Mila Punch"),
      "created custom food must appear in the pending search, got: \(row.label)"
    )
    app.terminate()
  }

  @MainActor
  func testManualLogFromRowShowsToastAndDiaryRow() {
    let app = launchToFoodSearch()

    app.textFields["search.field"].tap()
    app.textFields["search.field"].typeText("chicken")
    let row = app.descendants(matching: .any).matching(identifier: "search.foodRow").firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 10))
    row.tap()

    let kcalLabel = app.staticTexts["manual.kcal"]
    XCTAssertTrue(kcalLabel.waitForExistence(timeout: 10), "manual log sheet missing")
    XCTAssertEqual(kcalLabel.label, "248", "kcal must equal 165×150/100 for the default 150 g")

    app.buttons["manual.save"].tap()

    // The toast auto-dismisses after 4 s — resolve both labels in one query so
    // the assertion can't straddle the dismissal.
    let toastTexts = app.staticTexts.matching(
      NSPredicate(format: "label IN %@", ["Saved to Breakfast", "248 kcal added"])
    )
    XCTAssertTrue(
      toastTexts.firstMatch.waitForExistence(timeout: 5),
      "save must surface the Saved toast over the diary"
    )
    XCTAssertEqual(
      toastTexts.allElementsBoundByIndex.map(\.label).sorted(),
      ["248 kcal added", "Saved to Breakfast"]
    )

    // Saving closes the whole sheet stack (Add Food route dismisses on receipt)
    // and surfaces the toast over the diary — go straight to the row check.
    app.swipeDown()
    let diaryRow = app.descendants(matching: .any).matching(identifier: "diary.foodRow").firstMatch
    let predicate = NSPredicate(format: "label CONTAINS %@", "Chicken")
    let expectation = expectation(for: predicate, evaluatedWith: diaryRow)
    XCTAssertTrue(
      XCTWaiter().wait(for: [expectation], timeout: 10) == .completed,
      "manual log must write a diary row for the meal"
    )
    app.terminate()
  }

  // LOG-07: one-tap re-log. "Protein Oats" is the discriminator — no seeded
  // diary row, food, or other saved meal carries that title, so the asserted
  // diary row can only be the re-logged write.
  @MainActor
  func testSavedMealRailRelogWritesDiaryRowAndToast() {
    let app = XCUIApplication()
    app.terminate()
    app.launchArguments = ["--ccFreshStart"]
    app.launch()
    app.terminate()

    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()

    let mealRow = app.descendants(matching: .any).matching(identifier: "today.foodRow").firstMatch
    XCTAssertTrue(mealRow.waitForExistence(timeout: 15), "seeded Today row missing")
    app.swipeUp()
    mealRow.tap()

    let addFood = app.buttons["diary.addFood.breakfast"]
    XCTAssertTrue(addFood.waitForExistence(timeout: 10), "diary dashed Add food missing")
    addFood.tap()

    let searchTile = app.buttons["addfood.tile.search"]
    XCTAssertTrue(searchTile.waitForExistence(timeout: 10), "Add Food sheet missing")
    // The sheet opens at the medium detent; the saved-meals rail sits below
    // the fold until the sheet expands to large.
    app.swipeUp()

    let cards = app.descendants(matching: .any).matching(identifier: "addfood.savedMeal")
    let emptyCard = app.descendants(matching: .any).matching(identifier: "addfood.savedMealsEmpty").firstMatch
    XCTAssertTrue(
      cards.firstMatch.waitForExistence(timeout: 10),
      "saved-meals rail missing after detent expand (empty card present: \(emptyCard.exists))"
    )
    let oatsCard = cards.matching(NSPredicate(format: "label CONTAINS %@", "Protein Oats")).firstMatch
    XCTAssertTrue(oatsCard.waitForExistence(timeout: 5), "seeded Protein Oats rail card missing")
    oatsCard.tap()

    // The re-log writes through the diary repositories, then dismisses the
    // sheet and toasts over the diary — same receipt plumbing as manual log.
    let toastTexts = app.staticTexts.matching(
      NSPredicate(format: "label IN %@", ["Saved to Breakfast", "380 kcal added"])
    )
    XCTAssertTrue(
      toastTexts.firstMatch.waitForExistence(timeout: 10),
      "one-tap re-log must surface the Saved toast over the diary"
    )
    XCTAssertEqual(
      toastTexts.allElementsBoundByIndex.map(\.label).sorted(),
      ["380 kcal added", "Saved to Breakfast"]
    )

    app.swipeDown()
    let reloggedRow = app.descendants(matching: .any)
      .matching(identifier: "diary.foodRow")
      .matching(NSPredicate(format: "label CONTAINS %@", "Protein Oats"))
      .firstMatch
    XCTAssertTrue(
      reloggedRow.waitForExistence(timeout: 10),
      "one-tap re-log must write a diary row for the saved meal"
    )
    app.terminate()
  }

  // Navigation: seeded Today → Recent meals row → Day View → dinner Add food.
  @MainActor
  private func launchToFoodSearch() -> XCUIApplication {
    let app = XCUIApplication()
    app.terminate()
    app.launchArguments = ["--ccFreshStart"]
    app.launch()
    app.terminate()

    app.launchArguments = ["--ccDisableAnimations"]
    app.launch()

    let mealRow = app.descendants(matching: .any).matching(identifier: "today.foodRow").firstMatch
    XCTAssertTrue(mealRow.waitForExistence(timeout: 15), "seeded Today row missing")
    app.swipeUp()
    mealRow.tap()

    // Breakfast is the first section, so its dashed button is materialized
    // without scrolling (List rows below the fold are not in the hierarchy).
    let addFood = app.buttons["diary.addFood.breakfast"]
    XCTAssertTrue(addFood.waitForExistence(timeout: 10), "diary dashed Add food missing")
    addFood.tap()

    let searchTile = app.buttons["addfood.tile.search"]
    XCTAssertTrue(searchTile.waitForExistence(timeout: 10), "Add Food sheet missing")
    searchTile.tap()

    let field = app.textFields["search.field"]
    XCTAssertTrue(field.waitForExistence(timeout: 10), "food search missing")
    return app
  }
}
