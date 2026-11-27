/**
 * CoachCal design tokens, built from the chain of Ember (decision D12, rule 22):
 *
 *   docs/design/ember/tokens.css -> tokens.json -> emberTokens.generated.ts (node scripts/rn/gen-tokens.mjs)
 *   -> this file -> the keys the app reads.
 *
 * No color, space, radius, size or text style is written by hand here: every group is read from `emberTokens`.
 * What the chain does not hold lives in `tokensWithoutSource.ts` (one register, pinned by the token
 * test). Naming: `--cc-accent-ink` is `accentInk`, `--s4` is `space[4]`, `--r-md` is `radius.md`,
 * `--ring-stroke` is `size.ringStroke`.
 *
 * Four color modes follow the cascade of tokens.css: `light`, `dark`, `highContrastLight` and
 * `highContrastDark`. The last two apply while iOS Increase Contrast is on (`highContrast.ts`);
 * space, radius, size and font never change with contrast.
 *
 * Keys of the earlier SwiftUI port (`accentLime`, `textPrimary`, `surface`, `warning`, ...) stay as
 * aliases of the Ember value with the same meaning (`legacyColorAliases`), so a screen that is not
 * restyled yet still renders. No key is deleted.
 */

import { useColorScheme } from 'react-native';

import { emberTokens } from './emberTokens.generated';
import { useHighContrast } from './highContrast';
import {
  colorValuesWithoutSource,
  colorsWithoutEmberCounterpart,
  radiusWithoutSource,
  scaledNumberSize,
  sizeWithoutSource,
} from './tokensWithoutSource';

export { withAlpha } from './color';
export { colorsWithoutEmberCounterpart, scaledNumberSize, type ScaledNumberRole } from './tokensWithoutSource';

export type Scheme = 'light' | 'dark';

const { color, font, space: emberSpace, radius: emberRadius, size: emberSize, type: emberType } = emberTokens;

/** 4-pt grid: `--s1`..`--s12` as `space[1]`..`space[12]`, plus the earlier names of the same steps. */
export const space = {
  1: emberSpace.s1,
  2: emberSpace.s2,
  3: emberSpace.s3,
  4: emberSpace.s4,
  5: emberSpace.s5,
  6: emberSpace.s6,
  8: emberSpace.s8,
  10: emberSpace.s10,
  12: emberSpace.s12,
  // Earlier keys, same values as the numbered scale.
  xs: emberSpace.s1,
  sm: emberSpace.s2,
  md: emberSpace.s3,
  lg: emberSpace.s4,
  xl: emberSpace.s5,
  xl2: emberSpace.s6,
  xl3: emberSpace.s8,
  xl4: emberSpace.s10,
  xl5: emberSpace.s12,
} as const;

/** Radii `--r-*` (concentric with iOS 26 controls); `full` is the earlier name of `pill`. */
export const radius = {
  ...emberRadius,
  full: emberRadius.pill,
  /** The earlier name of `btn` (`--r-btn`): buttons, chips and segments. */
  button: emberRadius.btn,
  ...radiusWithoutSource,
} as const;

/**
 * Sizes of tokens.css (`--tap`, `--btn`, `--shutter`, `--ring`, `--ring-stroke`, `--fab`, `--ring-md`,
 * `--ring-md-stroke`, `--ring-sm`, `--ring-sm-stroke`, `--macro-bar`), then the earlier keys, each
 * following the Ember size whose meaning it kept: `tapTarget`, `ringHero`, `ringHeroStroke`,
 * `ringCompact` (the 120 pt ring, `--ring-sm`), `ringCompactStroke` and `macroBarHeight`. The goal
 * ring (56 pt) has no variable: it stays in `tokensWithoutSource.ts`.
 */
export const size = {
  ...emberSize,
  tapTarget: emberSize.tap,
  ringHero: emberSize.ring,
  ringHeroStroke: emberSize.ringStroke,
  ringCompact: emberSize.ringSm,
  ringCompactStroke: emberSize.ringSmStroke,
  macroBarHeight: emberSize.macroBar,
  ...sizeWithoutSource,
} as const;

/** The sixteen text styles of tokens.css (`--t-*`), by their name in tokens.json: `largeTitle` ... `numBody`. */
export type TextStyleName = keyof typeof emberType;

export type EmberTextStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  /** `rounded` is SF Pro Rounded (`--cc-font-round`), `text` the system font (`--cc-font`). */
  family: 'text' | 'rounded';
};

/** Exposed as `useTokens().type` and as `textStyles`. `--t-large-title` is `type.largeTitle`, `--t-num-md` is `type.numMd`; the values come from the chain. */
export const textStyles = Object.fromEntries(
  (Object.keys(emberType) as TextStyleName[]).map((name) => {
    const { size: fontSize, lineHeight, weight, family } = emberType[name];
    return [name, { fontSize, lineHeight, fontWeight: String(weight) as EmberTextStyle['fontWeight'], family }];
  }),
) as Record<TextStyleName, EmberTextStyle>;

