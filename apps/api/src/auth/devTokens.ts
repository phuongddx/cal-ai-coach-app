/**
 * Dev-only bearer tokens: fixed user ids from the checked-in `apps/api/dev-tokens.json`.
 * `requireUser` accepts them only when AUTH_DEV_TOKENS=1; production never sets it.
 */
import fs from 'node:fs';
import path from 'node:path';

export type TokenMap = Record<string, string>;

export function loadDevTokens(filePath?: string): TokenMap {
  const resolved =
    filePath ??
    process.env.DEV_TOKENS_FILE ??
    // apps/api/src/auth/devTokens.ts -> apps/api/dev-tokens.json
    path.resolve(__dirname, '../../dev-tokens.json');
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as TokenMap;
}
