/**
 * The register of every value the app reads that `docs/design/ember/tokens.css` does not hold.
 * `tokens.ts` builds all it can from `emberTokens` (the generated module); what is left has no
 * source in the chain and is written here, in one place, so it is visible and cannot grow silently:
 * the token test pins the exact key lists (`tokensWithoutSource.test`), and the findings of U-71c
 * ask the owner and Designer to either add each one to `tokens.css` or retire it.
 *
 * Nothing here is an Ember color except `appleHealth`, which is Apple's own Health brand color.
 */

/** Earlier color keys with no Ember counterpart. They keep their value. */
export const colorsWithoutEmberCounterpart = ['appleHealth'] as const;

export const colorValuesWithoutSource: Record<(typeof colorsWithoutEmberCounterpart)[number], string> = {
  appleHealth: '#FF2D55',
};

/** Radius: the canvas `.btn` and `.chip` use 18 with no CSS variable. */
export const radiusWithoutSource = { button: 18 } as const;

/**
 * Sizes with no `--tap/--btn/--shutter/--ring/--ring-stroke` counterpart. `fab` is 56 like `--btn`
 * but is the app shell's own control, so it does not follow `--btn`.
 */
export const sizeWithoutSource = {
  fab: 56,
  ringCompact: 120,
  ringGoal: 56,
  ringCompactStroke: 8,
  ringGoalStroke: 6,
  macroBarHeight: 8,
} as const;

/** Typography roles (CCTypography.Role) with the iOS system text style each maps to. */
export type TypographyRole =
  | 'title' // .largeTitle.weight(.semibold)
  | 'heading' // .title2.weight(.semibold)
  | 'headline' // .headline
  | 'body' // .body
  | 'subhead' // .subheadline
  | 'footnote' // .footnote
  | 'caption' // .caption.weight(.medium)
  | 'tabLabel'; // .caption2.weight(.medium)

export type TypographyStyle = {
  fontSize: number;
  fontWeight: '400' | '500' | '600';
};

export const typography: Record<TypographyRole, TypographyStyle> = {
  title: { fontSize: 34, fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '600' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
  tabLabel: { fontSize: 11, fontWeight: '500' },
};

/** CCScaledNumber roles: hero (700/56) and plan (700/64) numerals. */
export type ScaledNumberRole = 'hero' | 'planNumber';

export const scaledNumberSize: Record<ScaledNumberRole, number> = {
  hero: 56,
  planNumber: 64,
};
