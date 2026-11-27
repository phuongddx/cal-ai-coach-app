/**
 * The migration-bundle guard: editing src/data/db/schema.ts without
 * regenerating must fail this test (the brief's acceptance). It runs
 * `node scripts/rn/gen-migrations.mjs --check` — the same gate CI can run —
 * which regenerates into a temporary directory and exits 1 on any drift.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

jest.setTimeout(120_000);

describe('generated migrations', () => {
  it('the bundled migrations match the schema (regenerate when they drift)', () => {
    // <repo>/apps/mobile/src/data/db → <repo>
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
    expect(execFileSync('node', [join(repoRoot, 'scripts', 'rn', 'gen-migrations.mjs'), '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })).toContain('--check OK');
  });
});
