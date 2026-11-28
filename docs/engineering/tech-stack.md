# Tech Stack

## Mobile app (`apps/mobile`)

- Expo SDK 58 (`expo ~58.1.0`), React Native 0.88.1, React 19.3.0, Hermes, New Architecture;
  Expo Router for routes; development build with `expo-dev-client` and Continuous Native Generation
  (`ios/` and `android/` are generated and never committed). iOS deployment target 18.0; iOS 26 looks
  come from libraries that check availability. Android is not built (the config keeps the block).
- Local store: `expo-sqlite` + `drizzle-orm 0.45.4` (`drizzle-kit` at the root generates migrations that
  `scripts/rn/gen-migrations.mjs` bundles into `src/data/db/migrations.ts`). Sync outbox written in
  the app (`src/data/sync`). `zustand ^5` and `@tanstack/react-query ^5` are installed; no app code
  imports them yet.
- Native capabilities: `@kingstinct/react-native-healthkit 16.2.0` (HealthKit), `expo-camera`,
  `expo-image-picker`, `expo-image-manipulator`, `expo-apple-authentication`, `expo-web-browser`
  (Google sign-in), `expo-secure-store` (session), `expo-notifications`, `expo-background-task`,
  `expo-widgets` (calories widget), `expo-glass-effect`, `expo-symbols`, `expo-sharing`,
  `expo-file-system`, `@react-native-community/netinfo`, `react-native-reanimated 4.7.1`,
  `react-native-svg 15.16.0`, `@expo/ui`.
- Local Expo module `apps/mobile/modules/coachcal-launch-arguments` (Swift) and the config plugin
  `apps/mobile/plugins/with-coachcal-entitlements.js`.
- Design: Ember tokens (`docs/design/ember/tokens.css` → `emberTokens.generated.ts` → `tokens.ts`).

## Workspace packages

| Package | Depends on |
| --- | --- |
| `@coachcal/core` | — (pure TypeScript; no `react-native`, no `node:`; Jest in Node, Metro in Hermes) |
| `@coachcal/api-contract` | `zod ^4.6.7` |
| `@coachcal/api` | `@coachcal/api-contract`, `@coachcal/core`, `hono ^4.13`, `@hono/node-server`, `@hono/zod-validator`, `jose`, `postgres`, `zod` |
| `@coachcal/mobile` | `@coachcal/api-contract`, `@coachcal/core`, the Expo and React Native packages above |

Root dev tooling: TypeScript `~6.0.3`, Jest `^30.5`, `jest-expo ^58`, `ts-jest`,
`@testing-library/react-native ^14.1`, `sql.js`, `drizzle-kit`. `@electric-sql/pglite` and `tsx` are
dev dependencies of the API. One root `package-lock.json`; `overrides` pin `react` and `react-dom` to
19.3.0.

## Backend (`apps/api`)

- Node 24 LTS (`engines` `>=24`), Hono on `@hono/node-server`, PostgreSQL 17 through the `postgres`
  driver; auth with `jose` (access JWT HS256, 15 minutes; refresh token random, stored hashed and
  rotated). The workspace packages ship TypeScript source, so the image runs it through `tsx`.
- VLM provider seam: Gemini (`apps/api/src/vlm/gemini.ts`) and a deterministic fixture. Grounding:
  USDA FDC, Open Food Facts, FatSecret, cache-first. Mail: Resend or a log sender.
- Deployment: Docker Compose + Caddy (`apps/api/deploy/`), not yet deployed.

## Legacy backend (`supabase/`, not developed further)

- Deno major 2 (Supabase edge runtime). Canonical lockfile is repo-root `deno.lock`;
  `supabase/functions/deno.json` sets `lock:false` — do not create a second lock.
- Key deps (root `deno.lock`): `@supabase/supabase-js` `2.116.0`, `zod` `4.6.5`, `@std/assert`
  `1.0.19`.
- Postgres major 17 via the Supabase CLI.
- `scripts/*.mjs` run on system Node.

## Tooling that is needed only for some work

- Xcode (26.x SDK) for `expo prebuild`, `expo run:ios`, the Simulator and artifact checks; `axe` for
  the evidence harness; Docker for the deploy kit; Deno and the Supabase CLI for the legacy stack.
