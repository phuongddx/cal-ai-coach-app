import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// Receipt handed to the presenting surface so it can show the DS toast and
// offer Undo (tombstone of the just-written entries).
struct SavedReceipt: Equatable {
  let mealName: String
  let kcalText: String?
  let entryIds: [UUID]
}

// Payload rows from a saved meal's items_json. kcal is optional so legacy
// [{name, grams}] payloads still decode — those rows log unresolved (kcal nil)
// instead of borrowing the meal's aggregate figure.
struct SavedMealItem: Decodable {
  let name: String
  let grams: Int?
  let kcal: Int?
}

extension MealSlot: Identifiable {
  var id: String { rawValue }
}

// UI-SPEC Add Food Sheet: exactly five quick-action tiles (Voice is v2) over a
// saved-meals rail with one-tap re-log (LOG-07). Props-driven so snapshot
// tests render it without an AppEnvironment.
struct AddFoodSheet: View {
  // The DS grid is 3-col; Voice tile is out of scope for Phase 3 (INP2-01 v2).
  enum Tile: Int, CaseIterable {
    case photo
    case barcode
    case label
    case describe
    case search
  }

  let mealSlot: MealSlot
  let savedMeals: [SavedMeal]
  let onCapture: (ScanMode) -> Void
  let onSearch: () -> Void
  let onRelog: (SavedMeal) -> Void
  let onDismiss: () -> Void

  private var tiles: [(tile: Tile, title: String, icon: String, mode: ScanMode?)] {
    [
      (.photo, "Photo", "camera", .photo),
      (.barcode, "Barcode", "barcode.viewfinder", .barcode),
      (.label, "Label", "doc.text.viewfinder", .label),
      (.describe, "Describe", "pencil.line", .text),
      (.search, "Search", "magnifyingglass", nil),
    ]
  }

  var body: some View {
    CCSheet {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text("Add food")
            .ccFont(.heading)
            .foregroundStyle(Color.ccTextPrimary)
          Text("to \(ManualLogSheet.mealName(mealSlot))")
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
        }
        Spacer()
        Button(action: onDismiss) {
          Image(systemName: "xmark")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.ccTextSecondary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close")
        .accessibilityIdentifier("addfood.close")
      }

      LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: CCSpace.sm) {
        ForEach(tiles, id: \.tile) { entry in
          if let mode = entry.mode {
            CCQuickActionTile(
              title: entry.title,
              icon: entry.icon,
              isHighlighted: entry.tile == .photo
            ) {
              onCapture(mode)
            }
            .accessibilityIdentifier("addfood.tile.\(entry.tile)")
          } else {
            CCQuickActionTile(title: entry.title, icon: entry.icon) {
              onSearch()
            }
            .accessibilityIdentifier("addfood.tile.search")
          }
        }
      }

      CCSectionHeader("Saved meals")

      if savedMeals.isEmpty {
        // Backstop: the rail never collapses — the empty card always renders.
        Text("Save a meal and re-log it here in one tap.")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, minHeight: 72)
          .padding(CCSpace.md)
          .background(Color.ccCard)
          .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
          .overlay(
            RoundedRectangle(cornerRadius: CCRadius.lg)
              .strokeBorder(Color.ccBorder, style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
          )
          .accessibilityIdentifier("addfood.savedMealsEmpty")
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: CCSpace.sm) {
            ForEach(savedMeals, id: \.id) { meal in
              savedMealCard(meal)
            }
          }
          .padding(.vertical, CCSpace.xs)
        }
      }
    }
  }

  private func savedMealCard(_ meal: SavedMeal) -> some View {
    Button {
      onRelog(meal)
    } label: {
      VStack(alignment: .leading, spacing: CCSpace.xs) {
        RoundedRectangle(cornerRadius: CCRadius.sm)
          .fill(Color.ccSurface)
          .frame(width: 48, height: 48)
          .overlay(
            Image(systemName: meal.symbol ?? "fork.knife")
              .font(.system(size: 17))
              .foregroundStyle(Color.ccTextTertiary)
          )
          .accessibilityHidden(true)
        Text(meal.name)
          .font(.caption.weight(.semibold))
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
        Text("\(meal.kcal) kcal")
          .ccFont(.caption)
          .monospacedDigit()
          .foregroundStyle(Color.ccTextSecondary)
          .edSafeHidden()
      }
      .frame(width: 100, alignment: .leading)
      .padding(CCSpace.sm)
      .background(Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, lineWidth: 1)
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Log saved meal, \(meal.name)")
    .accessibilityIdentifier("addfood.savedMeal")
  }
}

