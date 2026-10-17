import CoachCalDesignSystem
import CoachCalNetworking
import SwiftUI

// UI-SPEC Group D Review Sheet ★ (the hero screen): confidence-badged,
// grams-editable meal review. Every kcal figure is recomputed via
// KcalArithmetic from the CURRENT grams (T-P05-02); ED-Safe hides the kcal
// framing through edSafeHidden() and the DS components' own policy.
struct ReviewSheetView: View {
  // UI-SPEC DT contract: review kcal scales via @ScaledMetric.
  @ScaledMetric(relativeTo: .title2) private var totalKcalSize = 24
  @Bindable var model: ScanModel
  let onClose: () -> Void

  @State private var correctionItemId: Int?

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: CCSpace.sm) {
        Button {
          model.retake()
        } label: {
          Image(systemName: "chevron.left")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.ccTextPrimary)
            .frame(width: CCSize.tapTarget, height: CCSize.tapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Retake photo")
        .accessibilityIdentifier("scan.retake")
        Text("Review")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("scan.review")
        Spacer()
        Button {
          onClose()
        } label: {
          Image(systemName: "xmark")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.ccTextSecondary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close scanner")
        .accessibilityIdentifier("scan.close")
      }
      .padding(.horizontal, CCSpace.lg)

      ScrollView {
        VStack(alignment: .leading, spacing: CCSpace.lg) {
          header
          if model.hasHiddenFat {
            CCWarningChip(reason: "Dressing not visible", addedKcal: model.hiddenFatAddedKcal)
              .accessibilityIdentifier("scan.warningChip")
          }
          ingredientsSection
        }
        .padding(CCSpace.lg)
      }

      saveBar
    }
    .background(Color.ccBackground.ignoresSafeArea())
    .sheet(item: Binding(
      get: { model.result?.items.first { $0.id == correctionItemId } },
      set: { correctionItemId = $0?.id }
    )) { item in
      CorrectionCaptureView(
        model: model,
        itemId: item.id,
        onDismiss: { correctionItemId = nil }
      )
      .presentationDetents([.medium])
    }
  }

  private var header: some View {
    HStack(spacing: CCSpace.md) {
      thumb
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: CCSpace.xs) {
        TextField("Meal name", text: $model.mealTitle)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
          .lineLimit(1)
          .accessibilityIdentifier("scan.titleField")
        HStack(spacing: CCSpace.sm) {
          if let confidence = model.result?.scanConfidence {
            CCConfidenceBadge(confidence: confidence)
              .accessibilityIdentifier("scan.badge")
          }
          Text("AI estimate")
            .ccFont(.caption)
            .fontWeight(.medium)
            .foregroundStyle(Color.ccTextSecondary)
        }
      }
      Spacer()
      VStack(alignment: .trailing, spacing: 2) {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text("\(model.mealKcal)")
            .font(.system(size: totalKcalSize, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Color.ccAccentInk)
            .accessibilityIdentifier("scan.totalKcal")
          Text("kcal")
            .ccFont(.footnote)
            .foregroundStyle(Color.ccTextSecondary)
        }
        .lineLimit(1)
        .edSafeHidden()
      }
    }
  }

  private var thumb: some View {
    RoundedRectangle(cornerRadius: CCRadius.md)
      .fill(Color.ccAccentLime.opacity(0.15))
      .frame(width: 72, height: 72)
      .overlay {
        if let image = model.captureThumb {
          Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
        } else {
          Image(systemName: "camera")
            .font(.system(size: 22))
            .foregroundStyle(Color.ccAccentInk)
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.md))
  }

  private var ingredientsSection: some View {
    VStack(alignment: .leading, spacing: CCSpace.sm) {
      CCSectionHeader("Ingredients")
      if let items = model.result?.items {
        CCCard {
          VStack(spacing: 0) {
            ForEach(items) { item in
              itemRow(item)
                .padding(.vertical, CCSpace.md)
              if item.id != items.last?.id {
                Divider()
              }
            }
          }
        }
      }
    }
  }

  private func itemRow(_ item: ScanModel.ResultItem) -> some View {
    let lowConfidence = item.source.confidence < 0.5
    return VStack(alignment: .leading, spacing: CCSpace.xs) {
      HStack(spacing: CCSpace.sm) {
        Text(item.source.label)
          .ccFont(.headline)
          .foregroundStyle(item.isUnresolved ? Color.ccErrorInk : Color.ccTextPrimary)
          .lineLimit(1)
        if lowConfidence {
          CCConfidenceBadge(confidence: item.source.confidence, compact: true)
        }
        Spacer()
        if item.isUnresolved {
          Text("Review needed")
            .ccFont(.caption)
            .fontWeight(.medium)
            .foregroundStyle(Color.ccErrorInk)
            .accessibilityIdentifier("scan.reviewNeeded.\(item.id)")
        } else if item.correction != nil {
          Text("Fix noted")
            .ccFont(.caption)
            .fontWeight(.medium)
            .foregroundStyle(Color.ccInfoInk)
        }
      }
      HStack {
        Text("\(model.itemKcal(at: item.id)) kcal")
          .ccFont(.footnote)
          .foregroundStyle(Color.ccTextSecondary)
          .monospacedDigit()
          .lineLimit(2)
          .edSafeHidden()
          .accessibilityIdentifier("scan.itemKcal.\(item.id)")
        Spacer()
        CCStepper(name: item.source.label, value: model.itemGramsBinding(for: item.id))
          .accessibilityIdentifier("scan.grams.\(item.id)")
      }
      Button {
        correctionItemId = item.id
      } label: {
        Text("Fix Issue")
          .ccFont(.footnote)
          .fontWeight(.medium)
          .foregroundStyle(Color.ccWarningInk)
          .padding(.vertical, 6)
          .padding(.horizontal, CCSpace.md)
          .overlay(
            Capsule().strokeBorder(Color.ccWarning, lineWidth: 1)
          )
          .contentShape(Capsule())
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("scan.fixIssue.\(item.id)")
    }
  }

  private var saveBar: some View {
    VStack(spacing: CCSpace.sm) {
      Picker("Meal", selection: $model.mealSlot) {
        ForEach(MealSlot.allCases, id: \.self) { slot in
          Text(ManualLogSheet.mealName(slot)).tag(slot)
        }
      }
      .pickerStyle(.menu)
      .accessibilityIdentifier("scan.mealPicker")
      CCPrimaryButton("Save to \(ManualLogSheet.mealName(model.mealSlot))") {
        Task { await model.save() }
      }
      .disabled(!model.isSaveEnabled)
      .accessibilityIdentifier("scan.save")
    }
    .padding(CCSpace.lg)
    .background(Color.ccBackground)
  }
}

