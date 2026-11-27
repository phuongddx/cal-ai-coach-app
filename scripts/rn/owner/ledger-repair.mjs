#!/usr/bin/env node
// Owner tool: repairs ledger.tsv and trail.tsv rows that an earlier ledger-append.mjs wrote with an
// empty cell between the timestamp and the unit (the first version mapped the `ts` header too).
// Usage: node ledger-repair.mjs <docs/rn-migration dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
for (const name of ['ledger.tsv', 'trail.tsv']) {
  const file = join(dir, name);
  const width = readFileSync(file, 'utf8').split('\n')[0].split('\t').length;
  const lines = readFileSync(file, 'utf8').split('\n');
  let fixed = 0;
  const bad = [];
  const out = lines.map((line, index) => {
    if (line === '') return line;
    const fields = line.split('\t');
    if (fields.length === width + 1 && fields[1] === '' && fields[2] !== '') {
      fixed += 1;
      fields.splice(1, 1);
      return fields.join('\t');
    }
    if (fields.length !== width) bad.push(index + 1);
    return line;
  });
  writeFileSync(file, out.join('\n'));
  console.log(`${name}: ${width} columns, repaired ${fixed} row(s), rows still off: ${bad.length ? bad.join(',') : 'none'}`);
}
