#!/usr/bin/env node
/*
 * Owner tool: writes one evidence row of phase 4, an RN Simulator screenshot next to its Ember frame.
 *
 *   node scripts/rn/evidence/side-by-side.mjs --unit U-76 \
 *     --frame 07-core-today-light \
 *     --shot docs/rn-migration/evidence/TD-01/today-light.png \
 *     --deviations "none" | "the water card sits 4 pt lower: React Native cannot overlap the safe area"
 *
 * It appends a section to docs/rn-migration/evidence/ember/<unit>.md (a Markdown page with the two
 * images side by side, which GitHub renders) and refuses when the frame or the screenshot is missing
 * or the screenshot is over 700 KB (the evidence rule of scripts/rn/evidence/lib.sh). The unit that
 * took the screenshot commits the page.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FRAMES = 'docs/design/ember/frames';
const EVIDENCE = 'docs/rn-migration/evidence';
const MAX_SHOT_BYTES = 700 * 1024;

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const unit = option('--unit');
const frame = option('--frame');
const shot = option('--shot');
const deviations = option('--deviations');
const out = option('--out') ?? (unit ? `${EVIDENCE}/ember/${unit}.md` : undefined);

const fail = (message) => {
  console.error(`side-by-side: ${message}`);
  process.exit(1);
};
if (!unit || !frame || !shot || deviations === undefined || !out) {
  console.error('usage: node scripts/rn/evidence/side-by-side.mjs --unit <U-xx> --frame <frame file name> --shot <path under docs/rn-migration/evidence> --deviations "<text or none>" [--out <page>]');
  process.exit(2);
}
if (!/^[a-z0-9-]+\.png$/.test(frame)) fail('--frame is a file name such as 07-core-today-light.png');
const framePath = `${FRAMES}/${frame}`;
if (!existsSync(join(ROOT, framePath))) fail(`frame not found: ${framePath}`);
if (!shot.startsWith(`${EVIDENCE}/`) || shot.includes('..')) fail(`--shot must live under ${EVIDENCE}/`);
if (!existsSync(join(ROOT, shot))) fail(`screenshot not found: ${shot}`);
const bytes = statSync(join(ROOT, shot)).size;
if (bytes > MAX_SHOT_BYTES) fail(`screenshot is ${Math.round(bytes / 1024)} KB, over the 700 KB limit of the evidence rule`);

const manifestPath = join(ROOT, FRAMES, 'manifest.json');
const entry = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')).find((item) => item.file === frame)
  : undefined;
const caption = entry?.caption ?? frame.replace(/\.png$/, '');
const title = entry?.section ? `${entry.section}: ${caption}` : caption;

// Paths in the page are relative to the page: up from its folder to the repository root.
const esc = (text) => text.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
const depth = out.split('/').length - 1;
const toRoot = '../'.repeat(depth);
const page = join(ROOT, out);
const header = existsSync(page) ? '' : `# Ember evidence of ${unit}\n\nEvery row puts the Ember frame next to the React Native screen on the iOS 26.4 Simulator.\n`;
const section = `
## ${esc(title)}

| Ember frame | RN on the Simulator |
|---|---|
| <img src="${toRoot}${framePath}" alt="Ember frame: ${esc(caption)}" width="390"> | <img src="${toRoot}${shot}" alt="RN screenshot: ${esc(caption)}" width="390"> |

Frame: \`${framePath}\`. Screenshot: \`${shot}\`.
Deviations from the frame: ${deviations === 'none' ? 'none observed by the unit that took the screenshot' : esc(deviations)}.
`;
mkdirSync(dirname(page), { recursive: true });
appendFileSync(page, `${header}${section}`);
console.log(`side-by-side: appended "${caption}" to ${out}`);
