import CoachCalDesignSystem
import SwiftUI

// TRK-04 weekly energy: 7 day-labeled bars + avg-deficit footer. Status is
// never color-only — every bar carries a value label and a day initial.
// The whole card is calorie (deficit) framing, so ED-Safe hides it entirely.
struct WeeklyEnergyView: View {
  let model: ProgressModel

  static let maxBarHeight: CGFloat = 96

  var body: some View {
    CCCard {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        CCSectionHeader("Weekly energy")

        HStack(alignment: .bottom, spacing: CCSpace.sm) {
          ForEach(model.weekKcals) { entry in
            WeeklyEnergyColumn(
              entry: entry,
              targetKcal: model.targetKcal,
              scaleKcal: Self.scaleKcal(model.weekKcals, targetKcal: model.targetKcal)
            )
            .frame(maxWidth: .infinity)
          }
        }

        HStack {
          CCSectionHeader("Avg deficit")
          Spacer()
          Text(Self.footerText(targetKcal: model.targetKcal, weekKcals: model.weekKcals))
            .ccFont(.footnote)
            .monospacedDigit()
            .foregroundStyle(Color.ccTextPrimary)
        }
      }
    }
    .edSafeHidden()
  }

  static func scaleKcal(_ weekKcals: [ProgressModel.DayKcal], targetKcal: Int?) -> Double {
    let values = weekKcals.compactMap(\.kcal)
    return Double(max(values.max() ?? 0, targetKcal ?? 0, 1))
  }

  static func footerText(targetKcal: Int?, weekKcals: [ProgressModel.DayKcal]) -> String {
    let values = weekKcals.compactMap(\.kcal)
    guard let targetKcal, !values.isEmpty else { return "—" }
    let average = Double(values.reduce(0, +)) / Double(values.count)
    let deficit = Int((Double(targetKcal) - average).rounded())
    if deficit >= 0 {
      return "−\(deficit) kcal/day"
    }
    return "+\(-deficit) kcal/day"
  }
}

private struct WeeklyEnergyColumn: View {
  let entry: ProgressModel.DayKcal
  let targetKcal: Int?
  let scaleKcal: Double

  var body: some View {
    VStack(spacing: CCSpace.xs) {
      Text(valueText)
        .ccFont(.footnote)
        .monospacedDigit()
        .foregroundStyle(Color.ccTextSecondary)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      UnevenRoundedRectangle(
        topLeadingRadius: 4,
        topTrailingRadius: 4,
        style: .continuous
      )
      .fill(fillColor)
      .frame(height: barHeight)
      .frame(maxHeight: WeeklyEnergyView.maxBarHeight, alignment: .bottom)
      Text(Self.dayInitial(forDay: entry.day))
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilityLabel)
  }

  private var valueText: String {
    entry.kcal.map { "\($0)" } ?? "–"
  }

  private var barHeight: CGFloat {
    guard let kcal = entry.kcal, scaleKcal > 0 else { return 8 }
    return max(WeeklyEnergyView.maxBarHeight * min(Double(kcal) / scaleKcal, 1), 8)
  }

  private var fillColor: Color {
    guard let kcal = entry.kcal else { return Color.white.opacity(0.1) }
    if let targetKcal, kcal > targetKcal {
      return Color.ccWarning.opacity(0.8)
    }
    return Color.ccSuccess.opacity(0.8)
  }

  private var accessibilityLabel: String {
    guard let kcal = entry.kcal else {
      return "\(Self.dayInitial(forDay: entry.day)): not logged"
    }
    return "\(Self.dayInitial(forDay: entry.day)): \(kcal) kcal"
  }

  static func dayInitial(forDay day: String) -> String {
    guard let date = ProgressModel.date(fromDay: day) else { return "?" }
    let weekday = ProgressModel.databaseCalendar.component(.weekday, from: date)
    let symbols = ProgressModel.databaseCalendar.veryShortWeekdaySymbols
    return symbols[weekday - 1]
  }
}
