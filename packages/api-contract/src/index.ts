/**
 * Wire contracts shared by the RN app (`apps/mobile`) and the Hono API (`apps/api`).
 *
 * `contracts/` and `golden/` are relocated from `supabase/functions/_shared/contracts` and
 * `supabase/functions/tests/golden` (the legacy Deno backend). Their bodies are identical apart from
 * the import specifiers. `scripts/rn/parity-check.mjs` diffs the golden copies while both exist.
 */

export * from './contracts/errors';
export * from './contracts/food';
export * from './contracts/lookup';
export * from './contracts/scan';
export * from './contracts/vlm';
export * from './contracts/webhook';
export * from './auth';
export * from './sync';
