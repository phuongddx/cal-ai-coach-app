import Foundation
import GRDB

public struct SeedDataManager: Sendable {
  static let seedVersionKey = "seed_version"
  static let seedVersion = "demo_v1"

  private let database: DatabasePool
  private let now: @Sendable () -> Date

  public init(database: DatabasePool, now: @escaping @Sendable () -> Date = { Date() }) {
    self.database = database
    self.now = now
  }

  public func ensureSeeded(seedTargets: Bool = true) async throws {
    try await database.write { database in
      let seeded = try String.fetchOne(
        database,
        sql: "SELECT value FROM app_settings WHERE key = ?",
        arguments: [Self.seedVersionKey]
      )
      guard seeded != Self.seedVersion else { return }

      let current = now()
      let user = Self.demoUserId

      if seedTargets {
        let target = UserTarget(
          id: UUID(),
          userId: user,
          dailyKcal: 2150,
          proteinG: 130,
          carbsG: 220,
          fatG: 70,
          fiberGoalG: 30,
          waterGlasses: 8,
          sex: "female",
          heightCm: 165,
          weightKg: 82.4,
          goalWeightKg: 74,
          paceKgPerWeek: 0.5,
          activity: "moderate",
          goal: "lose",
          updatedAt: current
        )
        try target.insert(database)
      }

      for (offset, meal) in Self.seededMeals.enumerated() {
        let createdAt = current.addingTimeInterval(Double(-(6 - offset)) * 86_400)
        let entry = DiaryEntry(
          id: UUID(),
          userId: user,
          displayText: meal.title,
          createdAt: createdAt,
          updatedAt: createdAt,
          deletedAt: nil,
          serverVersion: Int64(100 + offset),
          acceptedOpId: UUID(),
          serverUpdatedAt: createdAt
        )
        try entry.insert(database)

        let detail = DiaryEntryDetail(
          entryId: entry.id,
          mealSlot: meal.slot,
          title: meal.title,
          grams: meal.grams,
          kcal: Self.kcal(per100gKcal: meal.per100gKcal, grams: meal.grams),
          proteinG: Self.macro(meal.proteinPer100g, meal.grams),
          carbsG: Self.macro(meal.carbsPer100g, meal.grams),
          fatG: Self.macro(meal.fatPer100g, meal.grams),
          fiberG: Self.macro(meal.fiberPer100g, meal.grams),
          confidence: meal.confidence,
          hiddenFatLikely: meal.hiddenFatLikely,
          source: "cache",
          unresolved: false,
          scanId: nil
        )
        try detail.insert(database)
      }

      for (offset, food) in Self.seededFoods.enumerated() {
        let createdAt = current.addingTimeInterval(Double(-offset) * 3_600)
        let row = Food(
          id: UUID(),
          name: food.name,
          brand: food.brand,
          per100gKcal: food.per100gKcal,
          proteinG: food.proteinPer100g,
          carbsG: food.carbsPer100g,
          fatG: food.fatPer100g,
          fiberG: food.fiberPer100g,
          servingGrams: food.servingGrams,
          isCustom: false,
          createdAt: createdAt
        )
        try row.insert(database)
      }

      let savedMeals: [SavedMeal] = [
        SavedMeal(
          id: UUID(),
          userId: user,
          name: "Chicken Rice Bowl",
          symbol: "fork.knife",
          kcal: 464,
          itemsJson: "[{\"name\":\"Chicken Rice Bowl\",\"grams\":320}]",
          createdAt: current
        ),
        SavedMeal(
          id: UUID(),
          userId: user,
          name: "Protein Oats",
          symbol: nil,
          kcal: 380,
          itemsJson: "[{\"name\":\"Protein Oats\",\"grams\":250}]",
          createdAt: current.addingTimeInterval(-600)
        ),
      ]
      for meal in savedMeals {
        try meal.insert(database)
      }

      let customFood = CustomFood(
        id: UUID(),
        userId: user,
        name: "Homemade Protein Shake",
        basis: "per_serving",
        kcal: 240,
        proteinG: 30,
        carbsG: 18,
        fatG: 4,
        fiberG: 2,
        servingGrams: 400,
        createdAt: current
      )
      try customFood.insert(database)

      let today = Self.dayString(current)
      for index in 0..<5 {
        try WaterLog(
          id: UUID(),
          userId: user,
          day: today,
          ml: 250,
          createdAt: current
        ).insert(database)
      }

      for index in 0..<8 {
        let day = Self.dayString(current.addingTimeInterval(Double(7 - index) * 7 * 86_400))
        try WeightLog(
          id: UUID(),
          userId: user,
          day: day,
          kg: 82.4 - Double(index) * 0.35,
          createdAt: current.addingTimeInterval(Double(7 - index) * 7 * 86_400)
        ).insert(database)
      }

      try ExerciseLog(
        id: UUID(),
        userId: user,
        day: today,
        exerciseType: "running",
        durationMin: 30,
        kcalBurned: 300,
        createdAt: current
      ).insert(database)
      try ExerciseLog(
        id: UUID(),
        userId: user,
        day: Self.dayString(current.addingTimeInterval(-86_400)),
        exerciseType: "strength",
        durationMin: 45,
        kcalBurned: nil,
        createdAt: current.addingTimeInterval(-86_400)
      ).insert(database)

      try StreakState(
        id: 1,
        currentStreak: 12,
        bestStreak: 18,
        freezesLeft: 1,
        freezeUsedOn: nil,
        lastLoggedDay: Self.dayString(current.addingTimeInterval(-86_400))
      ).insert(database)

      let badges: [Badge] = [
        Badge(
          id: UUID(),
          userId: user,
          code: "first-scan",
          label: "First Scan",
          detail: "Logged your first meal",
          earnedAt: current.addingTimeInterval(-6 * 86_400),
          progress: 1,
          target: 1
        ),
        Badge(
          id: UUID(),
          userId: user,
          code: "streak-7",
          label: "7-Day Streak",
          detail: "Logged meals seven days in a row",
          earnedAt: current.addingTimeInterval(-5 * 86_400),
          progress: 1,
          target: 1
        ),
        Badge(
          id: UUID(),
          userId: user,
          code: "water-habit",
          label: "Hydration Habit",
          detail: "Hit your water goal five times",
          earnedAt: current.addingTimeInterval(-2 * 86_400),
          progress: 1,
          target: 1
        ),
        Badge(
          id: UUID(),
          userId: user,
          code: "streak-30",
          label: "30-Day Streak",
          detail: nil,
          earnedAt: nil,
          progress: 12,
          target: 30
        ),
        Badge(
          id: UUID(),
          userId: user,
          code: "scans-50",
          label: "50 Scans",
          detail: nil,
          earnedAt: nil,
          progress: 18,
          target: 50
        ),
      ]
      for badge in badges {
        try badge.insert(database)
      }

      let insights: [Insight] = [
        Insight(
          id: UUID(),
          userId: user,
          day: today,
          kind: "streak",
          title: "12-day streak going strong",
          body: "Log today's meals to extend your streak to 13 days.",
          createdAt: current
        ),
        Insight(
          id: UUID(),
          userId: user,
          day: today,
          kind: "hydration",
          title: "Hydration is behind",
          body: "You've logged 1.25L so far. Aim for 2L by evening.",
          createdAt: current.addingTimeInterval(-60)
        ),
        Insight(
          id: UUID(),
          userId: user,
          day: today,
          kind: "protein",
          title: "Protein pacing looks good",
          body: "You're averaging 121g protein this week.",
          createdAt: current.addingTimeInterval(-120)
        ),
      ]
      for insight in insights {
        try insight.insert(database)
      }

      try database.execute(
        sql: "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
        arguments: [Self.seedVersionKey, Self.seedVersion]
      )
    }
  }

