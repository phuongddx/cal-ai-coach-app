#!/usr/bin/env node
// Owner tool: sets status, evidence, notes and the ember cell of parity rows by id, and inserts
// new rows after a row of the same area.
// Usage: node parity-set.mjs <parity.tsv> '<json: { "PL-06": { status, evidence, notes, ember },
//   ..., "insertAfter": { "DY-07": [[id, area, feature, unit, rnApproach, status, evidence,
//   notes, ember], ...] } }>'
import { readFileSync, writeFileSync } from 'node:fs';

const [file, spec] = process.argv.slice(2);
const { insertAfter = {}, ...updates } = JSON.parse(spec);
const lines = readFileSync(file, 'utf8').split('\n');
const header = lines[0].split('\t');
if (header.length !== 9) {
  console.error(`parity-set: expected 9 columns, found ${header.length}`);
  process.exit(1);
}
const cell = (text) => String(text).replaceAll('\t', ' ');
const seen = new Set();
const ids = new Set(lines.slice(1).map((line) => line.split('\t')[0]));
const out = [lines[0]];
for (let i = 1; i < lines.length; i += 1) {
  const fields = lines[i].split('\t');
  if (fields.length === 1 && fields[0] === '') continue;
  if (fields.length !== 9) {
    console.error(`parity-set: line ${i + 1} has ${fields.length} columns`);
    process.exit(1);
  }
  const update = updates[fields[0]];
  if (update) {
    if (update.status) fields[5] = cell(update.status);
    if (update.evidence) fields[6] = cell(update.evidence);
    if (update.notes) fields[7] = cell(update.notes);
    if (update.ember) fields[8] = cell(update.ember);
    seen.add(fields[0]);
  }
  out.push(fields.join('\t'));
  for (const row of insertAfter[fields[0]] ?? []) {
    if (row.length !== 9) {
      console.error(`parity-set: the row inserted after ${fields[0]} has ${row.length} cells`);
      process.exit(1);
    }
    if (ids.has(row[0])) {
      console.error(`parity-set: duplicate id ${row[0]}`);
      process.exit(1);
    }
    ids.add(row[0]);
    out.push(row.map(cell).join('\t'));
    console.log(`parity-set: inserted ${row[0]} after ${fields[0]}`);
  }
}
const missing = Object.keys(updates).filter((id) => !seen.has(id));
if (missing.length) {
  console.error(`parity-set: no row for ${missing.join(', ')}`);
  process.exit(1);
}
writeFileSync(file, `${out.join('\n')}\n`);
console.log(`parity-set: updated ${seen.size} row(s): ${[...seen].join(', ')}`);
