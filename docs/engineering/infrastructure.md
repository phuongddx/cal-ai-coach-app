# Infrastructure

## CI — GitHub Actions

`.github/workflows/ci.yml` (single `build-and-test` job):

- Runner `macos-26`, Xcode 26.6, installs Tuist via brew if absent.
- `cd native && tuist install && tuist generate --no-open`.
- Module loop: `swift test` in every `Modules/*` except `CoachCalDesignSystem`
  (iOS-only).
- App tests: `tuist test CoachCal --no-selective-testing -- -destination
  "$destination" CODE_SIGNING_ALLOWED=NO`, with inline `-skip-testing:` lists
  for live-Supabase proofs, snapshot suites, and `AccessibilityAuditTests`.
- No Deno/Supabase steps — edge-function tests are local-only.

## Xcode Cloud

`ci_scripts/ci_post_clone.sh`: same Tuist install/generate + module loop;
honors `CI_DESTINATION`, falls back to first available iPhone simulator, then
`iPhone 16,OS=26.5`; runs `tuist test CoachCal --no-selective-testing`.

## Local Supabase stack

- `supabase/config.toml`: project `cal-ai-coach-app`, Postgres major 17, API
  `http://127.0.0.1:54321`, DB port `54322`, edge runtime Deno 2.
  `[functions.rc-webhook] verify_jwt=false`.
- Serve functions: `supabase functions serve --env-file supabase/functions/.env`.
- Hosted secrets: `supabase secrets set NAME=value`.
- Edge tests: `cd supabase/functions && deno task test` (sequential;
  local-stack env required).

## Signing & env injection

- Manual signing, team `K2TYLYAWMK`, profiles `CoachCal AppStore` /
  `CoachCal Widget AppStore`; App Group `group.com.nextlabs.coachcal`.
- Build-time injection via `COACHCAL_*` build settings → Info.plist:
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`, `POSTHOG_API_KEY`
  (`native/Project.swift`).
- Test credentials (`TEST_EMAIL`, `TEST_PASSWORD`, `SUPABASE_ANON_KEY`) reach
  tests via the scheme's Test-action env vars; suites skip when unset.

## Release helpers

- `native/scripts/check-artifact-compliance.sh [IPA]` — privacy manifest,
  camera string, HealthKit entitlement checks.
- `native/scripts/scan-ipa-secrets.sh [IPA]` — secret-shape scanning.
- Neither is wired into CI or the Xcode Cloud hook.

## Not configured

- Lint/format tooling (no SwiftLint, swift-format, ESLint, Prettier,
  `.editorconfig`, or pre-commit).
- Hosted-Supabase deploy runbook.