  static let demoUserId = UUID(uuidString: "DE000000-0000-4000-8000-000000000001")!

  private struct SeededMeal {
    let slot: String
    let title: String
    let grams: Int
    let per100gKcal: Int
    let proteinPer100g: Double
    let carbsPer100g: Double
    let fatPer100g: Double
    let fiberPer100g: Double
    let confidence: Double
    let hiddenFatLikely: Bool
  }

  private static let seededMeals: [SeededMeal] = [
    SeededMeal(
      slot: "breakfast", title: "Oatmeal with Blueberries", grams: 250,
      per100gKcal: 150, proteinPer100g: 6, carbsPer100g: 30, fatPer100g: 3,
      fiberPer100g: 4, confidence: 0.92, hiddenFatLikely: false
    ),
    SeededMeal(
      slot: "lunch", title: "Chicken Rice Bowl", grams: 320,
      per100gKcal: 145, proteinPer100g: 27, carbsPer100g: 40, fatPer100g: 4,
      fiberPer100g: 2, confidence: 0.92, hiddenFatLikely: false
    ),
    SeededMeal(
      slot: "dinner", title: "Salmon with Quinoa", grams: 300,
      per100gKcal: 180, proteinPer100g: 22, carbsPer100g: 28, fatPer100g: 6,
      fiberPer100g: 3, confidence: 0.76, hiddenFatLikely: false
    ),
    SeededMeal(
      slot: "snacks", title: "Greek Yogurt with Almonds", grams: 180,
      per100gKcal: 120, proteinPer100g: 10, carbsPer100g: 8, fatPer100g: 5,
      fiberPer100g: 1, confidence: 0.76, hiddenFatLikely: false
    ),
    SeededMeal(
      slot: "breakfast", title: "Avocado Toast with Egg", grams: 200,
      per100gKcal: 210, proteinPer100g: 8, carbsPer100g: 18, fatPer100g: 13,
      fiberPer100g: 5, confidence: 0.61, hiddenFatLikely: false
    ),
    SeededMeal(
      slot: "lunch", title: "Caesar Salad with Dressing", grams: 280,
      per100gKcal: 160, proteinPer100g: 9, carbsPer100g: 10, fatPer100g: 12,
      fiberPer100g: 2, confidence: 0.92, hiddenFatLikely: true
    ),
    SeededMeal(
      slot: "dinner", title: "Spaghetti Bolognese", grams: 350,
      per100gKcal: 155, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 5,
      fiberPer100g: 2, confidence: 0.61, hiddenFatLikely: false
    ),
  ]

