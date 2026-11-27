# Parity detail — core (packages/core), unit U-10

Every behavior ported from the Swift module `CoachCalCore`, per parity row, with its TypeScript
file and the Jest case that proves it. All Jest cases live next to the source under
`packages/core/src/` and run with `npm test --workspace @coachcal/core` (87 tests, green at
commit time; the full-root gate numbers are in the unit report).

Swift sources: `native/Modules/CoachCalCore/Sources/CoachCalCore/` — read in full before porting.
Swift tests: `native/Modules/CoachCalCore/Tests/CoachCalCoreTests/` — one Jest case per Swift
`@Test`, same behavior sentence (56 Swift cases → 56 twins, plus 17 additional TS cases where the
brief requires coverage the Swift files don't carry: DayKey zones, the server-rule parity proof,
and the pure-rule extras of syncEnvelope/widgetSnapshot).

## CO-01 KcalArithmetic — done

| Behavior | TypeScript | Jest case |
|---|---|---|
| `mealKcal(per100gKcal:grams:)`, half-up | `kcal.ts` (`KcalArithmetic.mealKcal`) | `kcal.test.ts` › "golden parity case matches fixture" |
| Zero grams give zero | `kcal.ts` | › "zero grams yield zero" |
| Monotonic in grams | `kcal.ts` | › "meal kcal is monotonic in grams" |
| Rounds to nearest whole | `kcal.ts` | › "meal kcal rounds to nearest whole" |
| `macroGrams(per100g:grams:)`, one decimal | `kcal.ts` (`KcalArithmetic.macroGrams`) | › "macro grams rounds to one decimal" |
| Parity with the server rule (`roundKcal`/`roundMacro`), incl. `kcalFromMacros` on the Swift vectors | `kcal.ts` + `index.ts` (`kcalFromMacros`) + `arithmetic.ts` | › "kcalFromMacros agrees with the server rule on the Swift vectors" |

## CO-02 TargetsEngine — done

