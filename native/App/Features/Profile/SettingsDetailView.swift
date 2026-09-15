import CoachCalDesignSystem
import CoachCalPersistence
import SwiftUI

// Group F Settings Detail. The locked copy lives in SettingsCopy so the
// verbatim strings are grep-lockable and unit-testable.
enum SettingsCopy {
  static let edSafeTitle = "ED-Safe Mode"
  static let edSafeDescription =
    "Hides calorie counts, shows weekly averages instead of daily totals. Focus on habits, not numbers."
  static let deleteAccountTitle = "Delete account?"
  static let deleteAccountMessage =
    "This permanently deletes your data on this device. Cloud deletion arrives with sync in a later update."
  static let deleteAccountConfirm = "Delete account"
  static let cancel = "Cancel"
  static let billingNote = "Billing arrives in a later update."
  static let versionCaption = "CoachCal v1.0.0 · Made with 💚"
  static let burnAddBackTitle = "Add exercise calories back"
  static let burnAddBackDescription = "Adds Apple Health workouts to today's calorie budget."

  // VoiceOver contract: the toggle announces its state, never a raw boolean.
  static func edSafeAnnouncement(isOn: Bool) -> String {
    "\(edSafeTitle), \(isOn ? "on" : "off")"
  }
}

// Props-driven (binding + closure) so hosted tests construct it without the
// environment; ProfileFlow injects the environment's single write path.
struct SettingsDetailView: View {
  let edSafeToggle: Binding<Bool>
  let burnAddBackToggle: Binding<Bool>
  let onDeleteAccount: () -> Void
  let csvExportAction: () async throws -> Data
  // E2ESyncConvergenceTests-only seam (T-P47-01): the closure body itself is
  // a Release no-op (ProfileFlow gates the body #if DEBUG since the method
  // it calls doesn't exist in Release), and the button that invokes it below
  // is #if DEBUG-gated too — so this can never fire outside DEBUG despite
  // the property itself always being present (keeping it ungated here is
  // what lets the memberwise init stay a single, unconditional call site).
  let onToggleDebugOffline: () -> Void

  @State private var exportedCSV: Data?
  @State private var showsDeleteConfirmation = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        CCSectionHeader("Wellness")
        edSafeCard
        CCSectionHeader("Health")
        healthCard
        CCSectionHeader("Data & privacy")
        dataPrivacyGroup
        subscriptionCard
        CCSectionHeader("Support")
        CCSettingsGroup {
          Button {} label: {
            CCSettingsRow(icon: "questionmark.circle", label: "Help & FAQ")
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("settings.row.help")
          Button {} label: {
            CCSettingsRow(icon: "envelope", label: "Contact us")
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("settings.row.contact")
        }
        Text(SettingsCopy.versionCaption)
          .ccFont(.caption)
          .foregroundStyle(Color.ccTextTertiary)
          .frame(maxWidth: .infinity, alignment: .center)
          .padding(.top, CCSpace.sm)
          .accessibilityIdentifier("settings.version")
      }
      .padding(.horizontal, CCSpace.lg)
      .padding(.top, CCSpace.sm)
      .padding(.bottom, CCSpace.xl5)
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(Color.ccBackground)
    .navigationTitle("Settings")
    .navigationBarTitleDisplayMode(.inline)
    .confirmationDialog(
      SettingsCopy.deleteAccountTitle,
      isPresented: $showsDeleteConfirmation,
      titleVisibility: .visible
    ) {
      Button(SettingsCopy.deleteAccountConfirm, role: .destructive) {
        onDeleteAccount()
      }
      .accessibilityIdentifier("settings.deleteConfirm")
      Button(SettingsCopy.cancel, role: .cancel) {}
    } message: {
      Text(SettingsCopy.deleteAccountMessage)
    }
  }

