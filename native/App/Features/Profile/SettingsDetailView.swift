import CoachCalDesignSystem
import SwiftUI

// Group F Settings Detail. The locked copy lives in SettingsCopy so the
// verbatim strings are grep-lockable and unit-testable.
enum SettingsCopy {
  static let edSafeTitle = "ED-Safe Mode"
  static let edSafeDescription =
    "Hides calorie counts, shows weekly averages instead of daily totals. Focus on habits, not numbers."
  static let deleteAccountTitle = "Delete account?"
  static let deleteAccountMessage =
    "This permanently deletes your data on this device and in the cloud."
  static let deleteAccountConfirm = "Delete account"
  static let cancel = "Cancel"
  static let exportNote = "Available soon"
  static let billingNote = "Billing arrives in a later update."
  static let versionCaption = "CoachCal v1.0.0 · Made with 💚"

  // VoiceOver contract: the toggle announces its state, never a raw boolean.
  static func edSafeAnnouncement(isOn: Bool) -> String {
    "\(edSafeTitle), \(isOn ? "on" : "off")"
  }
}

// Props-driven (binding + closure) so hosted tests construct it without the
// environment; ProfileFlow injects the environment's single write path.
struct SettingsDetailView: View {
  let edSafeToggle: Binding<Bool>
  let onDeleteAccount: () -> Void

  @State private var showsExportNote = false
  @State private var showsDeleteConfirmation = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: CCSpace.lg) {
        CCSectionHeader("Wellness")
        edSafeCard
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

  private var dataPrivacyGroup: some View {
    CCSettingsGroup {
      Button {
        showsExportNote = true
      } label: {
        CCSettingsRow(icon: "square.and.arrow.up", label: "Export CSV")
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("settings.row.export")
      if showsExportNote {
        // TRU-03 is Phase 4: an honest stub, no export logic ships here.
        CCBannerNote(SettingsCopy.exportNote)
          .accessibilityIdentifier("settings.exportNote")
      }
      Button {
        showsDeleteConfirmation = true
      } label: {
        CCSettingsRow(icon: "trash", label: SettingsCopy.deleteAccountConfirm)
      }
      .buttonStyle(.plain)
      .accessibilityIdentifier("settings.row.deleteAccount")
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
