/**
 * Token parity along the whole chain (rule 22, U-71c):
 *
 *   docs/design/ember/tokens.css -> docs/design/ember/tokens.json -> emberTokens.generated.ts -> tokens.ts
 *
 * The test READS the files; no token value is typed here. Link by link:
 *  1. `tokens.json` equals `tokens.css` in the four cascaded modes (the cascade of
 *     `docs/design/ember/scripts/tokens-to-json.mjs`: light is `:root`; dark adds `.dark`; high contrast
 *     light adds `.hc`; high contrast dark adds `.dark`, `.hc` and `.dark.hc`).
 *  2. `emberTokens.generated.ts` is what `node scripts/rn/gen-tokens.mjs --check` accepts, and equals
 *     `tokens.json` value by value.
 *  3. Every group and every color `tokens.ts` returns, in each of the four modes, equals the chain.
 * The last describe proves each link fails when one value changes. The functions that compare are
 * ordinary functions of their inputs, so a changed copy of one side is enough to show the failure.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { emberTokens } from '../emberTokens.generated';
import {
  colorsByMode,
  colorsWithoutEmberCounterpart,
  fontFamily,
  getTokens,
  legacyColorAliases,
  radius,
  scaledNumberSize,
  size,
  space,
  typography,
  withAlpha,
  type ColorMode,
  type Colors,
} from '../tokens';
import {
  colorValuesWithoutSource,
  radiusWithoutSource,
  sizeWithoutSource,
} from '../tokensWithoutSource';

const ROOT = join(__dirname, '../../../../..');
const CSS_PATH = join(ROOT, 'docs/design/ember/tokens.css');
const JSON_PATH = join(ROOT, 'docs/design/ember/tokens.json');
const MODES: readonly ColorMode[] = ['light', 'dark', 'highContrastLight', 'highContrastDark'];

type Declarations = Record<string, string>;
type Json = {
  color: Record<string, Record<string, string>>;
  font: Record<string, string>;
  space: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
};

function parseBlocks(css: string): Record<string, Declarations> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Record<string, Declarations> = {};
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declarations: Declarations = {};
    for (const decl of match[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) declarations[decl[1]] = decl[2].trim();
    const selector = match[1].trim();
    blocks[selector] = { ...blocks[selector], ...declarations };
  }
  for (const selector of [':root', '.dark', '.hc', '.dark.hc']) {
    if (!blocks[selector]) throw new Error(`tokens.css has no ${selector} block`);
  }
  return blocks;
}

/** The four cascaded modes of tokens.css, every variable included. */
export function cascadeCss(css: string): Record<ColorMode, Declarations> {
  const blocks = parseBlocks(css);
  return {
    light: { ...blocks[':root'] },
    dark: { ...blocks[':root'], ...blocks['.dark'] },
    highContrastLight: { ...blocks[':root'], ...blocks['.hc'] },
    highContrastDark: { ...blocks[':root'], ...blocks['.dark'], ...blocks['.hc'], ...blocks['.dark.hc'] },
  };
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

const camel = (dashed: string) => dashed.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const px = (value: string) => Number.parseFloat(value.replace('px', ''));
const isColor = (value: string) => /^(#|rgba?\()/i.test(value);

/** Color variables of one cascaded mode, as `{ camelName: value }` (what tokens-to-json.mjs keeps). */
function colorsOf(declarations: Declarations): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(declarations)) {
    if (name.startsWith('cc-') && isColor(value)) out[camel(name.slice(3))] = value;
  }
  return out;
}

function sameColors(label: string, expected: Record<string, string>, actual: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) problems.push(`${label} ${key}: missing (expected ${value})`);
    else if (normalizeColor(actual[key]) !== normalizeColor(value))
      problems.push(`${label} ${key}: is ${actual[key]}, expected ${value}`);
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) problems.push(`${label} ${key}: not in the source`);
  }
  return problems;
}