  // DS Wellness card: fat @8% bg, fat @20% border, 40pt heart tile, native
  // Toggle tinted macroFat, verbatim description.
  private var edSafeCard: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack(spacing: CCSpace.md) {
        Image(systemName: "heart.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color.ccMacroFat)
          .frame(width: 40, height: 40)
          .background(
            Color.ccMacroFat.opacity(0.15),
            in: RoundedRectangle(cornerRadius: CCRadius.sm)
          )
          .accessibilityHidden(true)
        Text(SettingsCopy.edSafeTitle)
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Toggle("", isOn: edSafeToggle)
          .labelsHidden()
          .tint(Color.ccMacroFat)
          .accessibilityIdentifier("settings.edSafeToggle")
          .accessibilityLabel(SettingsCopy.edSafeAnnouncement(isOn: edSafeToggle.wrappedValue))
      }
      Text(SettingsCopy.edSafeDescription)
        .ccFont(.footnote)
        .foregroundStyle(Color.ccTextSecondary)
    }
    .padding(CCSpace.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      Color.ccMacroFat.opacity(0.08),
      in: RoundedRectangle(cornerRadius: CCRadius.lg)
    )
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccMacroFat.opacity(0.2), lineWidth: 1)
    )
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("settings.wellnessCard")
  }

  // TRK-03 burn add-back toggle: defaults off (HealthKitSettingsKey.burnAddBackEnabled);
  // reuses CCSettingsRow's icon/label rhythm with a trailing Toggle in place of the chevron.
  private var healthCard: some View {
    CCSettingsGroup {
      HStack(spacing: CCSpace.md) {
        Image(systemName: "flame")
          .font(.system(size: 20))
          .foregroundStyle(Color.ccTextSecondary)
          .frame(width: 24)
          .accessibilityHidden(true)
        Text(SettingsCopy.burnAddBackTitle)
          .ccFont(.subhead)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Toggle("", isOn: burnAddBackToggle)
          .labelsHidden()
          .accessibilityIdentifier("settings.burnAddBackToggle")
      }
      .padding(.vertical, 14)
      .padding(.horizontal, CCSpace.lg)
    }
    .accessibilityElement(children: .contain)
  }

  private var dataPrivacyGroup: some View {
    CCSettingsGroup {
      ShareLink(
        item: CSVDocument(data: exportedCSV ?? Data()),
        preview: SharePreview("CoachCal Data.csv")
      ) {
        CCSettingsRow(icon: "square.and.arrow.up", label: "Export CSV")
      }
      .buttonStyle(.plain)
      .disabled(exportedCSV == nil)
      .accessibilityIdentifier("settings.row.export")
      Button {
        showsDeleteConfirmation = true
      } label: {
        CCSettingsRow(icon: "trash", label: SettingsCopy.deleteAccountConfirm)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("settings.row.deleteAccount")
      #if DEBUG
      Button(action: onToggleDebugOffline) {
        CCSettingsRow(icon: "wifi.slash", label: "Toggle offline (debug)")
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("debug.toggleOffline")
      #endif
    }
    // Loads in the background as soon as Settings appears — by the time the
    // user scrolls to and taps Export CSV the ShareLink is almost always
    // already backed by real data; the row stays disabled until it is.
    .task {
      guard exportedCSV == nil else { return }
      exportedCSV = try? await csvExportAction()
    }
  }

  // Display-only (T-P07-05): no purchase code exists in Phase 3; the buttons
  // are present but inert with the Phase-5 footnote.
  private var subscriptionCard: some View {
    VStack(alignment: .leading, spacing: CCSpace.md) {
      HStack(spacing: CCSpace.sm) {
        Text("Subscription")
          .ccFont(.headline)
          .foregroundStyle(Color.ccTextPrimary)
        Spacer()
        Text("Active")
          .ccFont(.caption)
          .foregroundStyle(Color.ccTextPrimary)
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(Color.ccAccentLime.opacity(0.15), in: Capsule())
      }
      Text("Free")
        .ccFont(.subhead)
        .foregroundStyle(Color.ccTextPrimary)
        .accessibilityIdentifier("settings.planValue")
      HStack(spacing: CCSpace.sm) {
        CCSecondaryButton("Change plan")
          .accessibilityIdentifier("settings.changePlan")
        CCSecondaryButton("Cancel subscription", bordered: true)
          .accessibilityIdentifier("settings.cancelSubscription")
      }
      CCBannerNote(SettingsCopy.billingNote)
        .accessibilityIdentifier("settings.billingNote")
    }
    .padding(CCSpace.lg)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.ccCard)
    .clipShape(RoundedRectangle(cornerRadius: CCRadius.lg))
    .overlay(
      RoundedRectangle(cornerRadius: CCRadius.lg)
        .strokeBorder(Color.ccBorder, lineWidth: 1)
    )
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("settings.subscriptionCard")
  }
}
