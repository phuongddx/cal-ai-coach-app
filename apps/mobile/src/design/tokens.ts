/**
 * CoachCal design tokens — the TypeScript copy of `docs/design/ember/tokens.css`
 * (Ember, decision D12). Light = `:root`, dark = `.dark`; a variable that `.dark` does not
 * redeclare keeps its `:root` value, so each scheme below lists every variable. The token test
 * (`__tests__/tokens.test.ts`) READS tokens.css and compares every variable on both sides:
 * change a value here or there and it fails. Naming: `--cc-accent-ink` is `accentInk`,
 * `--s4` is `space[4]`, `--r-md` is `radius.md`, `--ring-stroke` is `size.ringStroke`.
 *
 * Keys of the earlier SwiftUI port (`accentLime`, `textPrimary`, `surface`, `warning`, ...)
 * stay as aliases of the Ember value with the same meaning (`legacyColorAliases`), so a screen
 * that is not restyled yet still renders, only in the Ember colors. A legacy key with no Ember
 * counterpart keeps its value (`colorsWithoutEmberCounterpart`). No key is deleted in U-71.
 *
 * High-contrast values of design-system.md are not ported: React Native has no increased-
 * contrast trigger (docs/rn-migration/findings/U-71.md).
 */

import { useColorScheme } from 'react-native';

export type Scheme = 'light' | 'dark';

/** 4-pt grid: `--s1`..`--s12` as `space[1]`..`space[12]`, plus the keys the app already uses. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  // Earlier keys, same values as the numbered scale.
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  xl3: 32,
  xl4: 40,
  xl5: 48,
} as const;

/** Radii `--r-*` (concentric with iOS 26 controls); `full` is the earlier name of `pill`. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
  full: 999,
} as const;

/**
 * Sizes: `--tap`, `--btn`, `--shutter`, `--ring`, `--ring-stroke`. The rest are earlier keys:
 * `tapTarget`, `ringHero` and `ringHeroStroke` follow their Ember counterparts, the others have
 * none and keep their value (`macroBarHeight` is 8 as the canvas `.bar` draws it).
 */
export const size = {
  tap: 44,
  btn: 56,
  shutter: 76,
  ring: 184,
  ringStroke: 16,
  tapTarget: 44,
  fab: 56,
  ringHero: 184,
  ringCompact: 120,
  ringGoal: 56,
  ringHeroStroke: 16,
  ringCompactStroke: 8,
  ringGoalStroke: 6,
  macroBarHeight: 8,
} as const;

