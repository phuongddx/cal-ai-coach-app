#!/usr/bin/env node
// Owner tool: appends the rows of one drain to ledger.tsv and trail.tsv on rn/orchestrate.
// Usage: node ledger-append.mjs <docs/rn-migration dir> <drain id> [<json dir>]
// Reads ledger-<drain>.json and trail-<drain>.json; a missing file means no rows of that kind.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const drain = process.argv[3] ?? 'drain';
const jsonDir = process.argv[4] ?? new URL('.', import.meta.url).pathname;
const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const cell = (text) => String(text).replaceAll('\t', ' ').replaceAll('\n', ' ');
const rows = (kind) => {
  const file = join(jsonDir, `${kind}-${drain}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
};

const ledger = rows('ledger');
const trail = rows('trail');

const ledgerHeader = readFileSync(join(dir, 'ledger.tsv'), 'utf8').split('\n')[0].split('\t');
const trailHeader = readFileSync(join(dir, 'trail.tsv'), 'utf8').split('\n')[0].split('\t');

const ledgerLines = ledger.map((row) => {
  const fields = Array.isArray(row) ? row : ledgerHeader.map((h) => row[h] ?? '');
  if (fields.length !== ledgerHeader.length) throw new Error(`ledger row has ${fields.length} cells, header ${ledgerHeader.length}`);
  return [ts, ...fields].map(cell).join('\t');
});
const trailLines = trail.map((row) => {
  const fields = Array.isArray(row) ? row : trailHeader.map((h) => row[h] ?? '');
  if (fields.length !== trailHeader.length) throw new Error(`trail row has ${fields.length} cells, header ${trailHeader.length}`);
  return [ts, ...fields].map(cell).join('\t');
});
appendFileSync(join(dir, 'ledger.tsv'), `${ledgerLines.join('\n')}\n`);
appendFileSync(join(dir, 'trail.tsv'), `${trailLines.join('\n')}\n`);
console.log(`ledger ${ledgerLines.length} row(s), trail ${trailLines.length} row(s); headers: ${ledgerHeader.join(',')} | ${trailHeader.join(',')}`);
