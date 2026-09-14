import CoachCalDesignSystem
import SwiftUI

struct DiaryDayView: View {
  let model: DiaryDayModel
  // Task 3 attaches the Add Food sheet here; the buttons stay live through the seam.
  var onAddFood: (String) -> Void = { _ in }

  @State private var pendingDelete: DiaryDayModel.FoodItem?
  @State private var isExerciseSheetPresented = false

  var body: some View {
    List {
      Section {
        datePager
          .listRowSeparator(.hidden)
      }
      Section {
        summaryCard
          .listRowSeparator(.hidden)
      }
      ForEach(model.snapshot.sections) { section in
        Section {
          ForEach(section.items) { item in
            foodRow(item)
          }
          dashedAddButton(section.slot)
            .listRowSeparator(.hidden)
        } header: {
          sectionHeader(section)
        }
      }
      Section {
        ForEach(model.snapshot.exercises) { exercise in
          exerciseRow(exercise)
            .listRowSeparator(.hidden)
        }
        addExerciseButton
          .listRowSeparator(.hidden)
      } header: {
        Text("Exercise")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityAddTraits(.isHeader)
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Color.ccBackground)
    .listRowBackground(Color.clear)
    .confirmationDialog(
      "Delete \(pendingDelete?.title ?? "")?",
      isPresented: Binding(
        get: { pendingDelete != nil },
        set: { if !$0 { pendingDelete = nil } }
      ),
      titleVisibility: .visible,
      presenting: pendingDelete
    ) { item in
      Button("Delete", role: .destructive) {
        pendingDelete = nil
        Task { try? await model.delete(item) }
      }
      Button("Cancel", role: .cancel) {
        pendingDelete = nil
      }
    } message: { item in
      Text("This will remove it from \(Self.mealName(item.mealSlot)). This can't be undone.")
    }
    .sheet(isPresented: $isExerciseSheetPresented) {
      ExerciseLogSheet(
        model: model,
        onDismiss: { isExerciseSheetPresented = false }
      )
      .presentationDetents([.medium, .large])
    }
  }

  private var datePager: some View {
    HStack {
      pagerButton("chevron.left", label: "Previous day", identifier: "diary.previousDay") {
        model.selectDay(Calendar.current.date(byAdding: .day, value: -1, to: model.day)!)
      }
      Spacer()
      Text(model.dayHeading)
        .ccFont(.heading)
        .foregroundStyle(Color.ccTextPrimary)
      Spacer()
      pagerButton("chevron.right", label: "Next day", identifier: "diary.nextDay") {
        model.selectDay(Calendar.current.date(byAdding: .day, value: 1, to: model.day)!)
      }
      .disabled(model.isToday)
    }
  }

  private func pagerButton(
    _ symbol: String,
    label: String,
    identifier: String,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Image(systemName: symbol)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(Color.ccTextSecondary)
        .frame(width: 44, height: 44)
        .background(Color.ccCard, in: Circle())
        .overlay(Circle().strokeBorder(Color.ccBorder, lineWidth: 1))
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
    .accessibilityIdentifier(identifier)
  }

  // UI-SPEC Group C: 3 columns Eaten (accent-ink) / Goal / Left (success-ink),
  // hairline dividers; hidden entirely under ED-Safe.
  private var summaryCard: some View {
    HStack(spacing: 0) {
      summaryColumn("Eaten", kcal: model.eatenKcal, color: Color.ccAccentInk)
      Rectangle().fill(Color.ccBorder).frame(width: 0.5, height: 36)
      summaryColumn("Goal", kcal: model.goalKcal ?? 0, color: Color.ccTextPrimary)
      Rectangle().fill(Color.ccBorder).frame(width: 0.5, height: 36)
      summaryColumn("Left", kcal: model.leftKcal ?? 0, color: Color.ccSuccessInk)
    }
    .padding(CCSpace.lg)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "Eaten \(model.eatenKcal) of \(model.goalKcal ?? 0), \(model.leftKcal ?? 0) remaining"
    )
    .edSafeHidden()
  }

