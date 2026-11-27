#!/usr/bin/env node
// Regenerates apps/mobile/.expo/types/router.d.ts (Expo Router typed routes) without keeping Metro.
//
//   node scripts/rn/gen-typed-routes.mjs
//
// Expo writes the typed-route file when Metro starts. A worktree that never started Metro keeps a
// stale file (or none), so `tsc` either misses route typos or reports them against last month's
// routes, and CI never checked a single route name. `expo export` does not write it (tried). So this
// starts Metro on its own port, waits for the file to change, and stops Metro again. Needs no
// Simulator and no native build. `npm run typecheck` runs it first, locally and in CI.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOBILE = join(ROOT, 'apps', 'mobile');
const TYPED = join(MOBILE, '.expo', 'types', 'router.d.ts');
const TIMEOUT_MS = 120_000;

// One port per worktree so two worktrees can regenerate at the same time; 8081 belongs to the Simulator slot.
const port = 8200 + (parseInt(createHash('sha1').update(MOBILE).digest('hex').slice(0, 4), 16) % 90);

const stamp = () => (existsSync(TYPED) ? `${statSync(TYPED).mtimeMs}:${statSync(TYPED).size}` : 'missing');
const before = stamp();
const started = Date.now();

const metro = spawn('npx', ['expo', 'start', '--dev-client', `--port`, String(port)], {
  cwd: MOBILE,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' },
});
let log = '';
metro.stdout.on('data', (chunk) => { log += chunk; });
metro.stderr.on('data', (chunk) => { log += chunk; });

const stop = () => {
  try { process.kill(-metro.pid, 'SIGTERM'); } catch { metro.kill('SIGTERM'); }
};

let changed = false;
while (Date.now() - started < TIMEOUT_MS) {
  if (metro.exitCode !== null) break;
  if (stamp() !== before) { changed = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
// Metro rewrites the file a moment after the first write; give it two more seconds to settle.
if (changed) await new Promise((resolve) => setTimeout(resolve, 2000));
stop();

if (!changed) {
  console.error(log.split('\n').slice(-25).join('\n'));
  console.error(`gen-typed-routes: ${TYPED} was not rewritten within ${TIMEOUT_MS / 1000} s`);
  process.exit(1);
}

// Each `pathname: ...; params` entry ends with the public path of one static route (`/coach` for
// `coach.tsx` under the (tabs) group, `/sign-in` at the root).
const text = readFileSync(TYPED, 'utf8');
const routes = [...new Set(
  [...text.matchAll(/pathname: ([^;]+);/g)]
    .map((entry) => [...entry[1].matchAll(/`([^`]*)`/g)].map((path) => path[1]).filter((path) => path.startsWith('/')))
    .filter((paths) => paths.length > 0)
    .map((paths) => paths[paths.length - 1]),
)];
console.log(`gen-typed-routes: ${routes.length} static routes (${routes.join(' ')}) in ${Date.now() - started} ms`);
