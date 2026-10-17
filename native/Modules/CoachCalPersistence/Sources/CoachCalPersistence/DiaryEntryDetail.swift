import Foundation
import GRDB

public struct DiaryEntryDetail: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "diary_entry_details"

  public let entryId: UUID
  public var mealSlot: String
  public var title: String
  public var grams: Int?
  public var kcal: Int?
  public var proteinG: Double?
  public var carbsG: Double?
  public var fatG: Double?
  public var fiberG: Double?
  public var confidence: Double?
  public var hiddenFatLikely: Bool
  public var source: String?
  public var unresolved: Bool
  public var scanId: String?

  public init(
    entryId: UUID,
    mealSlot: String,
    title: String,
    grams: Int?,
    kcal: Int?,
    proteinG: Double?,
    carbsG: Double?,
    fatG: Double?,
    fiberG: Double?,
    confidence: Double?,
    hiddenFatLikely: Bool,
    source: String?,
    unresolved: Bool,
    scanId: String?
  ) {
    self.entryId = entryId
    self.mealSlot = mealSlot
    self.title = title
    self.grams = grams
    self.kcal = kcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberG = fiberG
    self.confidence = confidence
    self.hiddenFatLikely = hiddenFatLikely
    self.source = source
    self.unresolved = unresolved
    self.scanId = scanId
  }

  private enum CodingKeys: String, CodingKey {
    case entryId = "entry_id", mealSlot = "meal_slot", title, grams, kcal
    case proteinG = "protein_g", carbsG = "carbs_g", fatG = "fat_g", fiberG = "fiber_g"
    case confidence
    case hiddenFatLikely = "hidden_fat_likely", source, unresolved
    case scanId = "scan_id"
  }
}
