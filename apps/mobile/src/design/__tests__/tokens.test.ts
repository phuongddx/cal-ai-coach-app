/**
 * Token parity for `apps/mobile/src/design/tokens.ts`. The test READS
 * `docs/design/ember/tokens.css` (light in `:root`, dark in `.dark`), parses it and compares
 * every variable with the TypeScript token of the same name. No value is typed here by hand.
 * `compareTokensWithCss` is exported-in-file so the last describe can prove the test fails
 * when one side changes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  colorsWithoutEmberCounterpart,
  darkColors,
  fontFamily,
  getTokens,
  legacyColorAliases,
  lightColors,
  radius,
  scaledNumberSize,
  size,
  space,
  typography,
  withAlpha,
  type Colors,
} from '../tokens';

const CSS_PATH = join(__dirname, '../../../../../docs/design/ember/tokens.css');

type Declarations = Record<string, string>;

function parseBlock(css: string, selector: ':root' | '.dark'): Declarations {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = selector.replace('.', '\\.');
  const block = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(withoutComments);
  if (!block) throw new Error(`tokens.css has no ${selector} block`);
  const out: Declarations = {};
  for (const match of block[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]] = match[2].trim();
  }
  return out;
}

/** Light = `:root`; dark = `:root` overridden by `.dark` (CSS inheritance). */
export function parseTokensCss(css: string): { light: Declarations; dark: Declarations } {
  const light = parseBlock(css, ':root');
  const dark = { ...light, ...parseBlock(css, '.dark') };
  return { light, dark };
}

/** Normalize a CSS or RN color to `r,g,b,a` so `rgba(20,18,16,.08)` equals `rgba(20,18,16,0.08)`. */
function normalizeColor(value: string): string {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    const n = Number.parseInt(digits, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map((part) => Number.parseFloat(part));
    return `${r},${g},${b},${Math.round(a * 10000) / 10000}`;
  }
  return `unparsed:${v}`;
}

const camel = (dashed: string) =>
  dashed.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const px = (value: string) => Number.parseFloat(value.replace('px', ''));

const sizeNames: Record<string, keyof typeof size> = {
  tap: 'tap',
  btn: 'btn',
  shutter: 'shutter',
  ring: 'ring',
  'ring-stroke': 'ringStroke',
};

type Tokenset = {
  colors: Colors;
  space: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
  fontFamily: Record<string, string>;
};

/** Every mismatch between the CSS text and a token set, as readable lines. */
export function compareTokensWithCss(
  css: string,
  tokens: { light: Tokenset; dark: Tokenset },
): string[] {
  const parsed = parseTokensCss(css);
  const problems: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    const declarations = parsed[scheme];
    const ts = tokens[scheme];
    for (const [name, value] of Object.entries(declarations)) {
      const where = `${scheme} --${name}`;
      if (name === 'cc-font' || name === 'cc-font-round') {
        const key = name === 'cc-font' ? 'text' : 'round';
        if (ts.fontFamily[key] !== value) problems.push(`${where}: fontFamily.${key} differs`);
      } else if (name.startsWith('cc-')) {
        const key = camel(name.slice(3));
        const actual = (ts.colors as Record<string, string>)[key];
        if (actual === undefined) problems.push(`${where}: no colors.${key}`);
        else if (normalizeColor(actual) !== normalizeColor(value))
          problems.push(`${where}: colors.${key} is ${actual}, css has ${value}`);
      } else if (/^s\d+$/.test(name)) {
        if (ts.space[name.slice(1)] !== px(value)) problems.push(`${where}: space[${name.slice(1)}] differs`);
      } else if (name.startsWith('r-')) {
        const key = name.slice(2);
        if (ts.radius[key] !== px(value)) problems.push(`${where}: radius.${key} differs`);
      } else if (name in sizeNames) {
        if (ts.size[sizeNames[name]] !== px(value)) problems.push(`${where}: size.${sizeNames[name]} differs`);
      } else {
        problems.push(`${where}: variable the token test does not know`);
      }
    }
    // Every color token in TypeScript has a source in the CSS, an alias, or an explicit exemption.
    for (const key of Object.keys(ts.colors)) {
      const cssName = `cc-${key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`;
      const isAlias = key in legacyColorAliases;
      const isExempt = (colorsWithoutEmberCounterpart as readonly string[]).includes(key);
      if (!(cssName in declarations) && !isAlias && !isExempt) {
        problems.push(`${scheme} colors.${key}: no source in tokens.css`);
      }
    }
    for (const [key, target] of Object.entries(legacyColorAliases)) {
      const legacy = (ts.colors as Record<string, string>)[key];
      const current = (ts.colors as Record<string, string>)[target];
      if (legacy !== current) problems.push(`${scheme} colors.${key} is not ${target}`);
    }
  }
  return problems;
}

const css = readFileSync(CSS_PATH, 'utf8');
const real = {
  light: { colors: lightColors, space, radius, size, fontFamily },
  dark: { colors: darkColors, space, radius, size, fontFamily },
};