// Environment-backed wrapper: loads saved meals and performs the re-log
// writes (mirror+outbox via DiaryEntryRepository, detail rows per item).
struct AddFoodSheetRoute: View {
  let mealSlot: MealSlot
  let onSaved: (SavedReceipt) -> Void
  let onDismiss: () -> Void

  @Environment(AppEnvironment.self) private var environment
  @State private var savedMeals: [SavedMeal] = []
  @State private var isSearchPresented = false

  var body: some View {
    AddFoodSheet(
      mealSlot: mealSlot,
      savedMeals: savedMeals,
      onCapture: { mode in
        onDismiss()
        environment.openScan(mode, mealSlot: mealSlot)
      },
      onSearch: { isSearchPresented = true },
      onRelog: { meal in
        Task { await relog(meal) }
      },
      onDismiss: onDismiss
    )
    .task {
      savedMeals = (try? await environment.catalogRepository.savedMeals()) ?? []
    }
    .sheet(isPresented: $isSearchPresented) {
      FoodSearchRoute(
        mealSlot: mealSlot,
        onSaved: onSaved,
        onDismiss: { isSearchPresented = false }
      )
      .presentationDetents([.large])
    }
  }

  // One-tap re-log: expand items_json → entry + detail per item, exactly one
  // outbox op per entry; each row persists its own per-item kcal (never the
  // saved meal's aggregate — legacy rows without a figure stay nil).
  private func relog(_ meal: SavedMeal) async {
    let items = (try? JSONDecoder().decode([SavedMealItem].self, from: Data(meal.itemsJson.utf8)))
      ?? [SavedMealItem(name: meal.name, grams: nil, kcal: nil)]
    let userId = AppEnvironment.demoUserId
    let stamp = environment.now()
    var entryIds: [UUID] = []

    for item in items {
      let entry = DiaryEntry(
        id: UUID(),
        userId: userId,
        displayText: item.name,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: nil,
        serverVersion: 0,
        acceptedOpId: nil,
        serverUpdatedAt: stamp
      )
      do {
        _ = try await environment.diaryEntryRepository.recordUpsert(entry, now: stamp)
        try await environment.diaryDetailRepository.upsert(
          DiaryEntryDetail(
            entryId: entry.id,
            mealSlot: mealSlot.rawValue,
            title: item.name,
            grams: item.grams,
            kcal: item.kcal,
            proteinG: nil,
            carbsG: nil,
            fatG: nil,
            fiberG: nil,
            confidence: nil,
            hiddenFatLikely: false,
            source: "relog",
            unresolved: false,
            scanId: nil
          )
        )
        entryIds.append(entry.id)
      } catch {
        // Rail stays interactive; partial re-logs surface in the live diary.
      }
    }

    guard !entryIds.isEmpty else { return }
    onSaved(
      SavedReceipt(
        mealName: ManualLogSheet.mealName(mealSlot),
        kcalText: "\(meal.kcal) kcal added",
        entryIds: entryIds
      )
    )
    onDismiss()
  }
}

// Environment wrapper for the search stack.
struct FoodSearchRoute: View {
  let mealSlot: MealSlot
  let onSaved: (SavedReceipt) -> Void
  let onDismiss: () -> Void

  @Environment(AppEnvironment.self) private var environment
  @State private var model: FoodSearchModel?

  var body: some View {
    if let model {
      FoodSearchView(
        model: model,
        mealSlot: mealSlot,
        catalog: environment.catalogRepository,
        userId: AppEnvironment.demoUserId,
        diaryEntryRepository: environment.diaryEntryRepository,
        diaryDetailRepository: environment.diaryDetailRepository,
        now: environment.now,
        onSaved: onSaved,
        onDismiss: onDismiss
      )
    } else {
      Color.ccBackground.overlay(ProgressView())
        .task {
          model = FoodSearchModel(catalog: environment.catalogRepository)
        }
    }
  }
}
