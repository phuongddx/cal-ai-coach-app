import Accessibility
import Charts
import SwiftUI

public struct CCFoodRow: View {
  public let title: String
  public var meta: String?
  public var kcal: Int?
  public var compactBadge: (any View)?
  public var syncPending: Bool

  @Environment(\.edSafeMode) private var edSafeMode

  public init(
    title: String,
    meta: String? = nil,
    kcal: Int? = nil,
    compactBadge: (any View)? = nil,
    syncPending: Bool = false
  ) {
    self.title = title
    self.meta = meta
    self.kcal = kcal
    self.compactBadge = compactBadge
    self.syncPending = syncPending
  }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: 10)
        .fill(Color.ccSurface)
        .frame(width: 40, height: 40)
        .overlay(
          Image(systemName: "fork.knife")
            .font(.system(size: 15))
            .foregroundStyle(Color.ccTextTertiary)
        )
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
        if let meta {
          Text(meta)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
            .lineLimit(2)
        }
        if let compactBadge {
          AnyView(compactBadge)
        }
      }

      Spacer(minLength: CCSpace.sm)

      if syncPending {
        HStack(spacing: CCSpace.xs) {
          Image(systemName: "clock")
            .font(.system(size: 11))
          Text("Syncs later")
            .ccFont(.caption)
        }
        .foregroundStyle(Color.ccTextTertiary)
      }

      if !edSafeMode, let kcal {
        Text("\(kcal) kcal")
          .font(.system(size: 14, weight: .medium))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
      }

      Image(systemName: "chevron.right")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.ccTextTertiary)
        .accessibilityHidden(true)
    }
    .padding(.vertical, CCSpace.sm)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(Color.ccBorder)
        .frame(height: 0.5)
    }
    .contentShape(Rectangle())
  }
}

public struct CCSectionHeader: View {
  public let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title)
      .ccFont(.caption)
      .textCase(.uppercase)
      .kerning(0.55)
      .foregroundStyle(Color.ccTextSecondary)
  }
}

public struct CCConfidenceBadge: View {
  public enum Tier: Sendable {
    case high
    case medium
    case low
  }

  public let confidence: Double
  public var compact: Bool = false

  public init(confidence: Double, compact: Bool = false) {
    self.confidence = confidence
    self.compact = compact
  }

  // UI-SPEC lock: High ≥0.85, Medium ≥0.70, Low <0.70 (server TIER1_MIN_SCAN_CONFIDENCE = 0.7).
  public nonisolated static func tier(for confidence: Double) -> Tier {
    if confidence >= 0.85 { return .high }
    if confidence >= 0.70 { return .medium }
    return .low
  }

  public nonisolated static func label(for tier: Tier) -> String {
    switch tier {
    case .high: "High — single item"
    case .medium: "Medium — mixed dish"
    case .low: "Low — review needed"
    }
  }

  // ED-Safe keeps the badge — AI accuracy is not food morality.
  private var tier: Tier { Self.tier(for: confidence) }

  public var body: some View {
    HStack(spacing: CCSpace.xs) {
      Circle()
        .fill(dotColor)
        .frame(width: 6, height: 6)
        .accessibilityHidden(true)
      Text(Self.label(for: tier))
        .font(.system(size: compact ? 10 : 12, weight: .medium))
        .foregroundStyle(textColor)
        .lineLimit(1)
    }
    .padding(.vertical, compact ? 4 : 6)
    .padding(.horizontal, compact ? 8 : 10)
    .background(dotColor.opacity(0.15), in: Capsule())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Confidence \(Self.label(for: tier))")
  }

  private var dotColor: Color {
    switch tier {
    case .high: Color.ccSuccess
    case .medium: Color.ccWarning
    case .low: Color.ccError
    }
  }

  private var textColor: Color {
    switch tier {
    case .high: Color.ccSuccessInk
    case .medium: Color.ccWarningInk
    case .low: Color.ccErrorInk
    }
  }
}

public struct CCWarningChip: View {
  public let reason: String
  public let addedKcal: Int?

  @Environment(\.edSafeMode) private var edSafeMode

  public init(reason: String, addedKcal: Int? = nil) {
    self.reason = reason
    self.addedKcal = addedKcal
  }

  // ED-Safe drops the kcal clause; the reason to review stays.
  public nonisolated static func text(reason: String, addedKcal: Int?, edSafeMode: Bool) -> String {
    guard let addedKcal else { return reason }
    return edSafeMode ? "\(reason) — review portion" : "\(reason) — +\(addedKcal) kcal added (editable)"
  }

  public var body: some View {
    HStack(spacing: CCSpace.xs) {
      Image(systemName: "info.circle")
        .font(.system(size: 14))
        .accessibilityHidden(true)
      Text(Self.text(reason: reason, addedKcal: addedKcal, edSafeMode: edSafeMode))
        .font(.system(size: 13, weight: .medium))
        .lineLimit(2)
    }
    .foregroundStyle(Color.ccWarningInk)
    .padding(.vertical, CCSpace.sm)
    .padding(.horizontal, CCSpace.md)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.ccWarning.opacity(0.12))
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Self.text(reason: reason, addedKcal: addedKcal, edSafeMode: edSafeMode)
    )
  }
}

public struct CCToast: View {
  public let title: String
  public let kcalText: String?
  public var undoTitle: String = "Undo"
  public let onUndo: (() -> Void)?
  public let onDismiss: (() -> Void)?

