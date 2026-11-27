# Parity detail: networking and auth client (U-20)

Rows NW-01, NW-02, NW-03, NW-04, AU-01 of `docs/rn-migration/parity.tsv`. Paths are relative to the repository
root; TypeScript files are under `apps/mobile/src/`, Swift sources under
`native/Modules/CoachCalNetworking/Sources/CoachCalNetworking/` unless a full path is given. Jest cases are
named `<file> > <case sentence>`; the sentences of the Swift tests are kept (lower-cased, spaces for camel case).

The sync twin is named `syncTransport.test.ts` (the Swift file is the RPC-based sync transport test; its name
is not repeated here on purpose).

## NW-01 Scan API client

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| One request function: base URL from `EXPO_PUBLIC_API_URL` (default `http://127.0.0.1:8787`), JSON, bearer, contract parsing | (new: replaces the platform client) | `data/api/http.ts` | `data/api/http.test.ts > reads the base URL from EXPO_PUBLIC_API_URL and defaults to the local API`; `> sends JSON with the bearer token and returns the parsed body` |
| A 2xx body that fails the contract is an invalid response (invariant I10) | `LiveApiClient.swift` | `data/api/http.ts` | `http.test.ts > treats a 2xx body that fails the contract as an invalid response` |
| Error envelope becomes a typed failure | `CoachCalAPI.swift` (`ScanAPIError`) | `data/api/http.ts`, `scanClient.ts` | `http.test.ts > turns the error envelope into a typed failure` |
| 401 refreshes once and retries once | (new) | `data/api/http.ts` | `http.test.ts > refreshes once on 401 and retries once with the new token`; `> does not retry a second time when the retried call is also 401` |
| `CoachCalAPI` seam, `LiveScanApi` over `POST /v1/scan`, decodes what the fixture client decodes | `CoachCalAPI.swift`, `LiveApiClient.swift` | `data/api/scanClient.ts` | `data/api/scanClient.test.ts > decodes the same scan response fixture api client decodes` (LiveApiClientTests) |
| Quota envelope maps to `isQuotaReached` | `ScanAPIError.isQuotaReached` | `scanClient.ts` | `scanClient.test.ts > free limit reached envelope maps to quota scan api error` |
| Barcode not found maps to `isBarcodeNotFound` | `ScanAPIError.isBarcodeNotFound` | `scanClient.ts` | `scanClient.test.ts > barcode not found envelope maps to typed scan api error` |
| VLM schema error maps to `isSchemaError` | `ScanAPIError.isSchemaError` | `scanClient.ts` | `scanClient.test.ts > vlm schema error envelope maps to typed scan api error` |
| Tier inferred from duration: tier 1, or tier 2 after 5 s, reported to a callback | `LiveApiClient.swift` | `scanClient.ts` | `scanClient.test.ts > fast response reports tier 1 telemetry without escalation`; `> slow response over five seconds reports tier 2 telemetry as escalated` |
| Wire keys `textDescription` and `imageBase64`; fresh scan id per request | `CoachCalAPI.swift` (`ScanRequest`) | `scanClient.ts` | `scanClient.test.ts > sends the wire keys text description and image base64`; `> builds a fresh uuid v4 scan id for every request` |
| Invariant I10: a 200 with an unknown key (top level or inside an item) is rejected | `FixtureModels.swift` strict decoding | `scanClient.ts` | `scanClient.test.ts > rejects a 200 scan response that carries an unknown key (invariant I10)`; `> rejects a 200 scan response whose item carries an unknown key` |
| Invariant I6: the client returns per-item `per100g` and `grams` untouched (the recompute belongs to the scan feature) | `ScanModel.swift` (read only) | `scanClient.ts` | `scanClient.test.ts > returns per-item per100g and grams untouched so the review sheet can recompute kcal (invariant I6)` |
| Fixture client over the golden files, scenario from the `--ccScanScenario` argument | `FixtureApiClient.swift`, `FixtureModels.swift` | `testing/fixtureScanApi.ts`, `testing/fixtures/` | `testing/fixtureScanApi.test.ts` (FixtureScenarioTests: 200, unresolved 200, 402, 404, 422, unknown-key mutations, scenario from launch arguments) |
| Golden decoding of the sync fixtures (new Meal-record shape) | `GoldenFixtureTests.swift` | `testing/syncGolden.ts`, `testing/fixtures/sync_*.golden.json` | `data/api/goldenFixtures.test.ts` (4 cases) |
| Module smoke | `CoachCalNetworkingTests.swift` | `data/api/index.ts` | `data/api/networkingModule.test.ts > module name is exposed` |