function sameNumbers(label: string, expected: Record<string, number>, actual: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) problems.push(`${label} ${key}: is ${String(actual[key])}, expected ${value}`);
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) problems.push(`${label} ${key}: not in the source`);
  }
  return problems;
}

function cssNumbers(root: Declarations) {
  const pick = (test: (name: string) => boolean, rename: (name: string) => string) =>
    Object.fromEntries(
      Object.entries(root)
        .filter(([name]) => test(name))
        .map(([name, value]) => [rename(name), px(value)]),
    );
  return {
    space: pick((n) => /^s\d+$/.test(n), (n) => n),
    radius: pick((n) => n.startsWith('r-'), (n) => n.slice(2)),
    size: pick((n) => /^(tap|btn|shutter|ring|ring-stroke)$/.test(n), camel),
  };
}

/** Link 1: every variable of tokens.css against tokens.json. */
export function compareCssWithJson(css: string, json: Json): string[] {
  const modes = cascadeCss(css);
  const problems: string[] = [];
  for (const mode of MODES) {
    problems.push(...sameColors(`json ${mode}`, colorsOf(modes[mode]), json.color[mode] ?? {}));
  }
  const root = modes.light;
  if (json.font.text !== root['cc-font']) problems.push('json font.text differs from --cc-font');
  if (json.font.rounded !== root['cc-font-round']) problems.push('json font.rounded differs from --cc-font-round');
  const numbers = cssNumbers(root);
  problems.push(...sameNumbers('json space', numbers.space, json.space));
  problems.push(...sameNumbers('json radius', numbers.radius, json.radius));
  problems.push(...sameNumbers('json size', numbers.size, json.size));
  return problems;
}

type Generated = {
  color: Record<string, Record<string, string>>;
  font: Record<string, string>;
  space: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
};

/** Link 2 (values): the generated module against tokens.json. `gen-tokens --check` covers the bytes. */
export function compareJsonWithGenerated(json: Json, generated: Generated): string[] {
  const problems: string[] = [];
  for (const mode of MODES) {
    problems.push(...sameColors(`generated ${mode}`, json.color[mode], generated.color[mode] ?? {}));
  }
  if (generated.font.text !== json.font.text) problems.push('generated font.text differs');
  if (generated.font.rounded !== json.font.rounded) problems.push('generated font.rounded differs');
  problems.push(...sameNumbers('generated space', json.space, generated.space));
  problems.push(...sameNumbers('generated radius', json.radius, generated.radius));
  problems.push(...sameNumbers('generated size', json.size, generated.size));
  return problems;
}

type TokenSet = {
  colorsByMode: Record<ColorMode, Colors>;
  space: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
  fontFamily: Record<string, string>;
};

/** Link 3: what tokens.ts returns, mode by mode, against the cascaded tokens.css. */
export function compareTokensWithChain(css: string, tokens: TokenSet): string[] {
  const modes = cascadeCss(css);
  const problems: string[] = [];
  for (const mode of MODES) {
    const expected = colorsOf(modes[mode]);
    const actual = tokens.colorsByMode[mode] as unknown as Record<string, string>;
    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) problems.push(`tokens ${mode} colors.${key}: missing`);
      else if (normalizeColor(actual[key]) !== normalizeColor(value))
        problems.push(`tokens ${mode} colors.${key}: is ${actual[key]}, css has ${value}`);
    }
    for (const key of Object.keys(actual)) {
      const explained =
        key in expected ||
        key in legacyColorAliases ||
        (colorsWithoutEmberCounterpart as readonly string[]).includes(key);
      if (!explained) problems.push(`tokens ${mode} colors.${key}: no source in tokens.css`);
    }
    for (const [key, target] of Object.entries(legacyColorAliases)) {
      if (actual[key] !== actual[target]) problems.push(`tokens ${mode} colors.${key} is not ${target}`);
    }
  }
  const root = modes.light;
  if (tokens.fontFamily.text !== root['cc-font']) problems.push('tokens fontFamily.text differs');
  if (tokens.fontFamily.round !== root['cc-font-round']) problems.push('tokens fontFamily.round differs');
  const numbers = cssNumbers(root);
  for (const [name, value] of Object.entries(numbers.space)) {
    if (tokens.space[name.slice(1)] !== value) problems.push(`tokens space[${name.slice(1)}] differs`);
  }
  for (const [name, value] of Object.entries(numbers.radius)) {
    if (tokens.radius[name] !== value) problems.push(`tokens radius.${name} differs`);
  }
  for (const [name, value] of Object.entries(numbers.size)) {
    if (tokens.size[name] !== value) problems.push(`tokens size.${name} differs`);
  }
  return problems;
}

