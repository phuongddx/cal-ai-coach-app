# Parity detail: backend auth, sessions, sync, webhook, deploy (U-21)

Rows BE-04, BE-05, BE-06, BE-07, BE-11 (rest) and BE-12 of `docs/rn-migration/parity.tsv`. Paths are relative to the
repository root; TypeScript under `apps/api/src/`. Jest cases are named `<file> > <case sentence>`. SQL-backed cases run
against PostgreSQL 17 through `TEST_OWNER_URL` and `TEST_API_URL` (`scripts/rn/start-api.sh`) and skip loudly without them.

Two notes. (1) `supabaseUserId` (contract field) becomes `userId` in exactly one place: `toApplyEvent` in
`webhook/route.ts`. (2) Rate limits live in process memory, so they are exact only for a single API instance.

## BE-04 Account deletion, `DELETE /v1/account`

| Behaviour | Source | TS file | Proving test |
|---|---|---|---|
| Own-account deletion purges all six tables, deletes the user last | `delete-account/index.ts` | `auth/routes.ts`, migration `account_delete()` | `auth/deleteAccount.test.ts > handler: own-account deletion purges all six tables then deletes the auth user last` |
| Unauthenticated request is rejected with zero writes | `delete-account/index.ts` | `auth/routes.ts` | `auth/deleteAccount.test.ts > handler: an unauthenticated request is rejected with zero writes` |
| A forged target uid in the body is ignored | `delete-account/index.ts` | `auth/routes.ts` | `auth/deleteAccount.test.ts > handler: a forged target uid in the body is ignored — only the caller is deleted` |
| Apple refresh token revoked after the data is gone | (new, App Store rule) | `auth/providers/apple.ts` | `auth/signIn.test.ts > account deletion revokes the stored Apple refresh token after the data is gone` |
| A failing Apple revoke does not undo the deletion | (new) | `auth/routes.ts` | `auth/signIn.test.ts > account deletion still succeeds when the Apple revoke call fails` |
| Deleted account's sessions stop working | (new) | migration, `auth/session.ts` | `scripts/rn/smoke-auth.sh` last step |

## BE-05 RevenueCat webhook, `POST /webhooks/revenuecat`

33 cases of `webhook/webhook.test.ts` carry the sentences of the old Deno tests one to one (hmac, envelope schema, event mapping,
`apply_webhook_event` semantics through `webhook_apply`, idempotency, ordering). Examples: `hmac: a valid t/v1 signature over the exact raw body verifies`,
`hmac: one altered body byte fails`, `hmac: a timestamp 301 seconds old fails`. Extra: an empty secret answers 401
(`webhook/route.ts`); `auth/authPrivileges.test.ts > apply_webhook_event is not executable by coachcal_api; webhook_apply is`.

## BE-06 Auth