## NW-02 Sync transport

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Push calls `POST /v1/sync/push` and returns strictly decoded acknowledgements | RPC sync transport | `data/api/syncClient.ts` | `data/api/syncTransport.test.ts > push calls sync push and returns strict decoded acknowledgements` |
| Pull calls `POST /v1/sync/pull` and returns strictly decoded rows | same | `syncClient.ts` | `syncTransport.test.ts > pull calls sync pull and returns strict decoded rows` |
| A failing call is a typed sync error | same | `syncClient.ts` | `syncTransport.test.ts > rpc failure surfaces as sync transport error`; `> maps a dropped connection, a 5xx and a 401 to the kinds the engine retries or stops on` |
| The acknowledgement set is validated against the request after a push | same (`validateAcknowledgementSet`) | `syncClient.ts` | `syncTransport.test.ts > push rejects an acknowledgement set that does not match the request` |
| Strict decoding (I10) | same | `syncClient.ts` | `syncTransport.test.ts > push rejects a response with an unknown key as a server fault (invariant I10)`; `> a locally corrupt operation fails before any network call` |
| Bearer token from an injected provider; 401 = one refresh + one retry | (new) | `syncClient.ts` | `syncTransport.test.ts > a 401 triggers one refresh and one retry with the new token`; `> a 401 that survives the retry is unauthorized and does not refresh again`; `> without a session the transport is unauthorized and sends nothing` |
| Default provider keeps the spike dev token, so `src/data/sync/runtime.ts` and `binding.ts` are unchanged | (spike) | `syncClient.ts` | `syncTransport.test.ts > the default provider keeps the spike dev token so the runtime wiring is unchanged` |
| 401 refresh and failed refresh over the real session store | (new) | `data/auth/sessionStore.ts` + `syncClient.ts` | `data/auth/sessionRefresh.test.ts > a 401 on sync triggers one refresh and one retry`; `> a failed refresh clears the session and the sync call ends unauthorized`; `> a refresh that cannot reach the server keeps the session for the next attempt` |

