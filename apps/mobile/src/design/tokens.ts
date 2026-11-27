/**
 * CoachCal design tokens — the TypeScript port of
 * `native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/Tokens.swift`.
 * Tokens.swift is the source of truth: every value below was read by hand from it
 * (numeric scales from the Swift enums, colors from Colors.xcassets `*.colorset`
 * Contents.json, "any" = light and "dark" appearances).
 *
 * High-contrast ("high" and "dark/high" appearances) is not ported: React Native has
 * no built-in increased-contrast trigger; see docs/rn-migration/findings/U-22.md.
 */

import { useColorScheme } from 'react-native';

export type Scheme = 'light' | 'dark';

/** 4-pt grid (CCSpace). */
export const space = {
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

/** Radii (CCRadius). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Device-chrome exceptions and ring geometry (CCSize). */
export const size = {
  tapTarget: 44,
  fab: 56,
  shutter: 72,
  ringHero: 140,
  ringCompact: 120,
  ringGoal: 56,
  ringHeroStroke: 12,
  ringCompactStroke: 8,
  ringGoalStroke: 6,
  macroBarHeight: 6,
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

/**
 * Every color of Tokens.swift flows through the asset catalog — light = "any",
 * dark = "dark" appearance of each colorset.
 */
export type Colors = {
  background: string;
  surface: string;
  card: string;
  border: string;
  accentLime: string;
  accentLimePressed: string;
  accentInk: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  macroFiber: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  successInk: string;
  warningInk: string;
  errorInk: string;
  infoInk: string;
  appleHealth: string;
};

export const lightColors: Colors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  card: '#FFFFFF',
  border: 'rgba(0,0,0,0.0588)',
  accentLime: '#B4F04A',
  accentLimePressed: '#9AD93A',
  accentInk: '#587619',
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#AEAEB2',
  macroProtein: '#4A90E2',
  macroCarbs: '#F5A623',
  macroFat: '#9B6DFF',
  macroFiber: '#34C759',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
  successInk: '#157A33',
  warningInk: '#8A5300',
  errorInk: '#D70015',
  infoInk: '#0040DD',
  appleHealth: '#FF2D55',
};

export const darkColors: Colors = {
  background: '#000000',
  surface: '#0E0E10',
  card: '#1C1C1E',
  border: 'rgba(255,255,255,0.0784)',
  accentLime: '#B4F04A',
  accentLimePressed: '#9AD93A',
  accentInk: '#B4F04A',
  textPrimary: '#F5F5F7',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  macroProtein: '#5A9AE8',
  macroCarbs: '#D4901E',
  macroFat: '#8A5EE8',
  macroFiber: '#2EB04D',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',
  successInk: '#34C759',
  warningInk: '#FF9500',
  errorInk: '#FF3B30',
  infoInk: '#007AFF',
  appleHealth: '#FF2D55',
};

const colorsByScheme: Record<Scheme, Colors> = { light: lightColors, dark: darkColors };

/** The full token set for one scheme. */
export type Tokens = {
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  typography: typeof typography;
};

export function getTokens(scheme: Scheme): Tokens {
  return {
    colors: colorsByScheme[scheme],
    space,
    radius,
    size,
    typography,
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

/** `Color.opacity(_)` from SwiftUI for #RRGGBB token colors. */
export function withAlpha(color: string, alpha: number): string {
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