const css = readFileSync(CSS_PATH, 'utf8');
const json = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as Json;
const generated = emberTokens as unknown as Generated;
const real: TokenSet = { colorsByMode, space, radius, size, fontFamily };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('link 1: tokens.json equals tokens.css in the four cascaded modes', () => {
  it('every variable of tokens.css is in tokens.json with the same value, in all four modes', () => {
    expect(compareCssWithJson(css, json)).toEqual([]);
  });

  it('the cascade is :root, then .dark, then .hc, then .dark.hc', () => {
    const modes = cascadeCss(css);
    // `.hc` overrides text and leaves what it does not redeclare (the card) at the base value.
    expect(modes.highContrastLight['cc-text']).not.toBe(modes.light['cc-text']);
    expect(modes.highContrastLight['cc-card']).toBe(modes.light['cc-card']);
    // `.dark` alone does not redeclare ember text: it comes from :root, and HC dark inherits `.dark`.
    expect(modes.dark['cc-ember-text']).toBe(modes.light['cc-ember-text']);
    expect(modes.highContrastDark['cc-card']).toBe(modes.dark['cc-card']);
    expect(modes.highContrastDark['cc-text']).not.toBe(modes.dark['cc-text']);
    expect(Object.keys(modes.light).length).toBeGreaterThanOrEqual(63);
  });
});

