import Foundation
import GRDB

public struct UserTarget: Codable, Equatable, FetchableRecord, PersistableRecord,
  Sendable
{
  public static let databaseTableName = "user_targets"

  public let id: UUID
  public let userId: UUID
  public var dailyKcal: Int
  public var proteinG: Int
  public var carbsG: Int
  public var fatG: Int
  public var fiberGoalG: Int
  public var waterGlasses: Int
  public var sex: String
  public var heightCm: Double?
  public var weightKg: Double?
  public var goalWeightKg: Double?
  public var paceKgPerWeek: Double?
  public var activity: String
  public var goal: String
  public var updatedAt: Date

  public init(
    id: UUID,
    userId: UUID,
    dailyKcal: Int,
    proteinG: Int,
    carbsG: Int,
    fatG: Int,
    fiberGoalG: Int,
    waterGlasses: Int,
    sex: String,
    heightCm: Double?,
    weightKg: Double?,
    goalWeightKg: Double?,
    paceKgPerWeek: Double?,
    activity: String,
    goal: String,
    updatedAt: Date
  ) {
    self.id = id
    self.userId = userId
    self.dailyKcal = dailyKcal
    self.proteinG = proteinG
    self.carbsG = carbsG
    self.fatG = fatG
    self.fiberGoalG = fiberGoalG
    self.waterGlasses = waterGlasses
    self.sex = sex
    self.heightCm = heightCm
    self.weightKg = weightKg
    self.goalWeightKg = goalWeightKg
    self.paceKgPerWeek = paceKgPerWeek
    self.activity = activity
    self.goal = goal
    self.updatedAt = updatedAt
  }

  private enum CodingKeys: String, CodingKey {
    case id, userId = "user_id", dailyKcal = "daily_kcal", proteinG = "protein_g"
    case carbsG = "carbs_g", fatG = "fat_g", fiberGoalG = "fiber_goal_g"
    case waterGlasses = "water_glasses", sex
    case heightCm = "height_cm", weightKg = "weight_kg", goalWeightKg = "goal_weight_kg"
    case paceKgPerWeek = "pace_kg_per_week", activity, goal
    case updatedAt = "updated_at"
  }
}
