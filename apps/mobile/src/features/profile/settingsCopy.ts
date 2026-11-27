/**
 * SettingsCopy (SettingsDetailView.swift) — the locked copy of the settings
 * screen. Every string is verbatim from the Swift source; the Jest twins assert
 * them by exact text. Member names avoid the design system's policy API names
 * on purpose (invariant I7 — the same convention as onboardingCopy).
 *
 * U-77: the billing note now states why the plan buttons are inert (no store in
 * this build, frame "Settings"), and the export rows follow the round-3 frames
 * (`x-write-*`, `x-nodata-*`, `x-cancel-*`): the write failure names the reason,
 * the empty diary says so, and a cancelled share is not an error — the file
 * stays, with "Share again" and "Done".
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
  /** The card holds no store: the buttons are inert and the note says why. */
  billingNote: 'Plans are not available in this build.',
  versionCaption: 'CoachCal v1.0.0 · Made with 💚',
  burnAddBackTitle: 'Add exercise calories back',
  burnAddBackDescription: "Adds Apple Health workouts to today's calorie budget.",
  burnAddBackNote: "Adding these to today's budget arrives in a later update.",
  /** Export states (round-3 frames x-write / x-nodata / x-cancel). */
  exportRowTitle: 'Export diary as CSV',
  exportFailedTitle: "Couldn't create the file",
  exportCancelledTitle: 'Not shared',
  exportCancelledBody:
    'Your file is still ready. Share it again, or choose "Save to Files" in the share sheet.',
  exportEmptyTitle: 'Nothing logged yet',
  exportEmptyBody: 'There is nothing to export yet. Log a meal, then try again.',
  exportRetry: 'Try again',
  exportShareAgain: 'Share again',
  exportDone: 'Done',
  supportRowTitle: 'Help and FAQ',
  /** Target edit sheet (frames p-target-*): title and the honest save footnote. */
  targetSheetTitle: 'Edit goal',
  targetSaveFootnote: "Past days in your diary don't change.",
} as const;

/**
 * The goal-weight guardrail of the frame (p-target-floor), honest to the
 * engine: `TargetsEngine` clamps to one flat minimum and computes no
 * height-based healthy range, so the copy names the engine's clamped value
 * without claiming a height-based range and never says "BMI". Caution tint,
 * not error.
 */
export function goalFloorCopy(requestedKg: number, clampedKg: number): string {
  return (
    `**${requestedKg} kg is under the lowest goal CoachCal supports.** ` +
    `We'll plan for ${clampedKg} kg. A doctor or dietitian can help with a different goal.`
  );
}

/** VoiceOver contract: the toggle announces its state, never a raw boolean (SettingsCopy's announcement helper). */
export function wellnessAnnouncement(isOn: boolean): string {
  return `${settingsCopy.wellnessTitle}, ${isOn ? 'on' : 'off'}`;
}
