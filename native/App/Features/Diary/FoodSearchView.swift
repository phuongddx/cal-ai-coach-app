import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// UI-SPEC Food Search screen: back chevron + search field, "Recent" card before
// a query, "Results for "{query}"" card, verbatim empty state, persistent
// "Create custom food" row. Rows open the manual-log sheet; saving writes the
// diary mirror+outbox path and reports a SavedReceipt to the presenting sheet.
struct FoodSearchView: View {
  let model: FoodSearchModel
  let mealSlot: MealSlot
  let catalog: CatalogRepository
  let userId: UUID
  let diaryEntryRepository: DiaryEntryRepository
  let diaryDetailRepository: DiaryDetailRepository
  let now: @Sendable () -> Date
  let onSaved: (SavedReceipt) -> Void
  let onDismiss: () -> Void

  @State private var manualRow: FoodSearchModel.Row?
  @State private var isCustomSheetPresented = false
  @State private var isSaving = false

  var body: some View {
    @Bindable var model = model

    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack(spacing: CCSpace.xs) {
        Button(action: onDismiss) {
          Image(systemName: "chevron.left")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.ccTextSecondary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back")
        .accessibilityIdentifier("search.back")
        CCSearchField(text: $model.query, placeholder: "Search foods")
          .accessibilityIdentifier("search.field")
      }

      ScrollView {
        VStack(alignment: .leading, spacing: CCSpace.md) {
          content
          createCustomRow
        }
      }
    }
    .padding(.horizontal, CCSpace.lg)
    .padding(.top, CCSpace.sm)
    .background(Color.ccBackground)
    .sheet(item: $manualRow) { row in
      ManualLogSheet(
        row: row,
        mealSlot: mealSlot,
        onSave: { detail in saveManual(detail) },
        onDismiss: { manualRow = nil }
      )
      .presentationDetents([.medium, .large])
    }
    .sheet(isPresented: $isCustomSheetPresented) {
      CustomFoodSheet(
        catalog: catalog,
        userId: userId,
        onCreated: { row in
          Task { await model.applySearch(model.query) }
        },
        onDismiss: { isCustomSheetPresented = false }
      )
      .presentationDetents([.large])
    }
  }

  @ViewBuilder private var content: some View {
    let trimmed = model.query.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty {
      listCard(title: "Recent") {
        ForEach(model.recents) { row in
          foodRow(row, leadingIcon: "clock")
        }
      }
    } else if model.results.isEmpty {
      emptyState(trimmed)
    } else {
      listCard(title: "Results for \u{201C}\(trimmed)\u{201D}") {
        ForEach(model.results) { row in
          foodRow(row, leadingIcon: "fork.knife")
        }
      }
    }
  }

  // Copywriting contract: verbatim empty-results state.
  private func emptyState(_ query: String) -> some View {
    VStack(spacing: CCSpace.sm) {
      Text("No results for \u{201C}\(query)\u{201D}")
        .ccFont(.heading)
        .foregroundStyle(Color.ccTextPrimary)
        .multilineTextAlignment(.center)
      Text("Try a different search or create a custom food.")
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextSecondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(CCSpace.xl)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("search.emptyState")
  }

  private func listCard<Content: View>(
    title: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: CCSpace.xs) {
      Text(title)
        .ccFont(.headline)
        .foregroundStyle(Color.ccTextPrimary)
      VStack(spacing: 0) {
        content()
      }
    }
    .padding(CCSpace.md)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
  }

  private func foodRow(_ row: FoodSearchModel.Row, leadingIcon: String) -> some View {
    Button {
      manualRow = row
    } label: {
      HStack(spacing: CCSpace.md) {
        RoundedRectangle(cornerRadius: 10)
          .fill(Color.ccSurface)
          .frame(width: 40, height: 40)
          .overlay(
            Image(systemName: leadingIcon)
              .font(.system(size: 14))
              .foregroundStyle(Color.ccTextTertiary)
          )
          .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 2) {
          Text(row.name)
            .ccFont(.subhead)
            .foregroundStyle(Color.ccTextPrimary)
            .lineLimit(1)
          Text(footnote(row))
            .ccFont(.footnote)
            .monospacedDigit()
            .foregroundStyle(Color.ccTextSecondary)
            .lineLimit(2)
        }

        Spacer(minLength: CCSpace.sm)

        Image(systemName: "plus")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(Color.ccTextPrimary)
          .frame(width: 32, height: 32)
          .background(Color.ccSurface, in: Circle())
          .overlay(Circle().strokeBorder(Color.ccBorder, lineWidth: 1))
          .accessibilityHidden(true)
      }
      .padding(.vertical, CCSpace.sm)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Add food, \(row.name)")
    .accessibilityIdentifier("search.foodRow")
  }

  private func footnote(_ row: FoodSearchModel.Row) -> String {
    let basis = row.basis == "per_serving" ? "serving" : "100g"
    return "\(row.kcal) kcal · \(Int(row.proteinG.rounded()))g protein · \(basis)"
  }

  // Persistent at the list end whether or not the query has results.
  private var createCustomRow: some View {
    Button {
      isCustomSheetPresented = true
    } label: {
      HStack(spacing: CCSpace.sm) {
        Image(systemName: "plus.circle")
          .font(.system(size: 16))
        Text("Create custom food")
          .font(.system(size: 14, weight: .medium))
        Spacer()
      }
      .foregroundStyle(Color.ccTextSecondary)
      .padding(CCSpace.md)
      .background(Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityIdentifier("search.createCustom")
  }

  private func saveManual(_ detail: DiaryEntryDetail) {
    guard !isSaving else { return }
    isSaving = true
    let stamp = now()
    let entry = DiaryEntry(
      id: detail.entryId,
      userId: userId,
      displayText: detail.title,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: nil,
      serverVersion: 0,
      acceptedOpId: nil,
      serverUpdatedAt: stamp
    )
    Task {
      defer { isSaving = false }
      do {
        _ = try await diaryEntryRepository.recordUpsert(entry, now: stamp)
        try await diaryDetailRepository.upsert(detail)
        manualRow = nil
        onSaved(
          SavedReceipt(
            mealName: ManualLogSheet.mealName(mealSlot),
            kcalText: detail.kcal.map { "\($0) kcal added" },
            entryIds: [detail.entryId]
          )
        )
      } catch {
        // Manual sheet stays up; the user can retry the local write.
      }
    }
  }
}