All in `targets.ts` (`TargetsEngine`, types `QuizProfile`, `Targets`, `Sex`, `ActivityLevel`,
`Goal`, result shapes `ClampedKcal`/`ClampedPace`/`MacroSplit), proven in `targets.test.ts`
(17 cases, one per Swift case, same sentences): Mifflin-St Jeor BMR for both sexes ("male BMR
matches Mifflin-St Jeor", "female BMR matches Mifflin-St Jeor"); the five TDEE multipliers
("tdee applies all five activity multipliers"); goal adjustments ("goal adjustment applies deficit
surplus or none"); 1,200/1,500 floors with the `floorsApplied` flag ("female target below floor
clamps to 1200 with flag and safe pace", "male target below floor clamps to 1500 with flag",
"target above floor is not flagged", "clamped daily kcal enforces floors by sex"); safe-pace clamp
against the floored target ("requested pace above deficit clamps to supported rate", "requested
pace within deficit passes through unclamped", "maintain goal yields zero pace and flags any
request", "gain surplus supports about 0 point 27 kg per week", "zero deficit lose profile clamps
pace to zero"); 30/40/30 macro split ("macro grams derive from thirty forty thirty ratios");
fiber/water defaults ("fiber and water defaults are thirty grams and eight glasses"); clamps
instead of throws on adversarial bodies ("adversarial body inputs compute without trapping"); goal
weight floor ("goal weight below forty kg clamps to healthy boundary").

## CO-03 StreakEngine — done

All in `streak.ts` (`StreakEngine.evaluate`, `StreakInput`, `StreakOutcome`,
`StreakEngine.maxLookbackDays`), proven in `streak.test.ts` (11 cases, one per Swift case, same
sentences, the fixture pinned to UTC like the Swift suite): "consecutive logged days ending today
count fully"; "streak ending yesterday still counts when today is unlogged"; "gap without freeze
starts fresh streak at one"; "freeze bridges single missed day and is consumed"; "freeze
unavailable leaves the gap broken"; "best streak never regresses"; "stale history without recent
logs resets to zero"; "freeze is not burned without segment before the gap"; "two day gap is never
bridged"; "existing freeze stamp is preserved when no new freeze is consumed"; "evaluation is
deterministic under fixed now".

`native/App/CoachCalTests/StreakBadgeInsightTests.swift` (the brief's extra source for pure
StreakEngine cases): all six of its tests drive the database, `ProgressModel` or `CoachModel`;
none tests `StreakEngine` alone, so nothing ports from it (see findings/U-10.md §7).

## CO-04 DayKey — done

`dayKey.ts` (`dayKey(date, timeZone?)`, the Swift `DayKey.string(for:calendar:)` port; the
`calendar` parameter is the time-zone carrier, so the twin's carrier is an explicit IANA
`timeZone` with the process zone as the `.current` default). `dayKey.test.ts` runs one describe
block each under `Asia/Ho_Chi_Minh`, `America/Los_Angeles` and `Pacific/Kiritimati` (plus the
process-zone block): "formats the local calendar day of the instant, not the UTC day"; "keeps zero
padding for single digit months and days"; "keeps an invalid date as an empty string instead of
throwing"; the process-zone block checks the default path against the explicit one. The
`jest.config.js` pins `TZ=UTC` for the package so the suite is machine-independent (see findings
§5 for why the env write alone is inert in a Jest worker).

## CO-05 WidgetSnapshot (+ store logic) — done

`widgetSnapshot.ts`: the Swift type as `WidgetSnapshot { caloriesRemaining, edSafeMode,
updatedAt }`, the Codable round trip as `encodeWidgetSnapshot`/`decodeWidgetSnapshot`, and
`WidgetSnapshotStore` over an injectable `WidgetSnapshotContainer` (`null` = the App Group
container is unavailable). `widgetSnapshot.test.ts`: "encode decode round trip preserves all
fields"; "write is silent no-op when app group container is unavailable"; "clear is silent no-op
when app group container is unavailable"; "read returns nil when nothing has been written"; plus
"store write and read round trip through the container" and "a malformed payload decodes to nil
instead of crashing" (T-P45-02).

The spike's `apps/mobile/src/data/widget/snapshotFromMeals.ts` now returns the Swift fields
(`caloriesRemaining` via `kcalLeft`, `edSafeMode`, `updatedAt`) alongside the spike props it must
keep feeding (`binding.ts`/`spikeActions.ts` are outside this unit's writable scope). Proven in
`snapshotFromMeals.test.ts` › "sums only the meals eaten today and carries the goals", "is a
zeroed snapshot for a day without meals", "carries the ed safe flag from the caller into the
snapshot". Field-by-field differences and the U-43 hand-off: findings/U-10.md §1.

## CO-06 CanonicalVersion (the LWW comparator) — done

`canonicalVersion.ts` (`compareCanonicalVersions`, `CanonicalRowVersion`), proven in
`canonicalVersion.test.ts`: "higher server version wins regardless of op ID"; "equal server
versions break ties lexicographically by op ID"; "identical versions return the first argument";
"every delivery order converges to the same winner" (all 24 permutations).

## CO-07 SyncEnvelope (validators, strict decoding logic) — done

The wire shapes stay in `packages/api-contract/src/sync.ts` (zod, not duplicated here). The
Swift-side rules port as pure functions over structural types in `syncEnvelope.ts`:
`rejectUnknownKeys` ("unknown keys are reported sorted and comma joined"),
`decodeDiaryEntrySnapshot` — required keys + unknown-key rejection + non-negative serverVersion +
the ISO offset date rules ("snapshot requires every key and rejects unknown keys"),
`createPushRequest` non-empty/unique-opId ("push request requires non-empty unique operations and
round trips"), `validateAcknowledgementSet` exact-ack-set ("push response acknowledgement set must
match submitted operations exactly"), `validatePullResponse` cursor rules ("pull cursor must be
non-negative and at least the highest delivered server version"), `parseSyncDate`/`formatSyncDate`
("date codec accepts fractional-second and plain ISO-8601 offsets and rejects the rest"), and the
`SyncTransport` interface ("sync transport surface is available and sendable").

## CO-08 ProofRecord + serializer with redaction — done

`proofRecord.ts`: types (`ProofScenario`, `ProofCheckStatus`, `ProofEnvironment`, `ProofCheck`,
`ProofValue` as the discriminated union, `ProofRecord`), `ProofRedactionError`, and
`ProofRecordSerializer` (schemaVersion 1, sorted-keys JSON, uuid on the uppercase canonical form,
ISO-8601 local-offset dates, fail-closed redaction scan). Proven in `proofRecord.test.ts`:
"serializes required schema v1 fields deterministically"; "rejects sensitive keys at any depth
before emission"; "rejects legacy proof identity value before emission" (the legacy literals are
joined at runtime, never in source); "serialized sample passes repository validator round trip"
(runs `scripts/measure-phase1-sync.mjs` over the serialized sample through stdin — exit 0).

## PL-10 (logic part) NotificationScheduler pure rules — done (logic only; wiring is U-42)

`notificationSchedule.ts` (`NotificationScheduler.pendingRequests`,
`NotificationScheduler.allIdentifiers`), proven in `notificationSchedule.test.ts`: "all three
requests when nothing logged and not ed safe"; "lunch reminder suppressed once lunch logged";
"dinner reminder suppressed once dinner logged"; "eod recap always present regardless of whats
logged"; "ed safe recap body contains no digit characters"; "trigger times match documented
schedule" (12:30 / 18:30 / 21:00, repeating); "identical input produces byte identical requests".
The notification-center side of `refresh()` is listed for U-42 in findings/U-10.md §4.

## CoachCalCore.swift (module surface)

`index.ts` exports `moduleName` ("module name is exposed" in `index.test.ts`, the
CoachCalCoreTests twin) and the `WalkingSnapshot` type.
