import Accessibility
import Charts
import CoachCalCore
import CoachCalDesignSystem
import SwiftUI

// Projection is deliberately free of any calorie-energy strings (contract:
// kg + weeks framing only — grep this file for the forbidden unit must stay at zero).
struct ProjectionView: View {
  let model: OnboardingModel

  private struct Series {
    let weeks: Int
    let nominal: [(week: Int, weight: Double)]
    let lower: [(week: Int, weight: Double)]
    let upper: [(week: Int, weight: Double)]
  }

  private var series: Series {
    let start = model.draft.weightKg
    let goalTarget = TargetsEngine.sanitizedGoalWeightKg(model.draft.goalWeightKg ?? start)
    let pace = TargetsEngine.targets(for: model.draft).paceKgPerWeek
    let delta = abs(start - goalTarget)
    let weeks = pace > 0 ? min(Int((delta / pace).rounded(.up)), 156) : 0

    func path(_ rate: Double) -> [(week: Int, weight: Double)] {
      let weeksAtRate = rate > 0 ? delta / rate : .infinity
      return (0...max(weeks, 1)).map { week in
        let progress = min(Double(week) / weeksAtRate, 1)
        return (week, start + (goalTarget - start) * progress)
      }
    }

    let nominal = path(pace)
    let fast = path(pace * 1.3)
    let slow = pace > 0 ? path(pace * 0.7) : nominal
    let lower = zip(fast, slow).map { (week: $0.0.week, weight: min($0.0.weight, $0.1.weight)) }
    let upper = zip(fast, slow).map { (week: $0.0.week, weight: max($0.0.weight, $0.1.weight)) }
    return Series(weeks: weeks, nominal: nominal, lower: lower, upper: upper)
  }

  private var kgDifference: Int {
    let start = model.draft.weightKg
    let goalTarget = TargetsEngine.sanitizedGoalWeightKg(model.draft.goalWeightKg ?? start)
    switch model.draft.goal {
    case .gain:
      return Int(max(goalTarget - start, 0).rounded())
    case .lose, .maintain, .habit:
      return Int(max(start - goalTarget, 0).rounded())
    }
  }

  private var kgLabel: String {
    model.draft.goal == .gain ? "kg to gain" : "kg to lose"
  }

  private var goalDateText: String {
    let formatter = DateFormatter()
    formatter.dateFormat = "MMM yyyy"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    let weeksAhead = max(series.weeks, 1)
    let date = Calendar.current.date(byAdding: .weekOfYear, value: weeksAhead, to: model.currentDate()) ?? model.currentDate()
    return formatter.string(from: date)
  }

  var body: some View {
    OnboardingStepScaffold(
      title: "Your projection",
      subtitle: "Based on your inputs",
      progress: model.progress,
      action: { model.advance() }
    ) {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Starting")
              .ccFont(.caption)
              .foregroundStyle(Color.ccTextSecondary)
            Text("\(Int(model.draft.weightKg)) kg")
              .ccFont(.headline)
              .foregroundStyle(Color.ccTextPrimary)
              .accessibilityIdentifier("onboarding.projectionStart")
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 2) {
            Text("Goal by \(goalDateText)")
              .ccFont(.caption)
              .foregroundStyle(Color.ccTextSecondary)
            Text("\(Int(TargetsEngine.sanitizedGoalWeightKg(model.draft.goalWeightKg ?? model.draft.weightKg))) kg")
              .ccFont(.headline)
              .foregroundStyle(Color.ccAccentInk)
              .accessibilityIdentifier("onboarding.projectionGoal")
          }
        }
        chart
        HStack {
          Text("Today")
          Spacer()
          Text("\(series.weeks) weeks")
        }
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
        .accessibilityHidden(true)
        HStack(spacing: CCSpace.md) {
          statCard(value: kgDifference, label: kgLabel, identifier: "onboarding.projectionKg")
          statCard(value: series.weeks, label: "weeks", identifier: "onboarding.projectionWeeks")
        }
        CCBannerNote(markdown: OnboardingCopy.projectionDisclaimer)
          .accessibilityIdentifier("onboarding.projectionDisclaimer")
      }
    }
  }

  private var chart: some View {
    Chart {
      ForEach(Array(zip(series.lower, series.upper)), id: \.0.week) { pair in
        AreaMark(
          x: .value("Week", pair.0.week),
          yStart: .value("Low", pair.0.weight),
          yEnd: .value("High", pair.1.weight)
        )
        .foregroundStyle(Color.ccAccentLime.opacity(0.15))
      }
      ForEach(series.nominal, id: \.week) { point in
        LineMark(x: .value("Week", point.week), y: .value("Weight", point.weight))
          .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
          .foregroundStyle(Color.ccAccentLime)
      }
      if let first = series.nominal.first, let last = series.nominal.last {
        PointMark(x: .value("Week", first.week), y: .value("Weight", first.weight))
          .symbolSize(16)
          .foregroundStyle(Color.ccAccentLime)
        PointMark(x: .value("Week", last.week), y: .value("Weight", last.weight))
          .symbolSize(16)
          .foregroundStyle(Color.ccAccentLime)
      }
    }
    .chartXAxis {
      AxisMarks(values: .automatic) { _ in
        AxisGridLine().foregroundStyle(Color.ccTextTertiary.opacity(0.2))
        AxisValueLabel()
          .font(.caption)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .chartYAxis {
      AxisMarks(values: .automatic) { _ in
        AxisGridLine().foregroundStyle(Color.ccTextTertiary.opacity(0.2))
        AxisValueLabel()
          .font(.caption)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .frame(height: 180)
    .accessibilityIdentifier("onboarding.projectionChart")
    .accessibilityChartDescriptor(ProjectionChartDescriptor(points: series.nominal))
  }

  private func statCard(value: Int, label: String, identifier: String) -> some View {
    VStack(spacing: CCSpace.xs) {
      Text("\(value)")
        .font(.system(size: 28, weight: .bold))
        .monospacedDigit()
        .foregroundStyle(Color.ccAccentInk)
      Text(label)
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .frame(maxWidth: .infinity)
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(value) \(label)")
    .accessibilityIdentifier(identifier)
  }
}

// `.accessibilityChart` is not a SwiftUI API — the chart-a11y contract is this
// descriptor representable (RESEARCH Pitfall 2, same as the DS CCChartCard).
private struct ProjectionChartDescriptor: AXChartDescriptorRepresentable {
  let points: [(week: Int, weight: Double)]

  func makeChartDescriptor() -> AXChartDescriptor {
    let values = points.map(\.weight)
    let xAxis = AXCategoricalDataAxisDescriptor(
      title: "Week",
      categoryOrder: points.map { "Week \($0.week)" }
    )
    let yAxis = AXNumericDataAxisDescriptor(
      title: "Weight (kg)",
      range: (values.min() ?? 0)...(values.max() ?? 1),
      gridlinePositions: [],
      valueDescriptionProvider: { String($0) }
    )
    let series = AXDataSeriesDescriptor(
      name: "Projected weight",
      isContinuous: true,
      dataPoints: points.map { point in
        AXDataPoint(
          __x: AXDataPointValue(__category: "Week \(point.week)"),
          y: AXDataPointValue(__number: point.weight)
        )
      }
    )
    return AXChartDescriptor(
      __title: "Weight projection",
      summary: nil,
      xAxisDescriptor: xAxis,
      yAxisDescriptor: yAxis,
      series: [series]
    )
  }
}