  private struct SeededFood {
    let name: String
    let brand: String?
    let per100gKcal: Int
    let proteinPer100g: Double
    let carbsPer100g: Double
    let fatPer100g: Double
    let fiberPer100g: Double
    let servingGrams: Int?
  }

  private static let seededFoods: [SeededFood] = [
    SeededFood(name: "Grilled Chicken Burrito Bowl with Cilantro Lime Rice and Black Beans", brand: nil, per100gKcal: 145, proteinPer100g: 27, carbsPer100g: 40, fatPer100g: 4, fiberPer100g: 6, servingGrams: 400),
    SeededFood(name: "Chicken Breast", brand: nil, per100gKcal: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0, servingGrams: 150),
    SeededFood(name: "White Rice, Cooked", brand: nil, per100gKcal: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, servingGrams: 200),
    SeededFood(name: "Brown Rice, Cooked", brand: nil, per100gKcal: 123, proteinPer100g: 2.7, carbsPer100g: 26, fatPer100g: 1, fiberPer100g: 1.6, servingGrams: 200),
    SeededFood(name: "Greek Yogurt, Plain", brand: nil, per100gKcal: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 0, servingGrams: 170),
    SeededFood(name: "Whole Wheat Bread", brand: nil, per100gKcal: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4, fiberPer100g: 7, servingGrams: 45),
    SeededFood(name: "Avocado", brand: nil, per100gKcal: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 15, fiberPer100g: 6.7, servingGrams: 100),
    SeededFood(name: "Banana", brand: nil, per100gKcal: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, fiberPer100g: 2.6, servingGrams: 120),
    SeededFood(name: "Apple", brand: nil, per100gKcal: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, fiberPer100g: 2.4, servingGrams: 180),
    SeededFood(name: "Blueberries", brand: nil, per100gKcal: 57, proteinPer100g: 0.7, carbsPer100g: 14, fatPer100g: 0.3, fiberPer100g: 2.4, servingGrams: 100),
    SeededFood(name: "Salmon Fillet", brand: nil, per100gKcal: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, fiberPer100g: 0, servingGrams: 150),
    SeededFood(name: "Egg, Large", brand: nil, per100gKcal: 143, proteinPer100g: 13, carbsPer100g: 0.7, fatPer100g: 9.5, fiberPer100g: 0, servingGrams: 50),
    SeededFood(name: "Oats, Dry", brand: nil, per100gKcal: 389, proteinPer100g: 17, carbsPer100g: 66, fatPer100g: 7, fiberPer100g: 10, servingGrams: 60),
    SeededFood(name: "Spaghetti, Dry", brand: nil, per100gKcal: 371, proteinPer100g: 13, carbsPer100g: 75, fatPer100g: 1.5, fiberPer100g: 3.2, servingGrams: 90),
    SeededFood(name: "Quinoa, Cooked", brand: nil, per100gKcal: 120, proteinPer100g: 4.4, carbsPer100g: 21, fatPer100g: 1.9, fiberPer100g: 2.8, servingGrams: 180),
    SeededFood(name: "Almonds", brand: nil, per100gKcal: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, fiberPer100g: 12.5, servingGrams: 30),
    SeededFood(name: "Peanut Butter", brand: nil, per100gKcal: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, fiberPer100g: 6, servingGrams: 32),
    SeededFood(name: "Cottage Cheese", brand: nil, per100gKcal: 98, proteinPer100g: 11, carbsPer100g: 3.4, fatPer100g: 4.3, fiberPer100g: 0, servingGrams: 150),
    SeededFood(name: "Cheddar Cheese", brand: nil, per100gKcal: 403, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33, fiberPer100g: 0, servingGrams: 30),
    SeededFood(name: "Ground Beef, 90% Lean", brand: nil, per100gKcal: 176, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 10, fiberPer100g: 0, servingGrams: 150),
    SeededFood(name: "Tofu, Firm", brand: nil, per100gKcal: 144, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 9, fiberPer100g: 2, servingGrams: 120),
    SeededFood(name: "Lentils, Cooked", brand: nil, per100gKcal: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4, fiberPer100g: 8, servingGrams: 200),
    SeededFood(name: "Black Beans, Cooked", brand: nil, per100gKcal: 132, proteinPer100g: 9, carbsPer100g: 24, fatPer100g: 0.5, fiberPer100g: 9, servingGrams: 180),
    SeededFood(name: "Broccoli, Steamed", brand: nil, per100gKcal: 35, proteinPer100g: 2.4, carbsPer100g: 7, fatPer100g: 0.4, fiberPer100g: 3.3, servingGrams: 150),
    SeededFood(name: "Sweet Potato, Baked", brand: nil, per100gKcal: 90, proteinPer100g: 2, carbsPer100g: 21, fatPer100g: 0.1, fiberPer100g: 3.3, servingGrams: 200),
    SeededFood(name: "Olive Oil", brand: nil, per100gKcal: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, fiberPer100g: 0, servingGrams: 14),
    SeededFood(name: "Protein Powder, Whey", brand: "Synthetic Nutrition", per100gKcal: 375, proteinPer100g: 80, carbsPer100g: 8, fatPer100g: 3, fiberPer100g: 1, servingGrams: 32),
    SeededFood(name: "Caesar Dressing", brand: nil, per100gKcal: 450, proteinPer100g: 1, carbsPer100g: 4, fatPer100g: 47, fiberPer100g: 0, servingGrams: 30),
    SeededFood(name: "Cappuccino, Whole Milk", brand: nil, per100gKcal: 45, proteinPer100g: 2.4, carbsPer100g: 3.6, fatPer100g: 2.4, fiberPer100g: 0, servingGrams: 240),
    SeededFood(name: "Dark Chocolate, 70%", brand: nil, per100gKcal: 598, proteinPer100g: 7.8, carbsPer100g: 46, fatPer100g: 43, fiberPer100g: 11, servingGrams: 25),
  ]

  private static func kcal(per100gKcal: Int, grams: Int) -> Int {
    Int((Double(per100gKcal) * Double(grams) / 100).rounded())
  }

  private static func macro(_ per100g: Double, _ grams: Int) -> Double {
    (per100g * Double(grams) / 100 * 10).rounded() / 10
  }

  static func dayString(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
  }
}
