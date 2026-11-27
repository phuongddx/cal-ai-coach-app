/**
 * Token parity table for `apps/mobile/src/design/tokens.ts`.
 * Every value was read by hand from `native/Modules/CoachCalDesignSystem/Sources/CoachCalDesignSystem/Tokens.swift`
 * (numeric scales) and its `Colors.xcassets` colorset JSON files ("any" appearance
 * = light, "dark" appearance = dark). The test asserts tokens.ts
 * matches this table for light and dark — update both sides together.
 */

import {
  darkColors,
  getTokens,
  lightColors,
  radius,
  scaledNumberSize,
  size,
  space,
  typography,
  withAlpha,
} from '../tokens';

type ColorTable = Record<keyof typeof lightColors, { light: string; dark: string }>;

// prettier-ignore
const colors: ColorTable = {
  background:         { light: '#FFFFFF', dark: '#000000' },
  surface:            { light: '#F5F5F7', dark: '#0E0E10' },
  card:               { light: '#FFFFFF', dark: '#1C1C1E' },
  border:             { light: 'rgba(0,0,0,0.0588)', dark: 'rgba(255,255,255,0.0784)' },
  accentLime:         { light: '#B4F04A', dark: '#B4F04A' },
  accentLimePressed:  { light: '#9AD93A', dark: '#9AD93A' },
  accentInk:          { light: '#587619', dark: '#B4F04A' },
  textPrimary:        { light: '#1D1D1F', dark: '#F5F5F7' },
  textSecondary:      { light: '#6E6E73', dark: '#98989D' },
  textTertiary:       { light: '#AEAEB2', dark: '#636366' },
  macroProtein:       { light: '#4A90E2', dark: '#5A9AE8' },
  macroCarbs:         { light: '#F5A623', dark: '#D4901E' },
  macroFat:           { light: '#9B6DFF', dark: '#8A5EE8' },
  macroFiber:         { light: '#34C759', dark: '#2EB04D' },
  success:            { light: '#34C759', dark: '#34C759' },
  warning:            { light: '#FF9500', dark: '#FF9500' },
  error:              { light: '#FF3B30', dark: '#FF3B30' },
  info:               { light: '#007AFF', dark: '#007AFF' },
  successInk:         { light: '#157A33', dark: '#34C759' },
  warningInk:         { light: '#8A5300', dark: '#FF9500' },
  errorInk:           { light: '#D70015', dark: '#FF3B30' },
  infoInk:            { light: '#0040DD', dark: '#007AFF' },
  appleHealth:        { light: '#FF2D55', dark: '#FF2D55' },
};

describe('design tokens match Tokens.swift (light and dark)', () => {
  it('space matches CCSpace (4-pt grid)', () => {
    expect(space).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xl2: 24, xl3: 32, xl4: 40, xl5: 48 });
  });

  it('radius matches CCRadius', () => {
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16, xl: 20, full: 9999 });
  });

  it('size matches CCSize (chrome exceptions and ring geometry)', () => {
    expect(size).toEqual({
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
    });
  });

  it('typography matches CCTypography (system text style points and weights)', () => {
    expect(typography).toEqual({
      title: { fontSize: 34, fontWeight: '600' }, // .largeTitle.weight(.semibold)
      heading: { fontSize: 22, fontWeight: '600' }, // .title2.weight(.semibold)
      headline: { fontSize: 17, fontWeight: '600' }, // .headline
      body: { fontSize: 17, fontWeight: '400' }, // .body
      subhead: { fontSize: 15, fontWeight: '400' }, // .subheadline
      footnote: { fontSize: 13, fontWeight: '400' }, // .footnote
      caption: { fontSize: 12, fontWeight: '500' }, // .caption.weight(.medium)
      tabLabel: { fontSize: 11, fontWeight: '500' }, // .caption2.weight(.medium)
    });
  });

  it('scaled number sizes match CCScaledNumber (hero 56, plan 64)', () => {
    expect(scaledNumberSize).toEqual({ hero: 56, planNumber: 64 });
  });

  it('colors match the asset catalog for light', () => {
    for (const [name, values] of Object.entries(colors)) {
      expect(lightColors[name as keyof ColorTable]).toBe(values.light);
    }
  });

  it('colors match the asset catalog for dark', () => {
    for (const [name, values] of Object.entries(colors)) {
      expect(darkColors[name as keyof ColorTable]).toBe(values.dark);
    }
  });

  it('getTokens returns the whole set per scheme', () => {
    expect(getTokens('light').colors).toEqual(lightColors);
    expect(getTokens('dark').colors).toEqual(darkColors);
    expect(getTokens('light').space).toBe(space);
    expect(getTokens('dark').radius).toBe(radius);
  });

  it('withAlpha applies the SwiftUI .opacity() equivalent', () => {
    expect(withAlpha('#B4F04A', 0.15)).toBe('rgba(180,240,74,0.15)');
    expect(withAlpha('#FFFFFF', 0.2)).toBe('rgba(255,255,255,0.2)');
  });
});