## NW-03 Auth session and sign-in calls

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| Session (user and tokens) in secure storage; restore at start | `AuthSessionStore.swift` | `data/auth/sessionStore.ts` | `data/auth/sessionStore.test.ts > sign in persists and a second store restores the session`; `> a stored session that fails the contract is discarded` |
| Sign out clears the stored session | `AuthSessionStore.swift` | `sessionStore.ts`, `authServices.ts` | `sessionStore.test.ts > sign out clears the keychain for a second store`; `data/auth/authServices.test.ts > sign out tells the server and clears the device` |
| Listeners on change | `AuthSessionStore.swift` | `sessionStore.ts` | `sessionStore.test.ts > notifies listeners on sign in and sign out until they unsubscribe` |
| Access token refreshes when expired (30 s early); refresh is single-flight because the refresh token rotates | (new) | `sessionStore.ts` | `sessionStore.test.ts > get access token refreshes when the token is expired and keeps the rotated pair`; `> refreshes slightly early so a token never expires in flight`; `> concurrent refreshes share one request because the refresh token rotates` |
| A refresh the server rejects clears the session; a network or 5xx failure keeps it | (new) | `sessionStore.ts`, `data/auth/types.ts` (`isRejection`) | `sessionStore.test.ts > a failed refresh clears the session when the server rejects the refresh token`; `> a failed refresh keeps the session when the network or the server is down` |
| Apple: identity token, authorization code, first sign-in name; hashed nonce to Apple, raw nonce to the server | `AuthSessionStore.swift`, `AppleNonceProvider.swift` | `data/auth/appleSignIn.ts`, `authApi.ts`, `appleNonce.ts` | `data/auth/appleSignIn.test.ts` (7 cases); `data/auth/authApi.test.ts > apple sign in posts the identity token, the raw nonce and the first sign in name`; `data/auth/appleNonce.test.ts > hashes the raw nonce with sha 256 as lowercase hex` |
| `expo-crypto` is loaded lazily; without it the error is typed and there is no Apple button | `AppleNonceProvider.swift` | `appleNonce.ts` | `appleNonce.test.ts > loads expo crypto lazily and not at import time`; `> a build without expo crypto yields a typed error and no apple button` |
| Google: browser session on `/v1/auth/google/start`, one-time code from `coachcal://auth/google?code=`, `POST /v1/auth/google/exchange` | `AuthSessionStore.swift` | `authApi.ts` | `authApi.test.ts > google sign in opens the start endpoint, reads the one time code from the redirect and exchanges it`; `> google sign in that the person closes is cancelled and exchanges nothing` |
| E-mail one-time code (request, verify) and e-mail with password | `AuthSessionStore.swift` | `authApi.ts` | `authApi.test.ts > request code posts the e-mail and resolves without a session`; `> verify code posts the six digits and returns the session`; `> e-mail sign in posts the credentials of an existing user` |
| Refresh and sign-out calls | `AuthSessionStore.swift` | `authApi.ts` | `authApi.test.ts > refresh posts the refresh token and returns the rotated session`; `> sign out posts to the sign out endpoint with the access token` |
| Typed errors, strict session body | `AuthSessionError` | `data/auth/types.ts` | `authApi.test.ts > a wrong credential is an envelope error with its status and code`; `> a session body with an unknown key is an invalid response (invariant I10)`; `> input that fails the contract never reaches the network` |
| Every sign-in stores the session | `AppEnvironment.handleSignIn` (read only) | `data/auth/authServices.ts`, `data/auth/index.ts` | `data/auth/authServices.test.ts` (verify code, google, apple store the session; a failed sign-in leaves none) |

Not ported (need live credentials, listed in the header of `sessionStore.test.ts`): `AuthSessionTests`
`liveSignInPersistsAndSecondClientRestoresSession` (covered with the mocked storage),
`signOutClearsKeychainForSecondClient` (covered with the mocked storage), `liveSignInThenSyncEngineBindsAndDispatches`
(needs a live API: not covered).

## NW-04 Account deletion

| Behaviour | Swift source | TS file | Proving Jest case |
|---|---|---|---|
| `DELETE /v1/account` with the session bearer | `AccountDeletionTransport.swift` | `data/api/accountClient.ts` | `data/api/accountClient.test.ts > delete account sends DELETE to the account endpoint with the session bearer` |
| 401 refreshes once and retries once | (new) | `accountClient.ts` | `accountClient.test.ts > a 401 refreshes the session once and retries once` |
| Typed `AccountError` (http, envelope, network, invalid response) | `AccountDeletionTransport.swift` | `accountClient.ts` | `accountClient.test.ts > an http failure carries the status`; `> an envelope failure carries its code`; `> a dropped connection is a network failure`; `> a 200 that is not the ok body is an invalid response` |

The local data wipe after a successful deletion is part of the profile and account-reset flow (`AppEnvironment`),
not of this unit.

## AU-01 Sign-in screen

