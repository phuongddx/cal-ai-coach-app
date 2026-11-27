#!/usr/bin/env node
// Parity gate for the React Native migration.
//
//   node scripts/rn/parity-check.mjs          check, exit 1 on any violation
//   node scripts/rn/parity-check.mjs --write  also regenerate docs/rn-migration/parity.md
//
// Checks:
//   1. docs/rn-migration/parity.tsv is well formed: unique ids, known status, a unit for every row,
//      evidence that exists for every done or partial row, a reason for every partial, not-done or n/a row.
//   2. Every file in docs/rn-migration/swift-inventory.tsv maps to a parity row that exists, and, while
//      native/ still exists, every file under native/ is inventoried.
//   3. packages/api-contract/golden and supabase/functions/tests/golden hold the same bytes while both exist.
//   4. No Supabase client, URL or env name in the code of apps/ and packages/.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = join(ROOT, 'docs', 'rn-migration');
const PARITY_TSV = join(DOCS, 'parity.tsv');
const INVENTORY_TSV = join(DOCS, 'swift-inventory.tsv');
const PARITY_MD = join(DOCS, 'parity.md');
const STATUSES = new Set(['todo', 'doing', 'done', 'partial', 'not-done', 'n/a']);
const ID_PATTERN = /^[A-Z]{2}-\d{2}$/;
const write = process.argv.includes('--write');

function readTsv(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.length > 0);
  const header = lines[0].split('\t');
  return { header, rows: lines.slice(1).map((line, index) => ({ line: index + 2, fields: line.split('\t') })) };
}

const problems = [];
const fail = (message) => problems.push(message);

// 1. parity.tsv
const parity = readTsv(PARITY_TSV);
const expectedHeader = ['id', 'area', 'feature', 'unit', 'rn_approach', 'status', 'evidence', 'notes', 'ember'];
if (parity.header.join() !== expectedHeader.join()) {
  fail(`parity.tsv header is ${parity.header.join()}, expected ${expectedHeader.join()}`);
}
const rows = parity.rows.map(({ line, fields }) => {
  const [id, area, feature, unit, rnApproach, status, evidence, notes, ember] = fields;
  if (fields.length !== expectedHeader.length) fail(`parity.tsv line ${line}: ${fields.length} fields, expected ${expectedHeader.length}`);
  return { line, id, area, feature, unit, rnApproach, status, evidence, notes, ember };
});
const SCREEN_AREAS = new Set(['scan', 'today', 'diary', 'progress', 'coach', 'profile', 'onboarding']);
const seen = new Set();
for (const row of rows) {
  const where = `parity.tsv line ${row.line} (${row.id})`;
  if (!ID_PATTERN.test(row.id)) fail(`${where}: id must look like XX-00`);
  if (seen.has(row.id)) fail(`${where}: duplicate id`);
  seen.add(row.id);
  if (!STATUSES.has(row.status)) fail(`${where}: unknown status "${row.status}"`);
  if (!row.unit) fail(`${where}: no unit`);
  if (!row.rnApproach) fail(`${where}: no RN approach`);
  if (row.status === 'done' || row.status === 'partial') {
    if (!row.evidence) fail(`${where}: ${row.status} without evidence`);
    for (const path of row.evidence.split(';').map((p) => p.trim()).filter(Boolean)) {
      if (path.startsWith('native/')) fail(`${where}: evidence under native/ disappears with the cleanup: ${path}`);
      else if (!existsSync(join(ROOT, path))) fail(`${where}: evidence path does not exist: ${path}`);
    }
  }
  if ((row.status === 'partial' || row.status === 'not-done' || row.status === 'n/a') && !row.notes) {
    fail(`${where}: ${row.status} needs the reason or the gap in notes`);
  }
  if (row.status === 'n/a' && !row.evidence) fail(`${where}: n/a needs evidence that the old app has no such feature`);
  // Every screen names the Ember frame it follows (docs/design/ember), or says that it is derived from the tokens.
  if (!row.ember) fail(`${where}: no Ember frame (a frame name, "derived", or "-" for a row without a screen)`);
  if (SCREEN_AREAS.has(row.area) && row.ember === '-') fail(`${where}: a ${row.area} row names no Ember frame`);
}