// Quota reached (402 fixture): intercepts before any analyzing UI. The
// surface is presentational only (T-P05-01) — "See plans" shows a neutral
// placeholder (Phase 5 rebuilds with TRU-01-locked copy) and "Log manually"
// always works.
struct QuotaReachedView: View {
  let model: ScanModel
  let onLoggedElsewhere: () -> Void

  @State private var isPlansPresented = false
  @State private var isManualLogPresented = false

  private var entitlement: EntitlementState? {
    if case .quotaReached(let entitlement) = model.phase { return entitlement }
    return nil
  }

  private var resetText: String {
    guard let entitlement else { return "" }
    let date = entitlement.windowResetAt.formatted(date: .abbreviated, time: .omitted)
    return "Your scans reset \(date). You can still log everything manually."
  }

  var body: some View {
    VStack(spacing: 0) {
      Spacer()
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        RoundedRectangle(cornerRadius: CCRadius.md)
          .fill(Color.ccAccentLime.opacity(0.15))
          .frame(width: 40, height: 40)
          .overlay(
            Image(systemName: "info")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(Color.ccAccentInk)
          )
          .accessibilityHidden(true)
        Text("You've used all 3 free scans this week")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("scan.quotaTitle")
        Text(resetText)
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
          .accessibilityIdentifier("scan.quotaBody")
        CCPrimaryButton("See plans") {
          isPlansPresented = true
        }
        .accessibilityIdentifier("scan.seePlans")
        CCSecondaryButton("Log manually", bordered: true) {
          isManualLogPresented = true
        }
        .accessibilityIdentifier("scan.logManually")
      }
      .padding(CCSpace.xl)
      .background(Color.ccCard)
      .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
      .padding(CCSpace.lg)
      Spacer()
    }
    .frame(maxWidth: .infinity)
    .background(Color.ccBackground.ignoresSafeArea())
    .sheet(isPresented: $isPlansPresented) {
      NeutralPlansSheet(onLogManually: {
        isPlansPresented = false
        isManualLogPresented = true
      })
      .presentationDetents([.medium])
    }
    .sheet(isPresented: $isManualLogPresented) {
      AddFoodSheetRoute(
        mealSlot: model.mealSlot,
        onSaved: { _ in
          isManualLogPresented = false
          onLoggedElsewhere()
        },
        onDismiss: { isManualLogPresented = false }
      )
      .presentationDetents([.large])
    }
  }
}

// Neutral paywall placeholder (record-don't-build: TRU-01 copy is
// Phase 5-locked; this stays copy-neutral and keeps the manual escape).
struct NeutralPlansSheet: View {
  let onLogManually: () -> Void
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    CCSheet {
      VStack(alignment: .leading, spacing: CCSpace.md) {
        Text("Plans")
          .ccFont(.heading)
          .foregroundStyle(Color.ccTextPrimary)
          .accessibilityIdentifier("scan.plansTitle")
        Text("CoachCal plan options will be available at launch. Logging meals manually stays free and unlimited.")
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextSecondary)
        CCSecondaryButton("Log manually", bordered: true, action: onLogManually)
          .accessibilityIdentifier("scan.plansLogManually")
        Spacer()
      }
    }
  }
}
