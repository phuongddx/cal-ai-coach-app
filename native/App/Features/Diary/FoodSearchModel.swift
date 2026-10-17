import CoachCalPersistence
import Foundation
import GRDB
import Observation

@MainActor
@Observable
final class FoodSearchModel {
  // Unified search row: seeded per-100g foods and per-serving custom foods.
  struct Row: Identifiable, Equatable {
    let id: UUID
    let name: String
    let kcal: Int
    let proteinG: Double
    let basis: String
    let servingGrams: Int?
    let isCustom: Bool

    init(food: Food) {
      id = food.id
      name = food.name
      kcal = food.per100gKcal
      proteinG = food.proteinG
      basis = "per_100g"
      servingGrams = food.servingGrams
      isCustom = food.isCustom
    }

    init(custom: CustomFood) {
      id = custom.id
      name = custom.name
      kcal = custom.kcal
      proteinG = custom.proteinG
      basis = custom.basis
      servingGrams = custom.servingGrams
      isCustom = true
    }
  }

  static let recentLimit = 5

  var query = "" {
    didSet { scheduleSearch() }
  }
  private(set) var results: [Row] = []
  private(set) var recents: [Row] = []

  private let catalog: CatalogRepository
  private var debounceTask: Task<Void, Never>?

  init(catalog: CatalogRepository) {
    self.catalog = catalog
    Task { await loadRecents() }
  }

  func loadRecents() async {
    let foods = (try? await catalog.recentFoods(limit: Self.recentLimit)) ?? []
    recents = foods.map(Row.init(food:))
  }

  // Local LIKE search only — zero network (LOG-04). Debounced at the model
  // boundary so fast typing bounds query cost (T-P04-04).
  private func scheduleSearch() {
    debounceTask?.cancel()
    let trimmed = query.trimmingCharacters(in: .whitespaces)
    debounceTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 200_000_000)
      guard !Task.isCancelled else { return }
      await self?.applySearch(trimmed)
    }
  }

  func applySearch(_ rawQuery: String) async {
    let trimmed = rawQuery.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else {
      results = []
      await loadRecents()
      return
    }
    var rows = ((try? await catalog.searchFoods(query: trimmed)) ?? []).map(Row.init(food:))
    let customs = (try? await catalog.customFoods()) ?? []
    rows.append(
      contentsOf: customs
        .filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
        .map(Row.init(custom:))
    )
    results = rows
  }
}
