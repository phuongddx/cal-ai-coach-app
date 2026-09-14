import SwiftUI

// Group E weekly review stat row (600 20 accent value + caption). Under
// ED-Safe the kcal-derived "% on target" and kg framing swap for "weeks with
// all meals logged" (TRU-04 weekly-average rule) — the branch lives here, in
// the design system, never in feature files.
public struct CCWeeklyReviewStats: View {
  public struct Stat: Equatable, Identifiable, Sendable {
    public let id: String
    public let label: String
    public let value: String

    public init(id: String, label: String, value: String) {
      self.id = id
      self.label = label
      self.value = value
    }
  }

  let daysLogged: Int
  let daysOnTarget: Int
  let weeksAllLogged: Int
  let kgThisWeek: Double

  @Environment(\.edSafeMode) private var edSafeMode

  public init(
    daysLogged: Int,
    daysOnTarget: Int,
    weeksAllLogged: Int,
    kgThisWeek: Double
  ) {
    self.daysLogged = daysLogged
    self.daysOnTarget = daysOnTarget
    self.weeksAllLogged = weeksAllLogged
    self.kgThisWeek = kgThisWeek
  }

  public var body: some View {
    HStack(alignment: .top, spacing: CCSpace.lg) {
      ForEach(Self.visibleStats(
        daysLogged: daysLogged,
        daysOnTarget: daysOnTarget,
        weeksAllLogged: weeksAllLogged,
        kgThisWeek: kgThisWeek,
        edSafeMode: edSafeMode
      )) { stat in
        VStack(alignment: .leading, spacing: 2) {
          Text(stat.value)
            .font(.system(size: 20, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Color.ccAccentInk)
          Text(stat.label)
            .ccFont(.caption)
            .foregroundStyle(Color.ccTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }

  // Pure stat-visibility core so both ED-Safe branches are assertable without
  // environment injection (ViewInspector cannot inject EnvironmentValues).
  public static func visibleStats(
    daysLogged: Int,
    daysOnTarget: Int,
    weeksAllLogged: Int,
    kgThisWeek: Double,
    edSafeMode: Bool
  ) -> [Stat] {
    var visible = [
      Stat(id: "days", label: "Days logged", value: "\(daysLogged)")
    ]
    if edSafeMode {
      visible.append(
        Stat(id: "weeks", label: "Weeks with all meals logged", value: "\(weeksAllLogged)")
      )
    } else {
      let percent = daysLogged > 0
        ? Int((Double(daysOnTarget) / Double(daysLogged) * 100).rounded())
        : 0
      visible.append(Stat(id: "target", label: "% on target", value: "\(percent)%"))
      visible.append(Stat(id: "kg", label: "kg this week", value: kgValue(kgThisWeek)))
    }
    return visible
  }

  public static func kgValue(_ kg: Double) -> String {
    let rounded = (kg * 10).rounded() / 10
    if rounded > 0 { return "+" + String(format: "%.1f", rounded) }
    if rounded < 0 { return "−" + String(format: "%.1f", -rounded) }
    return "0.0"
  }
}