Screen: `features/auth/SignInScreen.tsx`; route: `app/sign-in.tsx` (`router.replace('/')` on success). Tests:
`features/auth/SignInScreen.test.tsx`.

| Behaviour | Swift source | Proving Jest case |
|---|---|---|
| Entry points reachable: title "Sign in to keep your diary safe", `auth.signInApple`, `auth.signInGoogle` "Continue with Google", `auth.signInEmail` "Continue with email"; one tap later `auth.emailField` "Email" and `auth.sendCode` "Send code" | `SignInView.swift`, `SignInFlowTests.testSignInEntryPointsAreReachable` | `sign in screen > the sign in entry points are reachable` |
| Tapping Apple starts the Apple flow and hands the session on | `SignInFlowTests.testTappingAppleStartsTheAppleFlow` | `sign in screen > tapping Apple starts the Apple sign in and hands the session on` |
| Apple button only when Apple sign in is available (and the nonce can be hashed) | `SignInView.swift` | `sign in screen > the Apple button is not shown when Apple sign in is not available` |
| Google sign-in | `SignInView.swift` | `sign in screen > Continue with Google signs in` |
| Send code disabled while the e-mail is empty | `SignInView.swift` (`.disabled(email.isEmpty)`) | `sign in screen > Send code is disabled while the email is empty` |
| Sending the code reveals `auth.otpField` "6-digit code" and `auth.verifyCode` "Verify" | `SignInView.swift` | `sign in screen > sending the code reveals the code field and Verify` |
| Verify signs in with e-mail and code | `SignInView.swift` | `sign in screen > verifying the code signs in with the e-mail and the code` |
| One error line (send code, wrong code, Apple without credential, Google cancelled); the next attempt clears it | `SignInView.swift` | `sign in screen > shows one error line when sending the code fails ...`; `> shows the error when the code is not accepted ...`; `> shows the error when Apple returns no usable credential`; `> shows the error when Google sign in is cancelled`; `> clears the previous error when a new attempt starts` |
| Busy state disables the form and ignores a second tap | `SignInView.swift` (`.disabled(isBusy)`) | `sign in screen > is busy while a sign in runs: the form is disabled and a second tap does nothing` |
| SHA-256 nonce before the token reaches Apple | `AppleNonceProvider.swift` | `data/auth/appleNonce.test.ts`, `data/auth/appleSignIn.test.ts > sends the hashed nonce to apple and the raw nonce to the server` |

Ember look (U-77b, frames 61 to 67): two steps of one route. Entry: tile, title, subtitle, privacy line, Apple, Google,
"or", Continue with email. E-mail step (behind `auth.signInEmail`): header with Back (`auth.emailBack`), title "Sign in with
email", labeled fields, one sentence after the code is sent (`auth.codeSent`), docked Send code / Verify, one error line.

| Identifier | Status |
|---|---|
| `auth.signInEmail` | added: "Continue with email" on the entry step; the e-mail flow starts with a tap on it |
| `auth.emailBack` | added: Back on the e-mail step, keeps the typed e-mail |
| `auth.codeSent` | added: "We sent a code to <e-mail>." |
| `auth.tile` | added: the app tile of the entry step |
| `auth.emailField.label`, `auth.otpField.label` | added by `FillField` |
| `auth.form`, `auth.signInApple`, `auth.signInGoogle`, `auth.emailField`, `auth.sendCode`, `auth.otpField`, `auth.verifyCode` | kept |

Differences from the SwiftUI screen: the `auth.*` identifiers sit on wrapper views for the design buttons
(`PrimaryButton` and `SecondaryButton` take no `testID`), so the tests press the button by its label; the
native Apple button carries `auth.signInApple` itself. The Apple cancel gives the line "Sign-in was cancelled."
(Swift showed the system error text). The sign-in/create-account segment, "Forgot password?" and the reset-link screen of
the Ember frames are not built: the app signs in by code. Details: `findings/U-77b.md`.