  private func summaryColumn(_ title: String, kcal: Int, color: Color) -> some View {
    VStack(spacing: 2) {
      Text(title)
        .ccFont(.caption)
        .foregroundStyle(Color.ccTextSecondary)
      Text(kcal.formatted(.number.locale(Locale(identifier: "en_US"))))
        .font(.system(size: 20, weight: .semibold))
        .monospacedDigit()
        .foregroundStyle(color)
    }
    .frame(maxWidth: .infinity)
  }

  private func sectionHeader(_ section: DiaryDayModel.MealSection) -> some View {
    HStack {
      Text("\(Self.slotEmoji(section.slot)) \(Self.mealName(section.slot))")
        .ccFont(.headline)
        .foregroundStyle(Color.ccTextPrimary)
        .accessibilityAddTraits(.isHeader)
      Spacer()
      Text("\(model.sectionKcal(section)) kcal")
        .ccFont(.subhead)
        .monospacedDigit()
        .foregroundStyle(Color.ccTextSecondary)
        .edSafeHidden()
    }
    .textCase(nil)
  }

  private func foodRow(_ item: DiaryDayModel.FoodItem) -> some View {
    CCFoodRow(
      title: item.title,
      meta: "\(Self.mealName(item.mealSlot)) · \(item.loggedAt.formatted(date: .omitted, time: .shortened))",
      kcal: item.kcal,
      compactBadge: item.confidence.map { CCConfidenceBadge(confidence: $0, compact: true) },
      syncPending: !item.isSynced
    )
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("diary.foodRow")
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button(role: .destructive) {
        pendingDelete = item
      } label: {
        Label("Delete", systemImage: "trash")
      }
    }
  }

  private func dashedAddButton(_ slot: String) -> some View {
    CCDashedAddButton(slot == DiaryDayModel.slotOrder.last ? "Add snack" : "Add food") {
      onAddFood(slot)
    }
    .accessibilityIdentifier("diary.addFood.\(slot)")
  }

  private func exerciseRow(_ exercise: DiaryDayModel.ExerciseRow) -> some View {
    HStack(spacing: CCSpace.md) {
      RoundedRectangle(cornerRadius: 10)
        .fill(Color.ccSurface)
        .frame(width: 40, height: 40)
        .overlay(
          Image(systemName: "figure.run")
            .font(.system(size: 15))
            .foregroundStyle(Color.ccTextTertiary)
        )
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(exercise.type.capitalized)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
        Text("\(exercise.durationMin) min")
          .ccFont(.footnote)
          .monospacedDigit()
          .foregroundStyle(Color.ccTextSecondary)
      }
      Spacer(minLength: CCSpace.sm)
      if let burned = exercise.kcalBurned {
        Text("\(burned) kcal")
          .font(.system(size: 14, weight: .medium))
          .monospacedDigit()
          .foregroundStyle(Color.ccTextPrimary)
          .edSafeHidden()
      }
    }
    .padding(.vertical, CCSpace.sm)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("diary.exerciseRow")
  }

  private var addExerciseButton: some View {
    Button {
      isExerciseSheetPresented = true
    } label: {
      HStack(spacing: CCSpace.xs) {
        Image(systemName: "figure.run")
        Text("Add exercise")
      }
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(Color.ccTextSecondary)
      .frame(maxWidth: .infinity)
      .padding(.vertical, CCSpace.md)
      .padding(.horizontal, CCSpace.lg)
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("diary.addExercise")
  }

  static func mealName(_ slot: String) -> String {
    slot.prefix(1).uppercased() + slot.dropFirst()
  }

  private static func slotEmoji(_ slot: String) -> String {
    switch slot {
    case "breakfast": "☀️"
    case "lunch": "🌤️"
    case "dinner": "🌙"
    default: "🍎"
    }
  }
}
