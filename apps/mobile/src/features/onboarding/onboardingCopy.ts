/**
 * OnboardingCopy (OnboardingModel.swift) — UI-SPEC Copywriting / Group A
 * contract: these strings are locked verbatim. Never edit a string here
 * without the Swift source open; the Jest twins assert them by exact text.
 * Field names avoid the design system's policy API names on purpose (I7).
 */
export const onboardingCopy = {
  safetyFloorBanner:
    '**Safety floor:** We never recommend below 1,200 kcal/day for women or 1,500 kcal/day for men.',
  dobGateFootnote: 'Must be 18+ to use CoachCal',
  safeModeTitle: 'ED-safe mode included',
  safeModeSubtitle: 'Focus on habits, not numbers',
  projectionDisclaimer:
    '**Individual results vary.** The shaded area shows a realistic range. Factors like water retention, stress, and sleep affect progress.',
  privacyPromiseBanner:
    'Your health data stays on your device. We never sell or share your information.',
  medicalDisclaimer:
    'Not medical advice. Consult a healthcare provider before starting any diet.',
  weeklyRangeCaption: "Some days higher, some lower — that's normal",
  healthConnectNote: 'Apple Health connects in a later update.',
  persistError: "Couldn't save your plan. Try again.",
} as const;

/** The 4-step checklist of the generating screen, in order. */
export const GENERATION_STEPS = [
  'Calculating TDEE',
  'Setting macro ratios',
  'Applying safety floor',
  'Generating weekly plan',
] as const;
