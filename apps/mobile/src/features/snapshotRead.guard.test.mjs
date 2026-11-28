/**
 * Guard (U-84 B): a file under src/features/** that calls `useSyncExternalStore` must use what it
 * returns. The app compiles with the React Compiler, which memoizes reads of a mutable model; a view
 * that subscribes, throws the result away and reads `model.something()` in render freezes on the first
 * value. Jest does not run the compiler, so the shape is invisible to `npm test`.
 *
 * Run: `npm run test:guard` (Node's own runner, no Jest, no compiler).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FEATURES = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Source files only: tests and the story/fixture helpers do not ship in the bundle. */
function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === '__snapshots__' || name === 'node_modules') continue;
      files.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

/** Comments and string literals blanked out, same length, so offsets and line numbers stay true. */
function blank(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * The calls of `useSyncExternalStore(` whose result is not used. Two shapes count as unused:
 * a bare statement (`useSyncExternalStore(...)`), and a binding that is never read again
 * (`const x = useSyncExternalStore(...)` with no other `x` in the file).
 */
export function unusedResults(source) {
  const text = blank(source);
  const found = [];
  const call = /\buseSyncExternalStore\s*\(/g;
  for (let match = call.exec(text); match !== null; match = call.exec(text)) {
    const before = text.slice(0, match.index);
    const line = before.split('\n').length;
    const prefix = before.trimEnd();
    const last = prefix.slice(-1);
    const word = /([A-Za-z_$][\w$]*)$/.exec(prefix)?.[1];
    if (word === 'return' || prefix.endsWith('=>')) continue;
    if (last === '=' && !prefix.endsWith('==')) {
      const binding = /([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=$/.exec(prefix)?.[1];
      if (binding !== undefined) {
        const reads = text.match(new RegExp(`(?<![\\w$.])${binding.replace('$', '\\$')}(?![\\w$])`, 'g')) ?? [];
        // One occurrence is the declaration itself.
        if (reads.length <= 1) found.push({ line, why: `\`${binding}\` is assigned and never read` });
      }
      continue;
    }
    // An argument, a property value or a ternary branch uses the result.
    if (last === '(' || last === ',' || last === ':' || last === '?') continue;
    found.push({ line, why: 'the result is thrown away (a bare statement)' });
  }
  return found;
}

describe('the detector', () => {
  test('flags a bare statement', () => {
    const source = `import { useSyncExternalStore } from 'react';\nexport function V({ model }) {\n  useSyncExternalStore(model.subscribe, model.getRevision);\n  return model.title();\n}\n`;
    assert.equal(unusedResults(source).length, 1);
  });
  test('flags a binding that is never read', () => {
    const source = `function V({ model }) {\n  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot);\n  return model.title();\n}\n`;
    assert.equal(unusedResults(source).length, 1);
  });
  test('passes a returned result, a read binding and a destructured binding', () => {
    assert.deepEqual(unusedResults(`export function useX(m) {\n  return useSyncExternalStore(m.subscribe, m.getSnapshot);\n}\n`), []);
    assert.deepEqual(unusedResults(`function V() {\n  const snapshot = useSyncExternalStore(a, b);\n  return snapshot.title;\n}\n`), []);
    assert.deepEqual(unusedResults(`function V() {\n  const { a, b } = useSyncExternalStore(x, y);\n  return a + b;\n}\n`), []);
  });
  test('ignores the import and comments', () => {
    const source = `import { useSyncExternalStore } from 'react';\n// useSyncExternalStore(a, b);\n/* useSyncExternalStore(a, b) */\n`;
    assert.deepEqual(unusedResults(source), []);
  });
});

describe('src/features/**', () => {
  const files = sourceFiles(FEATURES);

  test('the scan sees the feature sources', () => {
    assert.ok(files.length > 50, `expected more than 50 source files, found ${files.length}`);
  });

  test('no file calls useSyncExternalStore without using its result', () => {
    const offences = [];
    for (const file of files) {
      for (const { line, why } of unusedResults(readFileSync(file, 'utf8'))) {
        offences.push(`${relative(APP_ROOT, file)}:${line}: ${why}`);
      }
    }
    assert.deepEqual(offences, [], `useSyncExternalStore result unused:\n${offences.join('\n')}`);
  });
});
