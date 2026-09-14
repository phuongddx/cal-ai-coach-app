import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// LOG-08 custom food creation: per-100g or per-serving basis, kcal clamped
// 0–2000, gram fields clamped 0–500 (T-P04-01). Saved through
// CatalogRepository; FoodSearchModel includes custom rows in later searches.
struct CustomFoodSheet: View {
  let catalog: CatalogRepository
  let userId: UUID
  let onCreated: (FoodSearchModel.Row) -> Void
  let onDismiss: () -> Void

  enum Basis: String, CaseIterable {
    // Values must match the custom_foods basis CHECK constraint.
    case per100g = "per100g"
    case perServing = "per_serving"

    var label: String {
      self == .per100g ? "Per 100 g" : "Per serving"
    }
  }

  @State private var name = ""
  @State private var basis: Basis = .per100g
  @State private var kcalText = ""
  @State private var proteinText = ""
  @State private var carbsText = ""
  @State private var fatText = ""
  @State private var fiberText = ""
  @State private var servingGramsText = ""
  @State private var isSaving = false

  var body: some View {
    CCSheet {
      sheetContent
    }
  }

  private var sheetContent: some View {
    VStack(spacing: CCSpace.md) {
      HStack {
        Text("Create custom food")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
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
        .accessibilityIdentifier("custom.close")
      }

      field("Name", text: $name, identifier: "custom.nameField")
        .keyboardType(.alphabet)

      HStack(spacing: CCSpace.sm) {
        ForEach(Basis.allCases, id: \.rawValue) { option in
          CCChipOption(title: option.label, isSelected: basis == option)
            .onTapGesture { basis = option }
            .accessibilityIdentifier("custom.basis.\(option.rawValue)")
            .accessibilityAddTraits(basis == option ? [.isSelected] : [])
        }
        Spacer()
      }

      // Default keyboard (return key dismisses) so the Save button stays
      // reachable; the kcal value is clamped at the model boundary anyway.
      field("kcal", text: $kcalText, identifier: "custom.kcalField")
      field("Protein g", text: $proteinText, identifier: "custom.proteinField")
        .keyboardType(.numberPad)
      field("Carbs g", text: $carbsText, identifier: "custom.carbsField")
        .keyboardType(.numberPad)
      field("Fat g", text: $fatText, identifier: "custom.fatField")
        .keyboardType(.numberPad)
      field("Fiber g", text: $fiberText, identifier: "custom.fiberField")
        .keyboardType(.numberPad)
      if basis == .perServing {
        field("Serving grams", text: $servingGramsText, identifier: "custom.servingGramsField")
          .keyboardType(.numberPad)
      }

      CCPrimaryButton("Save", action: save)
        .disabled(!canSave || isSaving)
        .accessibilityIdentifier("custom.save")
    }
  }

  private var canSave: Bool {
    !name.trimmingCharacters(in: .whitespaces).isEmpty && Int(kcalText) != nil
  }

  private func field(_ title: String, text: Binding<String>, identifier: String) -> some View {
    TextField(title, text: text)
      .ccFont(.body)
      .foregroundStyle(Color.ccTextPrimary)
      .padding(.vertical, CCSpace.sm)
      .padding(.horizontal, CCSpace.lg)
      .background(Color.ccSurface)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
      .overlay(
        RoundedRectangle(cornerRadius: CCRadius.md)
          .strokeBorder(Color.ccBorder, lineWidth: 1)
      )
      .accessibilityIdentifier(identifier)
  }

  private func clampedInt(_ text: String, range: ClosedRange<Int>) -> Int? {
    guard let parsed = Int(text) else { return nil }
    return min(max(parsed, range.lowerBound), range.upperBound)
  }

  private func save() {
    guard let kcal = clampedInt(kcalText, range: 0...2000) else { return }
    isSaving = true
    let custom = CustomFood(
      id: UUID(),
      userId: userId,
      name: name.trimmingCharacters(in: .whitespaces),
      basis: basis.rawValue,
      kcal: kcal,
      proteinG: Double(clampedInt(proteinText, range: 0...500) ?? 0),
      carbsG: Double(clampedInt(carbsText, range: 0...500) ?? 0),
      fatG: Double(clampedInt(fatText, range: 0...500) ?? 0),
      fiberG: Double(clampedInt(fiberText, range: 0...500) ?? 0),
      servingGrams: clampedInt(servingGramsText, range: 0...5000),
      createdAt: Date()
    )
    Task {
      defer { isSaving = false }
      do {
        try await catalog.saveCustomFood(custom)
        onCreated(FoodSearchModel.Row(custom: custom))
        onDismiss()
      } catch {
        // Sheet stays up; the user can retry the local write.
      }
    }
  }
}
