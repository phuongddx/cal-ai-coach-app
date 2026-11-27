/**
 * SettingsCopy (SettingsDetailView.swift) — the locked copy of the settings
 * screen. Every string is verbatim from the Swift source; the Jest twins assert
 * them by exact text. Member names avoid the design system's policy API names
 * on purpose (invariant I7 — the same convention as onboardingCopy).
 */
export const settingsCopy = {
  wellnessTitle: 'ED-Safe Mode',
  wellnessDescription:
    'Hides calorie counts, shows weekly averages instead of daily totals. Focus on habits, not numbers.',
  deleteAccountTitle: 'Delete account?',
  deleteAccountMessage:
    "This permanently deletes your data on this device, then deletes your diary, scans, and entitlements on the server and closes your account. This can't be undone.",
  deleteAccountConfirm: 'Delete account',
  cancel: 'Cancel',
  billingNote: 'Billing arrives in a later update.',
  versionCaption: 'CoachCal v1.0.0 · Made with 💚',
  burnAddBackTitle: 'Add exercise calories back',
  burnAddBackDescription: "Adds Apple Health workouts to today's calorie budget.",
  burnAddBackNote: "Adding these to today's budget arrives in a later update.",
} as const;

/** VoiceOver contract: the toggle announces its state, never a raw boolean (SettingsCopy's announcement helper). */
export function wellnessAnnouncement(isOn: boolean): string {
  return `${settingsCopy.wellnessTitle}, ${isOn ? 'on' : 'off'}`;
}
