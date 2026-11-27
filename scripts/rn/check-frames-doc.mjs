#!/usr/bin/env node
/*
 * Checks docs/design/ember/FRAMES.md against docs/design/ember/frames/manifest.json:
 *
 *   node scripts/rn/check-frames-doc.mjs [path-to-FRAMES.md]
 *
 * Exits 1 when a file of the manifest is not cited in the document, or when the document cites a
 * `NN-name.png` file the manifest does not hold (a stale name from before a renumbering). The
 * optional argument points at another FRAMES.md copy, so the check can run on a copy. On success
 * it prints one line: `frames-doc: OK, 107 frames`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = path.join(root, 'docs', 'design', 'ember', 'frames', 'manifest.json');
const docPath = path.resolve(process.argv[2] || path.join(root, 'docs', 'design', 'ember', 'FRAMES.md'));

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`frames-doc: cannot read ${manifestPath}: ${error.message}`);
  process.exit(1);
}
let doc;
try {
  doc = fs.readFileSync(docPath, 'utf8');
} catch (error) {
  console.error(`frames-doc: cannot read ${docPath}: ${error.message}`);
  process.exit(1);
}

const problems = [];

for (const entry of manifest) {
  if (!doc.includes(entry.file)) {
    problems.push(`not cited in the document: ${entry.file} ("${entry.caption}")`);
  }
}

const cited = doc.match(/\b\d{2}-[a-z0-9][a-z0-9-]*\.png\b/g) || [];
const known = new Set(manifest.map((entry) => entry.file));
const seen = new Set();
for (const name of cited) {
  if (known.has(name) || seen.has(name)) continue;
  seen.add(name);
  problems.push(`stale file name not in the manifest: ${name}`);
}

if (problems.length > 0) {
  console.error(`frames-doc: FAIL, ${manifest.length} frames in the manifest, ${problems.length} problem(s) in ${path.relative(root, docPath)}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`frames-doc: OK, ${manifest.length} frames`);
