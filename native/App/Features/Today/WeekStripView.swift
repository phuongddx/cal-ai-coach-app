import CoachCalDesignSystem
import SwiftUI

// UI-SPEC Group B: horizontal week strip — 7×40pt day cells (weekday initial
// caption over semibold day number); selected cell lime bg, radius 12, black text.
struct WeekStripView: View {
  let days: [Date]
  let selectedDay: Date
  let onSelect: (Date) -> Void

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: CCSpace.sm) {
        ForEach(days, id: \.self) { day in
          cell(day)
        }
      }
      .padding(.horizontal, CCSpace.xs)
    }
    .accessibilityIdentifier("today.weekStrip")
  }

  private func cell(_ day: Date) -> some View {
    let isSelected = Calendar.current.isDate(day, inSameDayAs: selectedDay)

    return Button {
      onSelect(day)
    } label: {
      VStack(spacing: 2) {
        Text(Self.weekdayInitial(day))
          .ccFont(.caption)
          .foregroundStyle(isSelected ? Color.black.opacity(0.7) : Color.ccTextTertiary)
        Text(Self.dayNumber(day))
          .font(.system(size: 15, weight: .semibold))
          .monospacedDigit()
          .foregroundStyle(isSelected ? Color.black : Color.ccTextSecondary)
      }
      .frame(width: 40, height: 40)
      .background(
        isSelected ? Color.ccAccentLime : Color.clear,
        in: RoundedRectangle(cornerRadius: CCRadius.md)
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("today.dayCell")
    .accessibilityLabel(Text(day.formatted(.dateTime.weekday(.wide).month(.wide).day())))
    .accessibilityAddTraits(isSelected ? [.isSelected] : [])
  }

  private static func weekdayInitial(_ day: Date) -> String {
    String(day.formatted(.dateTime.weekday(.narrow)).prefix(1))
  }

  private static func dayNumber(_ day: Date) -> String {
    day.formatted(.dateTime.day())
  }
}
