import CoachCalDesignSystem
import SwiftUI

// Scan flow TEXT mode (03-04's Describe tile routes here via
// openScan(.text, mealSlot)): free-text description → api.analyzeFood(kind:
// .text) → the same review sheet. No Diary file is touched from here.
struct DescribeMealSheet: View {
  @Bindable var model: ScanModel
  let onLoggedElsewhere: () -> Void

  @State private var isSearchPresented = false
  @FocusState private var isFieldFocused: Bool

  var body: some View {
    // Scrollable + keyboard-dismissable: with the multiline field keeping the
    // keyboard up, keyboard avoidance pinned the submit under the keyboard
    // window and pushed the search escape off-screen with no way back.
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        HStack {
          Text("Describe your meal")
            .ccFont(.heading)
            .foregroundStyle(Color.ccTextPrimary)
            .accessibilityIdentifier("scan.describeTitle")
          Spacer()
          Button {
            isSearchPresented = true
          } label: {
            Image(systemName: "magnifyingglass")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(Color.ccTextSecondary)
              .frame(width: 44, height: 44)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Search the food database")
          .accessibilityIdentifier("scan.describe.search")
        }

        TextField(
          "What did you eat? Describe the dish, portions, and anything hidden in it.",
          text: $model.describeText,
          axis: .vertical
        )
        .ccFont(.body)
        .lineLimit(5...8)
        .padding(CCSpace.lg)
        .background(Color.ccCard)
        .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
        .focused($isFieldFocused)
        .accessibilityIdentifier("scan.describeField")

        Picker("Meal", selection: $model.mealSlot) {
          ForEach(MealSlot.allCases, id: \.self) { slot in
            Text(ManualLogSheet.mealName(slot)).tag(slot)
          }
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("scan.describe.mealPicker")

        CCPrimaryButton("Analyze description") {
          let description = model.describeText.trimmingCharacters(in: .whitespacesAndNewlines)
          guard !description.isEmpty else { return }
          isFieldFocused = false
          model.analyze(description: description)
        }
        .disabled(model.describeText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        .accessibilityIdentifier("scan.describeSubmit")
      }
      .padding(CCSpace.lg)
    }
    .scrollDismissesKeyboard(.interactively)
    .toolbar {
      ToolbarItemGroup(placement: .keyboard) {
        Spacer()
        Button("Done") {
          isFieldFocused = false
        }
        .accessibilityIdentifier("scan.describe.done")
      }
    }
    .background(Color.ccBackground.ignoresSafeArea())
    .overlay(alignment: .center) {
      // Text-mode failures render the same inline error card contract —
      // never a system alert.
      if case .failed(let failure) = model.phase {
        VStack(spacing: CCSpace.md) {
          ScanErrorCard(
            failure: failure,
            onRetry: { model.retry() },
            onSearchManually: { isSearchPresented = true }
          )
          .accessibilityIdentifier("scan.errorCard")
          Button("Back to description") {
            model.retry()
          }
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
          .accessibilityIdentifier("scan.describe.back")
        }
      }
    }
    .sheet(isPresented: $isSearchPresented) {
      FoodSearchRoute(
        mealSlot: model.mealSlot,
        onSaved: { _ in
          isSearchPresented = false
          onLoggedElsewhere()
        },
        onDismiss: { isSearchPresented = false }
      )
      .presentationDetents([.large])
    }
  }
}
