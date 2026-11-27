#!/usr/bin/env node
// Owner tool: sets status, evidence and notes of parity rows by id; the ember column stays.
// Usage: node parity-set.mjs <parity.tsv> '<json: { "PL-06": { status, evidence, notes }, ... }>'
import { readFileSync, writeFileSync } from 'node:fs';

const [file, spec] = process.argv.slice(2);
const updates = JSON.parse(spec);
const lines = readFileSync(file, 'utf8').split('\n');
const header = lines[0].split('\t');
if (header.length !== 9) {
  console.error(`parity-set: expected 9 columns, found ${header.length}`);
  process.exit(1);
}
const seen = new Set();
for (let i = 1; i < lines.length; i += 1) {
  const fields = lines[i].split('\t');
  const update = updates[fields[0]];
  if (!update) continue;
  if (fields.length !== 9) {
    console.error(`parity-set: line ${i + 1} has ${fields.length} columns`);
    process.exit(1);
  }
  if (update.status) fields[5] = update.status;
  if (update.evidence) fields[6] = update.evidence;
  if (update.notes) fields[7] = update.notes;
  lines[i] = fields.join('\t');
  seen.add(fields[0]);
}
const missing = Object.keys(updates).filter((id) => !seen.has(id));
if (missing.length) {
  console.error(`parity-set: no row for ${missing.join(', ')}`);
  process.exit(1);
}
writeFileSync(file, lines.join('\n'));
console.log(`parity-set: updated ${seen.size} row(s): ${[...seen].join(', ')}`);
