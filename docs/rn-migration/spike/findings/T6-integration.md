# T6 — Integration and Simulator runs

Branch `spike/rn-expo`, one native build, iPhone 17 Pro, iOS 26.4 Simulator (UDID `85024D2F-71DE-43C0-8E11-CE58F4578FC3`), bundle id `com.nextlabs.coachcal.rnspike`, local time UTC+7. Run on 2026-11-27. Everything below is **Simulator only**; section 5 lists what only a real device or a real account can show.

## 1. Result per item

| Item | Result | Reason | Evidence |
|---|---|---|---|
| 1. Ember UI (RN) | **pass** (one visual caveat) | Ember renders from the SQLite store, `isOffline` follows the sync engine, sticky week strip clears the status bar, bottom inset clears the tab bar, in dark and light, offline chip visible. Caveat: in light mode the week strip text has weak contrast where it passes over the dark hero card (not fixed, no new feature). | `evidence/item1/` |
| 2. Widget (expo-widgets) | **pass on Simulator, partial overall** | Small and medium widgets render from the real snapshot, follow meal add/edit/delete, survive killing the app, and roll over to the zeroed day through the second timeline entry (`rolloverAt`, 2100 kcal left, 0/130 0/210 0/70 g). Not shown: real WidgetKit refresh budget and a real midnight. | `evidence/item2/` (`rollover-before.png`, `rollover-after-t1.png`, `widget-after-*.png`, `spike-log-excerpt.txt`) |
| 3. HealthKit | **partial** | Authorization sheet appears, save, idempotent retry, read-back and metadata round trip all work; read-back equals the fixture. Deleting the correlation did **not** remove its four samples (fixed, see 3.2). Not shown: real device, read grants, kJ preferred units. | `evidence/item3/` |
| 4. Sync (outbox, LWW, API) | **pass** | All 5 e2e steps ran from the app with an app-driven script: `Done — 0 failed check(s)`. | `evidence/item4/e2e-app-transcript.txt`, `e2e-transcript.txt`, `server-roundtrip.txt` |

### 1.1 Item 4 steps (app-driven, `scripts/e2e-sync-app.sh`)

0. Fresh PostgreSQL + API, empty app. 1. Online: seed A and C, server has both, outbox 0, quarantined 0, cursor 2. 2. Offline (API stopped, force-offline): add B, edit A to 450 kcal, delete C; outbox 3 before the kill and still 3 after kill and relaunch. 3. API back, foreground, force-online, sync: 3 operations pushed, outbox 0. 4. Server side: pull from the old cursor returns 3 rows; a replayed push answers `duplicate` for all 3 and adds no change rows. 5. Second device edits B by curl; the app pulls it (`Protein shake (edited on device 2) | 260 kcal`), outbox stays 0.

### 1.2 Item 3 detail

| Check | Result |
|---|---|
| Authorization sheet appeared | Yes, after the fix in 3.1 (write: Carbohydrates, Dietary Energy, Protein, Total Fat; read section below). `request-1-sheet.png`, `request-2-turned-on.png`, `request-3-after-allow.png` |
| Never-requested guard | `health-save`, `health-read`, `health-delete` all return `unauthorized` before any request (`guard-never-requested.txt`) |
| Health app after save | Nutrition shows Carbohydrates 70 g, Dietary Energy 624 kcal, Protein 38 g, Total Fat 18 g at 12:40 (= 05:40Z, UTC+7) (`health-app-all-data.png`) |
| Idempotency | second `health-save` returns `saved:false` with the same `healthKitUuid` |
| Read-back equals fixture | Yes: 624 kcal, protein 38, carbs 70, fat 18; `unknownUnits: []`. Fiber reads 0 because fiber (4 g in the fixture) is not one of the four saved types |
| Custom metadata round trip | Yes: `ccSpikeMealId` read back equals the value written (`8240a7d7-…`, the id derived from the meal id, not the raw fixture id) |
| Deleting the correlation removes its samples | **No.** Before the fix, `health-delete` returned `deleted:1`, `health-read` returned 0 meals, but after restarting the Health app all four values were still there (`health-app-after-unfixed-delete-orphans.png`) |
| After the fix | `deleted:1, deletedSamples:4`; a new save + delete left no new samples: Carbohydrates TOTAL for the day stayed 70 g, not 140 g (`health-app-after-fixed-delete-carbs-total-70g.png`) |

The four samples from the first, unfixed delete are still in this Simulator's Health store (orphans); they were left as proof and are not part of the final state of the app.

## 2. Commits (on top of 4c72aa9)