/** Typography roles (CCTypography.Role), the earlier names, with the Ember text style each reads. */
export type TypographyRole =
  | 'title' // type.largeTitle
  | 'heading' // type.title2
  | 'headline' // type.headline
  | 'body' // type.body
  | 'subhead' // type.subheadline
  | 'footnote' // type.footnote
  | 'caption' // type.caption1
  | 'tabLabel'; // type.caption2

export type TypographyStyle = Pick<EmberTextStyle, 'fontSize' | 'fontWeight'>;

/** The text style of the design each earlier role follows. */
export const typographyRoleSource = {
  title: 'largeTitle',
  heading: 'title2',
  headline: 'headline',
  body: 'body',
  subhead: 'subheadline',
  footnote: 'footnote',
  caption: 'caption1',
  tabLabel: 'caption2',
} as const satisfies Record<TypographyRole, TextStyleName>;

/** Size and weight only (no line height), so a screen that spreads a role keeps its layout. */
export const typography = Object.fromEntries(
  (Object.keys(typographyRoleSource) as TypographyRole[]).map((role) => {
    const { fontSize, fontWeight } = textStyles[typographyRoleSource[role]];
    return [role, { fontSize, fontWeight }];
  }),
) as Record<TypographyRole, TypographyStyle>;

/** `--cc-font` and `--cc-font-round`, verbatim. React Native takes the system font on iOS. */
export const fontFamily = {
  text: font.text,
  round: font.rounded,
} as const;

/** Every `--cc-*` color of tokens.css, camelCase. The key set follows the generated module. */
export type EmberColors = { -readonly [K in keyof typeof color.light]: string };

/** Earlier key -> the Ember key whose value it now holds. */
export const legacyColorAliases = {
  background: 'bg',
  surface: 'fill',
  accentLime: 'accent',
  accentLimePressed: 'accentPressed',
  textPrimary: 'text',
  textSecondary: 'text2',
  textTertiary: 'text3',
  macroProtein: 'protein',
  macroCarbs: 'carbs',
  macroFat: 'fat',
  macroFiber: 'fiber',
  warning: 'caution',
  warningInk: 'cautionInk',
} as const satisfies Record<string, keyof EmberColors>;

export type LegacyColorKey = keyof typeof legacyColorAliases;

export type Colors = EmberColors &
  Record<LegacyColorKey, string> &
  Record<(typeof colorsWithoutEmberCounterpart)[number], string>;

function withLegacyKeys(ember: EmberColors): Colors {
  const legacy = {} as Record<LegacyColorKey, string>;
  for (const key of Object.keys(legacyColorAliases) as LegacyColorKey[]) {
    legacy[key] = ember[legacyColorAliases[key]];
  }
  return { ...ember, ...legacy, ...colorValuesWithoutSource };
}

export const lightColors: Colors = withLegacyKeys(color.light);
export const darkColors: Colors = withLegacyKeys(color.dark);
export const highContrastLightColors: Colors = withLegacyKeys(color.highContrastLight);
export const highContrastDarkColors: Colors = withLegacyKeys(color.highContrastDark);

/** The four color modes of the chain, by name. */
export type ColorMode = keyof typeof emberTokens.color;

export const colorsByMode: Record<ColorMode, Colors> = {
  light: lightColors,
  dark: darkColors,
  highContrastLight: highContrastLightColors,
  highContrastDark: highContrastDarkColors,
};

/** The full token set for one scheme and one contrast setting. */
export type Tokens = {
  scheme: Scheme;
  /** True in the dark scheme: components branch on this, never on a color literal. */
  isDark: boolean;
  /** True while iOS Increase Contrast is on: `colors` then holds the High Contrast values. */
  highContrast: boolean;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  typography: typeof typography;
  /** The sixteen text styles of the design, under the names of tokens.json. */
  type: typeof textStyles;
  fontFamily: typeof fontFamily;
};

export type TokenOptions = {
  /** The system color scheme; `null`, `undefined` or anything but `dark` is light. */
  colorScheme?: string | null;
  highContrast?: boolean;
};

/**
 * Pure: the token set for a color scheme and a contrast setting. A bare scheme string is accepted for
 * the callers that predate the contrast setting; it means normal contrast.
 */
export function getTokens(options: Scheme | TokenOptions): Tokens {
  const { colorScheme, highContrast = false } =
    typeof options === 'string' ? { colorScheme: options, highContrast: false } : options;
  const scheme: Scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const mode: ColorMode =
    scheme === 'dark'
      ? highContrast
        ? 'highContrastDark'
        : 'dark'
      : highContrast
        ? 'highContrastLight'
        : 'light';
  return {
    scheme,
    isDark: scheme === 'dark',
    highContrast,
    colors: colorsByMode[mode],
    space,
    radius,
    size,
    typography,
    type: textStyles,
    fontFamily,
  };
}

/** The token set for the current color scheme and the iOS Increase Contrast setting. */
export function useTokens(): Tokens {
  const colorScheme = useColorScheme();
  const highContrast = useHighContrast();
  return getTokens({ colorScheme, highContrast });
}
