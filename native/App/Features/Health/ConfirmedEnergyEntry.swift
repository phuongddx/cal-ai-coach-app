import Foundation

// A user-confirmed energy value — the ONLY type `HealthKitService.writeBurnedEnergy` accepts. No
// initializer path accepts a ScanResponse/ScanItem or any AI-scan-derived type: the type itself is
// the enforcement mechanism (mirrors EdSafe.swift's "one seam owns the policy branch" convention —
// never a scattered `if isConfirmed` check at call sites).
struct ConfirmedEnergyEntry: Equatable, Sendable {
  let kcal: Int
  let confirmedAt: Date

  init(kcal: Int, confirmedAt: Date) {
    self.kcal = kcal
    self.confirmedAt = confirmedAt
  }
}