  @Environment(\.edSafeMode) private var edSafeMode

  public init(
    title: String,
    kcalText: String? = nil,
    undoTitle: String = "Undo",
    onUndo: (() -> Void)? = nil,
    onDismiss: (() -> Void)? = nil
  ) {
    self.title = title
    self.kcalText = kcalText
    self.undoTitle = undoTitle
    self.onUndo = onUndo
    self.onDismiss = onDismiss
  }

  // ED-Safe drops the kcal line.
  public nonisolated static func visibleKcalText(_ kcalText: String?, edSafeMode: Bool) -> String? {
    edSafeMode ? nil : kcalText
  }

  public var body: some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: CCRadius.sm)
        .fill(Color.ccSuccess.opacity(0.2))
        .frame(width: 40, height: 40)
        .overlay(
          Image(systemName: "checkmark")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.ccSuccessInk)
        )
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        if let visibleKcal = Self.visibleKcalText(kcalText, edSafeMode: edSafeMode) {
          Text(visibleKcal)
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
        }
      }

      Spacer()

      if let onUndo {
        Button(action: onUndo) {
          Text(undoTitle)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(Color.ccAccentInk)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .shadow(color: .black.opacity(0.4), radius: 32, x: 0, y: 8)
    .task {
      if let onDismiss {
        try? await Task.sleep(nanoseconds: 4_000_000_000)
        onDismiss()
      }
    }
  }
}

public struct CCSheet<Content: View>: View {
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: CCSpace.md) {
      Capsule()
        .fill(Color.white.opacity(0.2))
        .frame(width: 36, height: 4)
        .accessibilityHidden(true)
      content
    }
    .padding(.top, CCSpace.sm)
    .padding(.horizontal, CCSpace.lg)
    .padding(.bottom, CCSpace.xl)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.xl))
  }
}

public struct CCChartCard: View {
  public struct Point: Identifiable, Equatable, Sendable {
    public let date: Date
    public let value: Double
    public let label: String

    public init(date: Date, value: Double, label: String) {
      self.date = date
      self.value = value
      self.label = label
    }

    public var id: Date { date }
  }

  public let points: [Point]
  public var title: String = ""

  public init(points: [Point], title: String = "") {
    self.points = points
    self.title = title
  }

  public var body: some View {
    Chart(points) { point in
      LineMark(
        x: .value("Date", point.date),
        y: .value("Value", point.value)
      )
      .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
      .foregroundStyle(Color.ccAccentLime)

      PointMark(
        x: .value("Date", point.date),
        y: .value("Value", point.value)
      )
      .symbolSize(point.id == points.last?.id ? 16 : 9)
      .foregroundStyle(
        point.id == points.last?.id ? Color.ccAccentLime : Color.white.opacity(0.3)
      )
    }
    .chartXAxis {
      AxisMarks(values: .automatic) { _ in
        AxisGridLine().foregroundStyle(Color.white.opacity(0.05))
        AxisValueLabel()
          .font(.caption)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .chartYAxis {
      AxisMarks(values: .automatic) { _ in
        AxisGridLine().foregroundStyle(Color.white.opacity(0.05))
        AxisValueLabel()
          .font(.caption)
          .foregroundStyle(Color.ccTextSecondary)
      }
    }
    .frame(height: 160)
    .accessibilityChartDescriptor(CCChartDescriptor(points: points))
  }
}

// `.accessibilityChart` is not a SwiftUI API — the chart-a11y contract is this
// descriptor representable (RESEARCH Pitfall 2).
public struct CCChartDescriptor: AXChartDescriptorRepresentable {
  public let points: [CCChartCard.Point]

  public init(points: [CCChartCard.Point]) {
    self.points = points
  }

  public func makeChartDescriptor() -> AXChartDescriptor {
    let values = points.map(\.value)
    let min = values.min() ?? 0
    let max = values.max() ?? 1
    let xAxis = AXCategoricalDataAxisDescriptor(
      title: "Date",
      categoryOrder: points.map(\.label)
    )
    let yAxis = AXNumericDataAxisDescriptor(
      title: "Value",
      range: min...max,
      gridlinePositions: [],
      valueDescriptionProvider: { String($0) }
    )
    // This SDK/toolchain exposes only the NS_REFINED_FOR_SWIFT raw forms of the
    // audiograph chart API (the overlay refinements are not visible to SPM builds).
    let series = AXDataSeriesDescriptor(
      name: "Series",
      isContinuous: true,
      dataPoints: points.map { point in
        AXDataPoint(
          __x: AXDataPointValue(__category: point.label),
          y: AXDataPointValue(__number: point.value)
        )
      }
    )
    return AXChartDescriptor(
      __title: "Trend",
      summary: nil,
      xAxisDescriptor: xAxis,
      yAxisDescriptor: yAxis,
      series: [series]
    )
  }
}

public struct CCOfflineBadge: View {
  public init() {}

  public var body: some View {
    HStack(spacing: CCSpace.xs) {
      Image(systemName: "wifi.slash")
        .font(.system(size: 11))
        .accessibilityHidden(true)
      Text("Offline — syncs later")
        .ccFont(.caption)
    }
    .foregroundStyle(Color.ccTextSecondary)
    .padding(.vertical, CCSpace.xs)
    .padding(.horizontal, CCSpace.md)
    .background(Color.ccSurface, in: Capsule())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Offline — syncs later")
  }
}
