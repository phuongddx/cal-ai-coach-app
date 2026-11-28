/**
 * The billing screens' copy (U-77, frames "Plans / paywall" and "Cancel flow").
 * Every number the canvas shows is a placeholder — D13: prices, trial terms and
 * renewal dates are store-sourced and this build connects no store, so no
 * string here carries a price, a date or a trial length.
 */
export const billingCopy = {
  /** Paywall hero (frame 18). */
  plansEyebrow: 'COACHCAL PLUS',
  plansHeadline: 'Unlimited scans and a coach who shows the maths.',
  featureUnlimitedScans: 'Unlimited photo, barcode and label scans',
  featureCoachReview: 'Weekly coach review and insights',
  featureExportHealth: 'CSV export and Apple Health sync',
  featureFreeLogging: 'Manual logging is free on every plan',
  /** Paywall states (frames b-paywall-loading / b-paywall-failed). The two
      Restore strings are recorded, not rendered: shown when a store exists
      (owner correction — a control that cannot act is not drawn, findings §5). */
  restoreLabel: 'Restore',
  loadingCta: 'Loading prices…',
  loadingNote: 'Prices come from the App Store in your currency.',
  failedCta: 'Prices unavailable',
  failedCardText:
    "Prices didn't load. Check your connection and try again. You'll always see the price before you pay.",
  failedNote: 'Already subscribed? Restore works without prices.',
  priceUnavailable: 'Price unavailable',
  tryAgain: 'Try again',
  readySubscribeCta: 'Subscribe',
  readyTrialCta: 'Start your free trial',
  /** Cancel flow (frames 19 / b-cancel-dark). No expiry date is shown: this
      build has no stored subscription to read one from ({expiryDate} on the
      canvas is the store's placeholder, D13). */
  cancelFlowTitle: 'Cancel subscription',
  cancelFlowHeadline: "Here's what happens if you cancel",
  cancelKeepLine: "Plus stays on until the end of the period you paid for. You won't be charged again.",
  cancelDataLine: 'Your diary, weight and streaks are kept.',
  cancelFreeLine: 'Manual logging stays free. Photo scans drop to 3 a week.',
  cancelAppleNote:
    "Apple handles the cancellation. The next step opens Apple's subscriptions page.",
  cancelContinue: 'Cancel subscription',
  cancelKeep: 'Keep Plus',
} as const;