| Behaviour | TS file | Proving test |
|---|---|---|
| Apple: valid token creates user and contract-valid session | `auth/providers/apple.ts`, `auth/routes.ts` | `auth/signIn.test.ts > verifies the identity token, creates the user and returns a contract-valid session` |
| Apple: bad signature, other audience, other issuer, wrong nonce, expired | same | `auth/signIn.test.ts > rejects an identity token with a bad signature` / `...minted for another audience` / `...from another issuer` / `...whose nonce does not match the raw nonce` / `rejects an expired identity token` |
| Apple: refresh token stored encrypted; rejected code creates no user; Apple down is 503 | same | `auth/signIn.test.ts > exchanges the authorization code and stores the Apple refresh token encrypted`; `creates no user when Apple rejects the authorization code`; `answers 503 when Apple cannot be reached` |
| Google: start sets state, nonce, HttpOnly cookie | `auth/providers/google.ts` | `auth/signIn.test.ts > start redirects to Google with state, nonce and an HttpOnly cookie that binds this browser` |
| Google: round trip gives one single-use code; expired code rejected | same | `... a full round trip ends in a one-time code that opens exactly one session`; `... an expired one-time code is rejected` |
| Google: missing cookie, foreign or expired state; bad ID token claims; Google rejection | same | `... a callback without the cookie, with a foreign state or with an expired state redirects with an error`; `... an ID token with the wrong nonce, audience, issuer, signature or expiry is rejected`; `... Google rejecting the code or being unreachable redirects with an error and creates nothing` |
| Unconfigured providers answer 503 naming the variables | `config.ts`, `auth/routes.ts` | `auth/signIn.test.ts > Apple sign-in answers 503 UPSTREAM_ERROR and names the missing variables`; `Google start and callback answer 503 ...` |
| E-mail code: sign-in, case and trim, hash only stored, wrong, unknown, expired, 5 attempts lock, single use, new request replaces, delivery failure 503, malformed 400 | `auth/routes.ts`, migration | the ten `auth/session.test.ts` cases from `a code mailed to an address signs that address in and creates the user` to `malformed bodies answer 400` |
| E-mail and password: right password, uniform 401, never creates a user, salted scrypt | `auth/crypto.ts`, `auth/routes.ts` | `auth/session.test.ts > the right password signs an existing user in` / `a wrong password, an unknown user and a user without a password all answer the same 401` / `never creates a user` / `stores the password as a salted scrypt hash` |
| Sessions: open protected routes; bad, expired, revoked tokens rejected; refresh rotates; reuse revokes the session; only hashes stored; sign out ends one session; dev tokens off by default | `auth/session.ts`, `auth/accessToken.ts`, `middleware.ts` | `auth/session.test.ts > a session opens protected routes until it is signed out` through `dev tokens are rejected unless AUTH_DEV_TOKENS is 1` (11 cases); `auth/accessToken.test.ts` (5 cases) |
| Rate limits: 6th code request, 20-address IP cap, last X-Forwarded-For only, 11th code check, 11th password attempt | `auth/rateLimit.ts` | five cases at the end of `auth/session.test.ts`; `auth/rateLimit.test.ts` (2 cases) |
| Crypto helpers | `auth/crypto.ts` | `auth/crypto.test.ts` (7 cases) |
| End to end with the real API process | `scripts/rn/smoke-auth.sh` | code request, verify, protected call, refresh with rotation, sign out, delete account |

## BE-07 Sync push and pull

| Behaviour | TS file | Proving test |
|---|---|---|
| Upsert applied and returned on pull | `sync.ts`, `sync_push`/`sync_pull` | `app.test.ts > applies an upsert and returns it on pull with the server record` |
| Seen opId is `duplicate` | same | `... answers duplicate for a seen opId and writes nothing new` |
| Older upsert loses but answers applied with the current record; newer after tombstone wins | same | `... does not overwrite with an older upsert but still answers applied with the current record`; `... a newer upsert after a tombstone wins; an older upsert loses` |
| Paging and `hasMore` | same | `... pages pull results and reports hasMore only when more rows exist` |
| Users isolated; cross-user push is 403 | same | `... isolates users: user 2 never sees user 1 rows`; `... denies a push that targets another user's record with 403 and leaves that row unchanged` |
| 400 for unknown key and empty batch; 401 for missing or unknown token; tombstone of unseen record; uniform envelope | same | `... returns 400 VALIDATION_ERROR for an unknown key and for an empty batch`; `... returns 401 UNAUTHORIZED on a missing or unknown token`; `... answers a tombstone for a never-seen record with a deleted record`; `... returns a uniform error envelope for a malformed JSON body` |

Known difference from the spike: `serverVersion` is one global counter per user, not per record (see findings).

## BE-11 Schema and privileges (rest)

Migration `apps/api/migrations/20260920000000_auth_accounts.sql`; tests `auth/authPrivileges.test.ts` (direct SELECT and writes on every auth table fail as
`coachcal_api`; internal helper and `apply_webhook_event` not executable; `account_delete` and the session writers need an authenticated user; `webhook_apply` validates before writing) and
`privileges.test.ts` (scan tables, `migrate(sql)` idempotent on a fresh database).

## BE-12 Deploy kit (not deployed)

Files: `apps/api/Dockerfile`, `apps/api/deploy/docker-compose.yml`, `Caddyfile`, `initdb/01-roles.sh`, `backup.sh`, `apps/api/.env.example`, `docs/rn-migration/deploy-vps.md`.
Proof: run locally with Docker (build, compose up, HTTPS on localhost through Caddy, one-shot migrate, `/health`, e-mail code sign-in, backup, verify, restore over the live database, grants preserved), then everything removed. Not run on a server.
