/**
 * Ember design system v2 tokens, ported 1:1 from `tokens.css` (light = :root, dark = .dark).
 * Components read colours from here only; no literal hex in JSX.
 */
export type EmberScheme = 'light' | 'dark';

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
  success: string;
  successInk: string;
  successTint: string;
  caution: string;
  cautionInk: string;
  cautionTint: string;
  error: string;
  errorInk: string;
  errorTint: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

export const lightColors: EmberColors = {
  accent: '#FF6A00',
  accentPressed: '#E35A00',
  onAccent: '#0B0A09',
  accentStrong: '#E35A00',
  accentInk: '#B84300',
  accentTint: '#FFEBDC',
  ember: '#141210',
  emberTrack: '#3A342F',
  emberText: '#F7F5F2',
  emberText2: '#ABA6A0',
  emberAccent: '#FF7A1F',
  bg: '#FFFFFF',
  grouped: '#F6F5F3',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  fill: '#EFEDEA',
  border: 'rgba(20,18,16,0.08)',
  separator: 'rgba(20,18,16,0.12)',
  text: '#141210',
  text2: '#5F5B57',
  text3: '#6F6A65',
  success: '#22A653',
  successInk: '#146C34',
  successTint: '#E6F6EB',
  caution: '#E0A800',
  cautionInk: '#6E5300',
  cautionTint: '#FFF6D6',
  error: '#E5243B',
  errorInk: '#B3122E',
  errorTint: '#FDE8EC',
  protein: '#2563EB',
  carbs: '#0E8A7E',
  fat: '#7C4DDB',
  fiber: '#2E8B47',
};

export const darkColors: EmberColors = {
  ...lightColors,
  accentStrong: '#FF6A00',
  accentInk: '#FF7A1F',
  accentTint: '#3A2312',
  ember: '#1C1A18',
  bg: '#000000',
  grouped: '#000000',
  card: '#1C1A18',
  elevated: '#2A2724',
  fill: '#2A2724',
  border: 'rgba(255,255,255,0.08)',
  separator: 'rgba(255,255,255,0.12)',
  text: '#F7F5F2',
  text2: '#ABA6A0',
  text3: '#9A958F',
  success: '#4ADE80',
  successInk: '#4ADE80',
  successTint: '#12301E',
  caution: '#FFD43B',
  cautionInk: '#FFD43B',
  cautionTint: '#3A3214',
  error: '#FF7088',
  errorInk: '#FF7088',
  errorTint: '#3A1219',
  protein: '#6EA8FF',
  carbs: '#3CCFBE',
  fat: '#B794FF',
  fiber: '#5AD27A',
};

export function getColors(scheme: EmberScheme): EmberColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

/** 4-pt spacing grid, radii and sizes from tokens.css. */
export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const size = { tap: 44, btn: 56, shutter: 76, ring: 184, ringStroke: 16 } as const;

/** Rounded system design for numbers (`ui-rounded` resolves to SF Pro Rounded on iOS). */
export const fontRound = 'ui-rounded';
