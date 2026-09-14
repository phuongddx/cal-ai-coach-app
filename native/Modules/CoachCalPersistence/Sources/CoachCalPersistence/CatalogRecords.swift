import Foundation
import GRDB

public struct Food: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "foods"

  public let id: UUID
  public var name: String
  public var brand: String?
  public var per100gKcal: Int
  public var proteinG: Double
  public var carbsG: Double
  public var fatG: Double
  public var fiberG: Double
  public var servingGrams: Int?
  public var isCustom: Bool
  public var createdAt: Date

  public init(
    id: UUID,
    name: String,
    brand: String?,
    per100gKcal: Int,
    proteinG: Double,
    carbsG: Double,
    fatG: Double,
    fiberG: Double,
    servingGrams: Int?,
    isCustom: Bool,
    createdAt: Date
  ) {
    self.id = id
    self.name = name
    self.brand = brand
    self.per100gKcal = per100gKcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberG = fiberG
    self.servingGrams = servingGrams
    self.isCustom = isCustom
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, name, brand
    case per100gKcal = "per100g_kcal", proteinG = "protein_g", carbsG = "carbs_g"
    case fatG = "fat_g", fiberG = "fiber_g", servingGrams = "serving_grams"
    case isCustom = "is_custom", createdAt = "created_at"
  }
}

public struct SavedMeal: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "saved_meals"

  public let id: UUID
  public let userId: UUID
  public var name: String
  public var symbol: String?
  public var kcal: Int
  public var itemsJson: String
  public var createdAt: Date

  public init(
    id: UUID,
    userId: UUID,
    name: String,
    symbol: String?,
    kcal: Int,
    itemsJson: String,
    createdAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.name = name
    self.symbol = symbol
    self.kcal = kcal
    self.itemsJson = itemsJson
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", name, symbol, kcal
    case itemsJson = "items_json", createdAt = "created_at"
  }
}

public struct CustomFood: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "custom_foods"

  public let id: UUID
  public let userId: UUID
  public var name: String
  public var basis: String
  public var kcal: Int
  public var proteinG: Double
  public var carbsG: Double
  public var fatG: Double
  public var fiberG: Double
  public var servingGrams: Int?
  public var createdAt: Date

  public init(
    id: UUID,
    userId: UUID,
    name: String,
    basis: String,
    kcal: Int,
    proteinG: Double,
    carbsG: Double,
    fatG: Double,
    fiberG: Double,
    servingGrams: Int?,
    createdAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.name = name
    self.basis = basis
    self.kcal = kcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberG = fiberG
    self.servingGrams = servingGrams
    self.createdAt = createdAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", name, basis, kcal
    case proteinG = "protein_g", carbsG = "carbs_g", fatG = "fat_g", fiberG = "fiber_g"
    case servingGrams = "serving_grams", createdAt = "created_at"
  }
}