describe('design tokens match docs/design/ember/tokens.css (light and dark)', () => {
  it('every variable of tokens.css has the same value in tokens.ts for light and dark', () => {
    expect(compareTokensWithCss(css, real)).toEqual([]);
  });

  it('the CSS parser finds the variables of both blocks', () => {
    const parsed = parseTokensCss(css);
    expect(Object.keys(parsed.light).length).toBeGreaterThanOrEqual(59);
    expect(parsed.light['cc-accent']).toBe('#FF6A00');
    expect(parsed.dark['cc-accent-ink']).toBe('#FF7A1F');
    // `.dark` does not redeclare the ember text colors: they come from :root.
    expect(parsed.dark['cc-ember-text']).toBe(parsed.light['cc-ember-text']);
  });

  it('every color token of tokens.ts has a source in the CSS, an alias or an exemption', () => {
    const declared = parseTokensCss(css).light;
    for (const key of Object.keys(lightColors)) {
      const cssName = `cc-${key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`;
      const explained =
        cssName in declared ||
        key in legacyColorAliases ||
        (colorsWithoutEmberCounterpart as readonly string[]).includes(key);
      expect({ key, explained }).toEqual({ key, explained: true });
    }
  });

  it('keeps every key the app used before U-71', () => {
    const earlier = [
      'background', 'surface', 'card', 'border', 'accentLime', 'accentLimePressed', 'accentInk',
      'textPrimary', 'textSecondary', 'textTertiary', 'macroProtein', 'macroCarbs', 'macroFat',
      'macroFiber', 'success', 'warning', 'error', 'info', 'successInk', 'warningInk', 'errorInk',
      'infoInk', 'appleHealth',
    ];
    for (const key of earlier) {
      expect(lightColors).toHaveProperty(key);
      expect(darkColors).toHaveProperty(key);
    }
    for (const key of ['xs', 'sm', 'md', 'lg', 'xl', 'xl2', 'xl3', 'xl4', 'xl5']) expect(space).toHaveProperty(key);
    for (const key of ['sm', 'md', 'lg', 'xl', 'full']) expect(radius).toHaveProperty(key);
    for (const key of ['tapTarget', 'fab', 'shutter', 'ringHero', 'ringCompact', 'ringGoal', 'ringHeroStroke', 'ringCompactStroke', 'ringGoalStroke', 'macroBarHeight'])
      expect(size).toHaveProperty(key);
  });

  it('the legacy lime key now holds the Ember accent and the label color is never white', () => {
    expect(lightColors.accentLime).toBe(lightColors.accent);
    expect(lightColors.onAccent).not.toMatch(/^#f{3,6}$/i);
  });
});

describe('the token test fails when a value changes on either side', () => {
  it('fails when a color changes in the CSS', () => {
    const changed = css.replace('--cc-accent-ink: #B84300', '--cc-accent-ink: #B84301');
    expect(changed).not.toBe(css);
    expect(compareTokensWithCss(changed, real).length).toBeGreaterThan(0);
  });

  it('fails when a dark color changes in the CSS', () => {
    const changed = css.replace('--cc-card: #1C1A18', '--cc-card: #1C1A19');
    expect(changed).not.toBe(css);
    expect(compareTokensWithCss(changed, real).join('\n')).toContain('dark --cc-card');
  });

  it('fails when a color changes in tokens.ts', () => {
    const edited = {
      ...real,
      light: { ...real.light, colors: { ...lightColors, accent: '#FF6A01' } },
    };
    expect(compareTokensWithCss(css, edited).join('\n')).toContain('colors.accent');
  });

  it('fails when a spacing, radius or size changes in tokens.ts', () => {
    const edited = {
      ...real,
      light: {
        ...real.light,
        space: { ...space, 4: 17 },
        radius: { ...radius, md: 15 },
        size: { ...size, btn: 55 },
      },
    };
    const problems = compareTokensWithCss(css, edited).join('\n');
    expect(problems).toContain('space[4]');
    expect(problems).toContain('radius.md');
    expect(problems).toContain('size.btn');
  });

  it('fails when a variable has no key in tokens.ts', () => {
    const changed = css.replace(/--cc-fiber:\s*#2E8B47;/, '--cc-fiber: #2E8B47; --cc-new-thing: #123456;');
    expect(changed).not.toBe(css);
    expect(compareTokensWithCss(changed, real).join('\n')).toContain('no colors.newThing');
  });

  it('compares alpha values after normalizing (.08 equals 0.08)', () => {
    const changed = css.replace('rgba(20,18,16,.08)', 'rgba(20, 18, 16, 0.080)');
    expect(compareTokensWithCss(changed, real)).toEqual([]);
    const different = css.replace('rgba(20,18,16,.08)', 'rgba(20,18,16,.09)');
    expect(compareTokensWithCss(different, real).join('\n')).toContain('colors.border');
  });
});

describe('the scales the CSS does not hold stay as they were', () => {
  it('typography keeps the system text styles', () => {
    expect(typography.title).toEqual({ fontSize: 34, fontWeight: '600' });
    expect(typography.body).toEqual({ fontSize: 17, fontWeight: '400' });
    expect(typography.tabLabel).toEqual({ fontSize: 11, fontWeight: '500' });
  });

  it('scaled number sizes keep hero 56 and plan 64', () => {
    expect(scaledNumberSize).toEqual({ hero: 56, planNumber: 64 });
  });

  it('getTokens returns the whole set per scheme', () => {
    expect(getTokens('light').colors).toEqual(lightColors);
    expect(getTokens('dark').colors).toEqual(darkColors);
    expect(getTokens('light').isDark).toBe(false);
    expect(getTokens('dark').isDark).toBe(true);
    expect(getTokens('light').space).toBe(space);
    expect(getTokens('dark').radius).toBe(radius);
  });

  it('withAlpha applies the SwiftUI .opacity() equivalent', () => {
    expect(withAlpha('#FF6A00', 0.15)).toBe('rgba(255,106,0,0.15)');
    expect(withAlpha('#FFFFFF', 0.2)).toBe('rgba(255,255,255,0.2)');
  });

  it('withAlpha replaces the alpha of an rgba token', () => {
    expect(withAlpha('rgba(20,18,16,0.08)', 0.5)).toBe('rgba(20,18,16,0.5)');
  });
});