/** `--cc-font` and `--cc-font-round`, verbatim. React Native takes the system font on iOS. */
export const fontFamily = {
  text: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, "Inter", "Segoe UI", sans-serif',
  round: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif',
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

/** Every `--cc-*` color of tokens.css, camelCase. */
export type EmberColors = {
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentStrong: string;
  accentInk: string;
  accentTint: string;
  ember: string;
  emberTrack: string;
  emberText: string;
  emberText2: string;
  emberAccent: string;
  bg: string;
  grouped: string;
  card: string;
  elevated: string;
  fill: string;
  border: string;
  separator: string;
  text: string;
  text2: string;
  text3: string;
  grabber: string;
  success: string;
  successInk: string;
  successTint: string;
  caution: string;
  cautionInk: string;
  cautionTint: string;
  error: string;
  errorInk: string;
  errorTint: string;
  info: string;
  infoInk: string;
  infoTint: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

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

/** Earlier keys with no Ember counterpart: they keep their value (listed in the findings). */
export const colorsWithoutEmberCounterpart = ['appleHealth'] as const;

export type Colors = EmberColors &
  Record<LegacyColorKey, string> &
  Record<(typeof colorsWithoutEmberCounterpart)[number], string>;

// prettier-ignore
const emberLight: EmberColors = {
  accent: '#FF6A00', accentPressed: '#E35A00', onAccent: '#0B0A09', accentStrong: '#E35A00',
  accentInk: '#B84300', accentTint: '#FFEBDC', ember: '#141210', emberTrack: '#3A342F',
  emberText: '#F7F5F2', emberText2: '#ABA6A0', emberAccent: '#FF7A1F',
  bg: '#FFFFFF', grouped: '#F6F5F3', card: '#FFFFFF', elevated: '#FFFFFF', fill: '#EFEDEA',
  border: 'rgba(20,18,16,0.08)', separator: 'rgba(20,18,16,0.12)',
  text: '#141210', text2: '#5F5B57', text3: '#6F6A65', grabber: 'rgba(20,18,16,0.22)',
  success: '#22A653', successInk: '#146C34', successTint: '#E6F6EB',
  caution: '#E0A800', cautionInk: '#6E5300', cautionTint: '#FFF6D6',
  error: '#E5243B', errorInk: '#B3122E', errorTint: '#FDE8EC',
  info: '#2563EB', infoInk: '#1D4ED8', infoTint: '#E8EFFE',
  protein: '#2563EB', carbs: '#0E8A7E', fat: '#7C4DDB', fiber: '#2E8B47',
};

// prettier-ignore
const emberDark: EmberColors = {
  accent: '#FF6A00', accentPressed: '#E35A00', onAccent: '#0B0A09', accentStrong: '#FF6A00',
  accentInk: '#FF7A1F', accentTint: '#3A2312', ember: '#1C1A18', emberTrack: '#3A342F',
  emberText: '#F7F5F2', emberText2: '#ABA6A0', emberAccent: '#FF7A1F',
  bg: '#000000', grouped: '#000000', card: '#1C1A18', elevated: '#2A2724', fill: '#2A2724',
  border: 'rgba(255,255,255,0.08)', separator: 'rgba(255,255,255,0.12)',
  text: '#F7F5F2', text2: '#ABA6A0', text3: '#9A958F', grabber: 'rgba(255,255,255,0.3)',
  success: '#4ADE80', successInk: '#4ADE80', successTint: '#12301E',
  caution: '#FFD43B', cautionInk: '#FFD43B', cautionTint: '#3A3214',
  error: '#FF7088', errorInk: '#FF7088', errorTint: '#3A1219',
  info: '#6EA8FF', infoInk: '#6EA8FF', infoTint: '#14223D',
  protein: '#6EA8FF', carbs: '#3CCFBE', fat: '#B794FF', fiber: '#5AD27A',
};

function withLegacyKeys(ember: EmberColors): Colors {
  const legacy = {} as Record<LegacyColorKey, string>;
  for (const key of Object.keys(legacyColorAliases) as LegacyColorKey[]) {
    legacy[key] = ember[legacyColorAliases[key]];
  }
  return { ...ember, ...legacy, appleHealth: '#FF2D55' };
}

export const lightColors: Colors = withLegacyKeys(emberLight);

export const darkColors: Colors = withLegacyKeys(emberDark);

const colorsByScheme: Record<Scheme, Colors> = { light: lightColors, dark: darkColors };

/** The full token set for one scheme. */
export type Tokens = {
  scheme: Scheme;
  /** True in the dark scheme: components branch on this, never on a color literal. */
  isDark: boolean;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
};

export function getTokens(scheme: Scheme): Tokens {
  return {
    scheme,
    isDark: scheme === 'dark',
    colors: colorsByScheme[scheme],
    space,
    radius,
    size,
    typography,
    fontFamily,
  };
}

/** The token set for the current color scheme. */
export function useTokens(): Tokens {
  return getTokens(useScheme());
}

function useScheme(): Scheme {
  const system = useColorScheme();
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * `Color.opacity(_)` for a `#RRGGBB` token or an `rgba(r,g,b,a)` token (the new alpha replaces
 * the old one).
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const [r, g, b] = color
      .slice(color.indexOf('(') + 1, color.indexOf(')'))
      .split(',')
      .map((part) => Number.parseFloat(part));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