describe('link 2: emberTokens.generated.ts is what tokens.json gives', () => {
  it('gen-tokens --check accepts the generated module', () => {
    const output = execFileSync('node', [join(ROOT, 'scripts/rn/gen-tokens.mjs'), '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output.trim()).toBe('gen-tokens: OK');
  });

  it('the generated module equals tokens.json value by value', () => {
    expect(compareJsonWithGenerated(json, generated)).toEqual([]);
  });
});

describe('link 3: every group tokens.ts returns equals the chain', () => {
  it('colors, space, radius, size and font equal tokens.css in the four modes', () => {
    expect(compareTokensWithChain(css, real)).toEqual([]);
  });

  it('useTokens-style getTokens returns, for each mode, exactly the colors of that mode', () => {
    const cases: Array<[ColorMode, string, boolean]> = [
      ['light', 'light', false],
      ['dark', 'dark', false],
      ['highContrastLight', 'light', true],
      ['highContrastDark', 'dark', true],
    ];
    const modes = cascadeCss(css);
    for (const [mode, colorScheme, highContrast] of cases) {
      const colors = getTokens({ colorScheme, highContrast }).colors as unknown as Record<string, string>;
      expect(sameColors(`getTokens ${mode}`, colorsOf(modes[mode]), pickKeys(colors, colorsOf(modes[mode])))).toEqual([]);
    }
  });

  it('the three round 3 colors and fillElevated are exposed', () => {
    for (const mode of MODES) {
      for (const key of ['segmentSelected', 'onMedia', 'mediaScrim', 'fillElevated'] as const) {
        expect(colorsByMode[mode][key]).toBe(json.color[mode][key]);
      }
    }
  });

  it('tokens.ts exposes every aliased space, radius and size step through the numbered keys', () => {
    expect([space.xs, space.sm, space.md, space.lg, space.xl, space.xl2, space.xl3, space.xl4, space.xl5]).toEqual([
      space[1], space[2], space[3], space[4], space[5], space[6], space[8], space[10], space[12],
    ]);
    expect(radius.full).toBe(radius.pill);
    expect([size.tapTarget, size.ringHero, size.ringHeroStroke]).toEqual([size.tap, size.ring, size.ringStroke]);
  });

  it('space, radius, size and font do not change with contrast', () => {
    for (const colorScheme of ['light', 'dark']) {
      const normal = getTokens({ colorScheme, highContrast: false });
      const contrast = getTokens({ colorScheme, highContrast: true });
      expect(contrast.space).toBe(normal.space);
      expect(contrast.radius).toBe(normal.radius);
      expect(contrast.size).toBe(normal.size);
      expect(contrast.fontFamily).toBe(normal.fontFamily);
      expect(contrast.typography).toBe(normal.typography);
    }
  });
});

function pickKeys(colors: Record<string, string>, like: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(like).map((key) => [key, colors[key]]));
}

describe('a key that exists today still resolves (names the app used on main)', () => {
  it('colors, in the four modes', () => {
    const earlier = [
      'background', 'surface', 'card', 'border', 'accentLime', 'accentLimePressed', 'accentInk',
      'textPrimary', 'textSecondary', 'textTertiary', 'macroProtein', 'macroCarbs', 'macroFat',
      'macroFiber', 'success', 'warning', 'error', 'info', 'successInk', 'warningInk', 'errorInk',
      'infoInk', 'appleHealth', 'accent', 'accentPressed', 'onAccent', 'accentStrong', 'accentTint',
      'ember', 'emberTrack', 'emberText', 'emberText2', 'emberAccent', 'bg', 'grouped', 'elevated',
      'fill', 'separator', 'text', 'text2', 'text3', 'grabber', 'successTint', 'caution', 'cautionInk',
      'cautionTint', 'errorTint', 'infoTint', 'protein', 'carbs', 'fat', 'fiber',
    ];
    for (const mode of MODES) {
      for (const key of earlier) expect(colorsByMode[mode]).toHaveProperty(key);
    }
  });

  it('space, radius, size, typography and the scaled numbers', () => {
    for (const key of ['1', '2', '3', '4', '5', '6', '8', '10', '12', 'xs', 'sm', 'md', 'lg', 'xl', 'xl2', 'xl3', 'xl4', 'xl5'])
      expect(space).toHaveProperty(key);
    for (const key of ['sm', 'md', 'lg', 'xl', 'pill', 'full', 'button']) expect(radius).toHaveProperty(key);
    for (const key of [
      'tap', 'btn', 'shutter', 'ring', 'ringStroke', 'tapTarget', 'fab', 'ringHero', 'ringCompact',
      'ringGoal', 'ringHeroStroke', 'ringCompactStroke', 'ringGoalStroke', 'macroBarHeight',
    ])
      expect(size).toHaveProperty(key);
    for (const role of ['title', 'heading', 'headline', 'body', 'subhead', 'footnote', 'caption', 'tabLabel'])
      expect(typography).toHaveProperty(role);
    expect(scaledNumberSize).toEqual({ hero: 56, planNumber: 64 });
  });

  it('the legacy lime key holds the Ember accent and the label color is never white', () => {
    expect(colorsByMode.light.accentLime).toBe(colorsByMode.light.accent);
    expect(colorsByMode.light.onAccent).not.toMatch(/^#f{3,6}$/i);
  });
});

describe('what the chain does not hold is one pinned register', () => {
  it('lists exactly the values without a source in tokens.css', () => {
    expect(Object.keys(colorValuesWithoutSource)).toEqual([...colorsWithoutEmberCounterpart]);
    expect(Object.keys(radiusWithoutSource)).toEqual(['button']);
    expect(Object.keys(sizeWithoutSource).sort()).toEqual(
      ['fab', 'macroBarHeight', 'ringCompact', 'ringCompactStroke', 'ringGoal', 'ringGoalStroke'].sort(),
    );
  });

  it('none of those keys exists in the chain', () => {
    for (const key of Object.keys(sizeWithoutSource)) expect(json.size).not.toHaveProperty(key);
    for (const key of Object.keys(radiusWithoutSource)) expect(json.radius).not.toHaveProperty(key);
    for (const key of Object.keys(colorValuesWithoutSource)) expect(json.color.light).not.toHaveProperty(key);
  });
});

describe('one changed value fails at each link', () => {
  it('fails when a light color changes in tokens.css', () => {
    const changed = css.replace('--cc-accent-ink: #B84300', '--cc-accent-ink: #B84301');
    expect(changed).not.toBe(css);
    expect(compareCssWithJson(changed, json).join('\n')).toContain('json light accentInk');
    expect(compareTokensWithChain(changed, real).join('\n')).toContain('tokens light colors.accentInk');
  });

  it('fails when a dark color changes in tokens.css', () => {
    const changed = css.replace('--cc-card: #1C1A18', '--cc-card: #1C1A19');
    expect(changed).not.toBe(css);
    expect(compareCssWithJson(changed, json).join('\n')).toContain('json dark card');
  });

  it('fails when a high contrast color changes in tokens.css, in the .hc and the .dark.hc block', () => {
    const light = css.replace('--cc-text-2: #4A4643', '--cc-text-2: #4A4644');
    expect(light).not.toBe(css);
    expect(compareCssWithJson(light, json).join('\n')).toContain('json highContrastLight text2');
    const dark = css.replace('--cc-text-2: #C8C3BD', '--cc-text-2: #C8C3BE');
    expect(dark).not.toBe(css);
    expect(compareCssWithJson(dark, json).join('\n')).toContain('json highContrastDark text2');
    expect(compareTokensWithChain(dark, real).join('\n')).toContain('tokens highContrastDark colors.text2');
  });

  it('fails when a variable has no key in tokens.json or in tokens.ts', () => {
    const changed = css.replace(/--cc-fiber:\s*#2E8B47;/, '--cc-fiber: #2E8B47; --cc-new-thing: #123456;');
    expect(changed).not.toBe(css);
    expect(compareCssWithJson(changed, json).join('\n')).toContain('newThing: missing');
    expect(compareTokensWithChain(changed, real).join('\n')).toContain('colors.newThing: missing');
  });

  it('fails when a color changes in tokens.json', () => {
    const edited = clone(json);
    edited.color.dark.card = '#1C1A19';
    expect(compareCssWithJson(css, edited).join('\n')).toContain('json dark card');
    expect(compareJsonWithGenerated(edited, generated).join('\n')).toContain('generated dark card');
  });

  it('fails when a space, radius, size or font changes in tokens.json', () => {
    const edited = clone(json);
    edited.space.s4 = 17;
    edited.radius.md = 15;
    edited.size.btn = 55;
    edited.font.text = 'serif';
    const problems = compareCssWithJson(css, edited).join('\n');
    expect(problems).toContain('json space s4');
    expect(problems).toContain('json radius md');
    expect(problems).toContain('json size btn');
    expect(problems).toContain('json font.text');
  });

  it('fails when a value changes in the generated module', () => {
    const edited = clone(generated);
    edited.color.highContrastLight.text = '#000001';
    edited.size.ring = 185;
    const problems = compareJsonWithGenerated(json, edited).join('\n');
    expect(problems).toContain('generated highContrastLight text');
    expect(problems).toContain('generated size ring');
  });

  it('fails when a color changes in tokens.ts', () => {
    const light = { ...colorsByMode.light, accent: '#FF6A01' };
    const edited = { ...real, colorsByMode: { ...colorsByMode, light } };
    expect(compareTokensWithChain(css, edited).join('\n')).toContain('tokens light colors.accent');
    const contrast = { ...colorsByMode.highContrastDark, text: '#FFFFFE' };
    const editedContrast = { ...real, colorsByMode: { ...colorsByMode, highContrastDark: contrast } };
    expect(compareTokensWithChain(css, editedContrast).join('\n')).toContain('tokens highContrastDark colors.text');
  });

  it('fails when a spacing, radius, size or font changes in tokens.ts', () => {
    const edited = {
      ...real,
      space: { ...space, 4: 17 },
      radius: { ...radius, md: 15 },
      size: { ...size, btn: 55 },
      fontFamily: { ...fontFamily, text: 'serif' },
    };
    const problems = compareTokensWithChain(css, edited).join('\n');
    expect(problems).toContain('space[4]');
    expect(problems).toContain('radius.md');
    expect(problems).toContain('size.btn');
    expect(problems).toContain('fontFamily.text');
  });

  it('fails when a legacy alias stops following its Ember key', () => {
    const light = { ...colorsByMode.light, textPrimary: '#000000' };
    const edited = { ...real, colorsByMode: { ...colorsByMode, light } };
    expect(compareTokensWithChain(css, edited).join('\n')).toContain('colors.textPrimary is not text');
  });

  it('fails when tokens.ts holds a color the chain does not know', () => {
    const light = { ...colorsByMode.light, handWritten: '#123456' } as unknown as Colors;
    const edited = { ...real, colorsByMode: { ...colorsByMode, light } };
    expect(compareTokensWithChain(css, edited).join('\n')).toContain('colors.handWritten: no source in tokens.css');
  });

  it('compares alpha values after normalizing (.08 equals 0.08)', () => {
    const changed = css.replace('rgba(20,18,16,.08)', 'rgba(20, 18, 16, 0.080)');
    expect(compareTokensWithChain(changed, real)).toEqual([]);
    const different = css.replace('rgba(20,18,16,.08)', 'rgba(20,18,16,.09)');
    expect(compareTokensWithChain(different, real).join('\n')).toContain('colors.border');
  });
});

describe('the scales the CSS does not hold stay as they were', () => {
  it('typography keeps the system text styles', () => {
    expect(typography.title).toEqual({ fontSize: 34, fontWeight: '600' });
    expect(typography.body).toEqual({ fontSize: 17, fontWeight: '400' });
    expect(typography.tabLabel).toEqual({ fontSize: 11, fontWeight: '500' });
  });

  it('getTokens returns the whole set per scheme, and a bare scheme means normal contrast', () => {
    expect(getTokens('light').colors).toBe(colorsByMode.light);
    expect(getTokens('dark').colors).toBe(colorsByMode.dark);
    expect(getTokens({ colorScheme: 'dark', highContrast: false }).colors).toBe(colorsByMode.dark);
    expect(getTokens('light').isDark).toBe(false);
    expect(getTokens('dark').isDark).toBe(true);
    expect(getTokens('light').highContrast).toBe(false);
    expect(getTokens({ colorScheme: null, highContrast: true }).colors).toBe(colorsByMode.highContrastLight);
    expect(getTokens({ colorScheme: 'unspecified' }).colors).toBe(colorsByMode.light);
    expect(getTokens('light').space).toBe(space);
    expect(getTokens('dark').radius).toBe(radius);
  });

  it('withAlpha applies the SwiftUI .opacity() equivalent', () => {
    expect(withAlpha('#FF6A00', 0.15)).toBe('rgba(255,106,0,0.15)');
    expect(withAlpha('#FFFFFF', 0.2)).toBe('rgba(255,255,255,0.2)');
  });

  it('withAlpha replaces the alpha of an rgba token, written .08 or 0.08', () => {
    expect(withAlpha('rgba(20,18,16,0.08)', 0.5)).toBe('rgba(20,18,16,0.5)');
    expect(withAlpha(colorsByMode.light.border, 0.5)).toBe('rgba(20,18,16,0.5)');
    expect(withAlpha(colorsByMode.light.mediaScrim, 0.9)).toBe('rgba(0,0,0,0.9)');
  });
});

describe('tokens.ts and the components hold no color literal', () => {
  it('tokens.ts has no hex and no rgba(', () => {
    const source = readFileSync(join(__dirname, '../tokens.ts'), 'utf8');
    expect(source).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(source).not.toContain('rgba(');
  });
});