| Commit | What |
|---|---|
| 15b2d82 | Wire the console (D5 deep links, cards, sync triggers, widget foreground reload); bind SQLite to Ember and the widget publisher; Ember polish |
| cbb3ef7, ef0a115 | `uuid.ts` + test: real v4 UUIDs (see 3.3) |
| 0762e30 | `scripts/start-api.sh stop` kills only the API listener |
| f99da1f | `scripts/e2e-sync-app.sh`, item 1 and item 4 evidence |
| 8b4e5cb | Widget ring number and ring size |
| b33d704 | Item 2 evidence |
| 3de7b54 | HealthKit guard on the quantity types |
| 95c6304 | HealthKit auth request without the correlation type; delete child samples |
| (this file's commit) | Findings, item 3 evidence, build log tail |

## 3. Integration bugs found and fixed

Fixes to other workers' code are marked.

1. **HealthKit `requestAuthorization` threw** (T4 code, 95c6304). With `HKCorrelationTypeIdentifierFood` in `toShare`/`toRead` the library raised `NSInvalidArgumentException` (`queryFailed: authorization request failed`). Without it the sheet appears at once. Authorization is per quantity type. T4's README predicted a crash; there was none, only this native error.
2. **HealthKit guard false positive** (T4 code, 3de7b54). `authorizationStatusFor(correlationType)` answers `2` (sharingAuthorized) on iOS 26.4 Simulator even before any request, so `isAuthorizedForMeals` passed and the save hit HealthKit unauthorized. The guard now checks the four quantity types. The Jest mock hid this because it returned one status for every type; it now answers `2` for the correlation type like the real store, and there is a test.
3. **Non-UUID sync ids quarantined every operation** (G1's `runtime.ts`/`engine.ts` wiring, cbb3ef7). The API contract uses `z.uuid()`; Hermes has no `crypto.randomUUID`, so the fallback id was rejected by the server and ops were quarantined. `uuid.ts` builds a real v4 from `getRandomValues` or `Math.random`; the test parses ids with the contract schema.
4. **Deleting a correlation left its samples** (T4 code, 95c6304). `deleteMealFromHealth` now queries the correlation by metadata, deletes the correlation, then deletes the child samples by uuid per quantity type; the result is `{ deleted, deletedSamples }`. The mock models orphans.
5. **`start-api.sh stop` killed the app** (T3 code, 0762e30). `lsof -ti :8787` also matched the app's client sockets; now `-sTCP:LISTEN`.
6. **Widget ring** (T2 code, 8b4e5cb). `Gauge` with `circularCapacity` ignores `frame` (about 58 pt) and its `currentValueLabel` did not render, so the ring was small and had no number. Now a `ZStack` with the number overlaid and `scaleEffect(size / 58)`; sizes 104/24 (medium) and 96/22 (small). This confirms the T2 predictions (ring size, number clipped or absent).
7. **Ember tests needed a `SafeAreaProvider`** after the inset polish (test wrapper updated); a tsc error from the `Crypto` to `RandomSource` cast (ef0a115).

## 4. Tooling notes and traps

- **Metro in `CI=1` mode has no reload.** After JS edits: `pkill -f 'expo start'`, restart with `CI=1 nohup npx expo start --dev-client --port 8081 --clear`, terminate and launch the app, tap the recent server in the dev launcher at point (200,439), wait about 35 s. A deep link sent during cold launch is lost; send it again. Running the old bundle produced stale results once.
- **Deep links** `ccspike://spike?action=<name>` always land on the Spike tab (`ccspike:///` is Ember). The iOS "Open in CoachCal Spike?" dialog never appeared here. `add-meal` upserts a fixed id, so it changes nothing when B already exists; use `edit-meal` or `delete-meal` to show the widget following.
- **`axe` 2.1.1**: `tap --label` works for home-screen edit-mode buttons but not for the glass tab bar or inside the Health sheet; use coordinates (points, 402x874; screenshot factor 2.29). `drag --steps 20 --duration 0.6` scrolls. In the Health app a `tap --label "Show All Health Data"` landed on a tab and opened Settings by mistake; scroll first, then tap by coordinates. A killed Health app shows its first-run onboarding again.
- **Quiet auto-sync quarantine**: a quarantined operation is visible only through `spike:sync:state`; the UI does not show it.
- **Build warnings (2)**: one is `The @ExpoModule class 'CoreModule' … is internal, so the generated modules provider cannot reference it`. Build succeeded, 0 errors (`evidence/build/t6-build-log-tail.txt`). Disk after the run: 6.8 GB free (the check stops below 6 GB).
- **Widget gallery preview** shows the stored props, not a live render; the layout is re-registered by `createWidget` at app start, so a JS reload plus relaunch updates the widget.

## 5. Not verified (needs a real device or the owner's account)

- Real home-screen widget on a device, WidgetKit background refresh budgets, a real midnight rollover (here driven by `rolloverAt` two minutes ahead).
- Health data on a real device and in the owner's own Health store; read grants are invisible to apps, so a denied read cannot be told apart from no data; kJ as preferred energy unit (the Simulator is kcal).
- Sync against the real Supabase backend (this spike used a throwaway PostgreSQL 17 and a small API; no Supabase, EAS, accounts or secrets were used).
- Apple's own documentation on correlation deletion was not read in this task; the behaviour above is what the Simulator showed.
- Light-mode week strip contrast (known, not fixed).

## 6. Checks

`npm run typecheck` and `npm test` pass in every workspace (mobile: 76 tests in 9 suites, after adding the delete and guard tests). The API, the PostgreSQL cluster and Metro are stopped at the end of the run.
