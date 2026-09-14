import Accessibility
import Charts
import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// Feature-level chart a11y: real AXChartDescriptorRepresentable over the
// logged weight series (RESEARCH Pitfall 2 — `.accessibilityChart` is not a
// SwiftUI API).
struct WeightChartDescriptor: AXChartDescriptorRepresentable {
  let points: [CCChartCard.Point]

  init(points: [CCChartCard.Point]) {
    self.points = points
  }

  static func yRange(_ points: [CCChartCard.Point]) -> ClosedRange<Double> {
    let values = points.map(\.value)
    guard let min = values.min(), let max = values.max() else { return 0...1 }
    guard min < max else { return (min - 1)...(max + 1) }
    return min...max
  }

  func makeChartDescriptor() -> AXChartDescriptor {
    // This SDK/toolchain exposes only the NS_REFINED_FOR_SWIFT raw forms of
    // the audiograph chart API (same constraint as CCChartDescriptor).
    let xAxis = AXCategoricalDataAxisDescriptor(
      title: "Date",
      categoryOrder: points.map(\.label)
    )
    let yAxis = AXNumericDataAxisDescriptor(
      title: "Weight (kg)",
      range: Self.yRange(points),
      gridlinePositions: [],
      valueDescriptionProvider: { String(format: "%.1f kg", $0) }
    )
    let series = AXDataSeriesDescriptor(
      name: "Weight",
      isContinuous: true,
      dataPoints: points.map { point in
        AXDataPoint(
          __x: AXDataPointValue(__category: point.label),
          y: AXDataPointValue(__number: point.value)
        )
      }
    )
    return AXChartDescriptor(
      __title: "Weight trend",
      summary: nil,
      xAxisDescriptor: xAxis,
      yAxisDescriptor: yAxis,
      series: [series]
    )
  }
}

struct WeightTrendView: View {
  let model: ProgressModel

  @State private var isLogSheetPresented = false

  var body: some View {
    CCCard {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 2) {
            CCSectionHeader("Current")
            Text(currentWeightText)
              .font(.system(size: 20, weight: .semibold))
              .monospacedDigit()
              .foregroundStyle(Color.ccTextPrimary)
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 2) {
            CCSectionHeader("Goal")
            Text(goalWeightText)
              .font(.system(size: 20, weight: .semibold))
              .monospacedDigit()
              .foregroundStyle(Color.ccAccentInk)
          }
        }

        if model.weightPoints.count >= 2 {
          CCChartCard(points: model.weightPoints)
            .accessibilityChartDescriptor(WeightChartDescriptor(points: model.weightPoints))
        } else {
          Text("Log your weight to start the trend")
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextSecondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, CCSpace.xl)
        }

        progressRow

        CCPrimaryButton("Log weight") {
          isLogSheetPresented = true
        }
        .accessibilityIdentifier("progress.logWeight")
      }
    }
    .sheet(isPresented: $isLogSheetPresented) {
      WeightLogSheet(
        currentKg: model.latestKg,
        onSave: { kg in
          Task { try? await model.logWeight(kg) }
        },
        onDismiss: { isLogSheetPresented = false }
      )
      .presentationDetents([.medium, .large])
    }
  }

  // Direction icon keeps the status non-color-only (UI-SPEC a11y backstop).
  @ViewBuilder private var progressRow: some View {
    let copy = Self.trendCopy(kgLost: kgLost)
    HStack(spacing: CCSpace.xs) {
      Image(systemName: copy.symbol)
        .accessibilityHidden(true)
      Text(copy.text)
    }
    .ccFont(.subhead)
    .fontWeight(.medium)
    .monospacedDigit()
    .foregroundStyle(kgLost > 0.05 ? Color.ccSuccessInk : Color.ccTextSecondary)
    .accessibilityElement(children: .combine)
  }

  private var kgLost: Double {
    guard let start = model.startKg, let latest = model.latestKg else { return 0 }
    return start - latest
  }

  private var currentWeightText: String {
    model.latestKg.map { String(format: "%.1f kg", $0) } ?? "—"
  }

  private var goalWeightText: String {
    model.goalKg.map { String(format: "%.1f kg", $0) } ?? "—"
  }

  static func trendCopy(kgLost: Double) -> (symbol: String, text: String) {
    if kgLost > 0.05 {
      return (symbol: "arrow.down", text: String(format: "%.1f kg lost · on track", kgLost))
    }
    if kgLost < -0.05 {
      return (symbol: "arrow.up", text: String(format: "%.1f kg gained", -kgLost))
    }
    return (symbol: "arrow.right", text: "holding steady")
  }
}