// 2. inventory coverage
if (!existsSync(INVENTORY_TSV)) {
  fail('swift-inventory.tsv is missing');
} else {
  const inventory = readTsv(INVENTORY_TSV);
  if (inventory.header.join() !== 'path,kind,loc,parity') fail(`swift-inventory.tsv header is ${inventory.header.join()}`);
  const inventoried = new Set();
  for (const { line, fields } of inventory.rows) {
    const [path, kind, loc, parityIds] = fields;
    inventoried.add(path);
    if (!['source', 'test', 'snapshot', 'resource', 'tooling'].includes(kind)) fail(`swift-inventory.tsv line ${line}: unknown kind "${kind}"`);
    if (!parityIds) { fail(`swift-inventory.tsv line ${line}: ${path} maps to no parity row`); continue; }
    for (const id of parityIds.split(',')) {
      if (!seen.has(id)) fail(`swift-inventory.tsv line ${line}: ${path} maps to ${id}, which is not a parity row`);
    }
    if (kind === 'source' && !Number.isInteger(Number(loc))) fail(`swift-inventory.tsv line ${line}: ${path} has no line count`);
  }
  const nativeDir = join(ROOT, 'native');
  if (existsSync(nativeDir)) {
    const listed = execFileSync('find', ['native', '-type', 'f', '-not', '-path', 'native/Derived/*', '-not', '-path', '*.xcassets/*', '-not', '-path', '*/.*'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter((p) => p.startsWith('native/'));
    for (const path of listed) if (!inventoried.has(path)) fail(`native file not inventoried: ${path}`);
    for (const path of inventoried) if (!existsSync(join(ROOT, path))) fail(`inventoried file no longer exists: ${path}`);
  }
}

// 3. golden drift
const goldenDirs = [join(ROOT, 'packages', 'api-contract', 'golden'), join(ROOT, 'supabase', 'functions', 'tests', 'golden')].filter(existsSync);
if (goldenDirs.length === 2) {
  const names = (dir) => readdirSync(dir).filter((f) => f.endsWith('.golden.json')).sort();
  const [a, b] = goldenDirs;
  const [na, nb] = [names(a), names(b)];
  if (na.join() !== nb.join()) fail(`golden fixture sets differ: ${na.join()} vs ${nb.join()}`);
  for (const name of na.filter((n) => nb.includes(n))) {
    if (!readFileSync(join(a, name)).equals(readFileSync(join(b, name)))) fail(`golden fixture differs: ${name}`);
  }
}

// 4. no Supabase in the new code
const sourcePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const skipDirs = new Set(['node_modules', 'ios', 'android', 'build-output', 'dist', '.expo']);
const supabasePattern = /@supabase\/|from\s+['"]supabase['"]|supabase\.co|SUPABASE_|supabaseUrl|supabaseKey/i;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!sourcePattern.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    if (supabasePattern.test(text)) fail(`Supabase reference in the new code: ${relative(ROOT, full)}`);
  }
}
for (const dir of [join(ROOT, 'apps'), join(ROOT, 'packages')]) if (existsSync(dir)) walk(dir);

// parity.md view
const swiftFilesByParity = new Map();
if (existsSync(INVENTORY_TSV)) {
  for (const { fields } of readTsv(INVENTORY_TSV).rows) {
    for (const id of (fields[3] || '').split(',')) {
      if (!swiftFilesByParity.has(id)) swiftFilesByParity.set(id, []);
      swiftFilesByParity.get(id).push(fields[0]);
    }
  }
}
const counts = {};
for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
const esc = (text) => (text || '').replace(/\|/g, '\\|');
const md = [
  '# Parity table: SwiftUI app to React Native, screens on the Ember design',
  '',
  'Generated by `node scripts/rn/parity-check.mjs --write` from `parity.tsv` and `swift-inventory.tsv`. Edit the TSV, not this file.',
  '',
  `Rows: ${rows.length}. Status: ${Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(', ')}.`,
  '',
  'Status meanings: `todo` not started, `doing` a unit has it open, `partial` runs with a gap named in Notes, `done` parity reached with the evidence listed, `not-done` not reached, reason and proposal in Notes, `n/a` the old app has no such feature (evidence listed).',
  '',
  '| ID | Area | Feature | Unit | Status | RN approach | Evidence | Notes | Swift files | Ember frame |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((row) => `| ${row.id} | ${esc(row.area)} | ${esc(row.feature)} | ${esc(row.unit)} | ${row.status} | ${esc(row.rnApproach)} | ${esc(row.evidence)} | ${esc(row.notes)} | ${esc((swiftFilesByParity.get(row.id) || []).map((p) => p.replace(/^.*\//, '')).join('<br>'))} | ${esc(row.ember)} |`),
  '',
];
if (write) writeFileSync(PARITY_MD, md.join('\n'));

for (const problem of problems) console.error(`parity-check: ${problem}`);
console.log(`parity-check: ${rows.length} rows, ${Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(', ')}, ${problems.length} problem(s)${write ? ', parity.md written' : ''}`);
process.exit(problems.length > 0 ? 1 : 0);
