/**
 * The register of every value the app reads that `docs/design/ember/tokens.css` does not hold.
 * `tokens.ts` builds all it can from `emberTokens` (the generated module); what is left has no
 * source in the chain and is written here, in one place, so it is visible and cannot grow silently:
 * the token test pins the exact key lists (`tokensWithoutSource.test`), and the findings of U-71d
 * list each one for the owner and Designer to either add to `tokens.css` or retire it.
 *
 * U-71d moved out of this file, into the chain: the Apple Health color (`appleHealth`), the button
 * radius (`radius.btn`), the floating button (`size.fab`), the compact ring (`size.ringSm`,
 * `size.ringSmStroke`) and the macro bar (`size.macroBar`). Nothing here is a color any more.
 */

/** Earlier color keys with no Ember counterpart. None is left: `appleHealth` is `--cc-apple-health`. */
export const colorsWithoutEmberCounterpart = [] as const;

export const colorValuesWithoutSource: Record<(typeof colorsWithoutEmberCounterpart)[number], string> = {};

/** Radius: nothing. `radius.button` is `radius.btn` (`--r-btn`). */
export const radiusWithoutSource = {} as const;

/**
 * Sizes the design has no variable for: the 56 pt goal ring of the diary water card and the
 * onboarding macro ring, with its 6 pt stroke. `--ring-sm` is 120 pt and `--ring` 184 pt; no
 * variable describes a ring this small, so it stays here until the design adds one.
 */
export const sizeWithoutSource = {
  ringGoal: 56,
  ringGoalStroke: 6,
} as const;

/**
 * CCScaledNumber roles: hero (700/56) and plan (700/64) numerals. `--t-num-xl` is 44 and no text
 * style of the design is 56 or 64, so these two sizes have no source in the chain.
 */
export type ScaledNumberRole = 'hero' | 'planNumber';

export const scaledNumberSize: Record<ScaledNumberRole, number> = {
  hero: 56,
  planNumber: 64,
};
