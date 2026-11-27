# T4 findings — HealthKit adapter and measurement script

Worker-G2, 2026-11-27. Branch `spike/rn-expo-health`. Library:
`@kingstinct/react-native-healthkit` 16.2.0 + `react-native-nitro-modules` 0.37.2 (from
`package-lock.json`). Everything below was read from `node_modules/` of this worktree, not
from the web.

## Library calls used (declaration file and line for each)

All line numbers are in `node_modules/@kingstinct/react-native-healthkit/` unless marked
otherwise. The app-facing types resolve through the package `exports` map
(`types: lib/typescript/index.d.ts`; `apps/mobile/tsconfig.json` sets
`moduleResolution: 'bundler'` + `customConditions: ['react-native']` via
`expo/tsconfig.base`).

| Call | Declared at | Signature as shipped |
|---|---|---|
| `isHealthDataAvailable()` | `lib/typescript/healthkit.ios.d.ts:62` | `() => boolean` — **synchronous** |
| `requestAuthorization(toRequest)` | `lib/typescript/healthkit.ios.d.ts:81`; arg type `AuthDataTypes` in `src/specs/CoreModule.nitro.ts:23-26` | `({ toShare?: SampleTypeIdentifierWriteable[], toRead?: ObjectTypeIdentifier[] }) => Promise<boolean>` |
| `saveCorrelationSample(type, samples, start, end, metadata?)` | `src/specs/CorrelationTypeModule.nitro.ts:14-19`; export `lib/typescript/healthkit.ios.d.ts:84` | `(CorrelationTypeIdentifier, SampleForSaving[], Date, Date, AnyMap?) => Promise<CorrelationSample \| undefined>` |
| `queryCorrelationSamples(type, options)` | `src/specs/CorrelationTypeModule.nitro.ts:22-24`; export `lib/typescript/healthkit.ios.d.ts:66` | `(CorrelationTypeIdentifier, QueryOptionsWithSortOrder) => Promise<readonly CorrelationSample[]>` |
| `deleteObjects(type, filter)` | `lib/typescript/healthkit.ios.d.ts:82` | `(SampleTypeIdentifierWriteable, FilterForSamples) => Promise<number>` |
| `authorizationStatusFor(type)` | `lib/typescript/healthkit.ios.d.ts:47` | `(ObjectTypeIdentifier) => AuthorizationStatus` (sync) |
| `AuthorizationStatus` | `node_modules/@react-native-healthkit/core/lib/typescript/types/Auth.d.ts:12-16` | `notDetermined = 0, sharingDenied = 1, sharingAuthorized = 2` |
| `ComparisonPredicateOperator.equalTo` | `node_modules/@react-native-healthkit/core/lib/typescript/types/QueryOptions.d.ts:13` | `equalTo = 4` |
| `FilterForSamples` / `DateFilter` / `PredicateWithMetadataKey` | `src/types/QueryOptions.ts:15-24, 30-35` | `{ uuid?, uuids?, metadata?, date?, sources? … }` / `{ startDate?, endDate?, strict*? }` / `{ withMetadataKey, operatorType?, value? }` |
| `QuantitySampleForSaving` | `src/types/QuantitySample.ts:28-36` | `{ startDate, endDate, quantityType, quantity, unit, metadata?, sourceRevision? }` |
| `CorrelationSample` | `src/types/CorrelationType.ts:15-20` | `BaseSample` + `{ correlationType, objects: readonly (CategorySample \| QuantitySample)[] }` |
| Meal identifiers | `src/generated/healthkit.generated.ts:47, 52, 56, 68` | `HKQuantityTypeIdentifierDietaryEnergyConsumed`, `…DietaryProtein`, `…DietaryCarbohydrates`, `…DietaryFatTotal` |
| Canonical units for them | `src/generated/healthkit.generated.ts:418` (`QUANTITY_IDENTIFIER_CANONICAL_UNITS`; kcal at `:450`, g at `:466`) | energy `kcal`, protein/carbs/fat `g` — matches the units T4 saves with |

Queried samples carry `sampleType` as a **structured object** (`SampleType`: identifier +
three booleans, `core/lib/typescript/types/Shared.d.ts:8-13`), not the identifier string.

## How the adapter meets spec D3

- One meal = one `HKCorrelationTypeIdentifierFood` correlation holding exactly four
  quantity samples (kcal + g + g + g), meal name in metadata (`ccSpikeMealName`).
- **Stable UUID**: `healthUuidForMeal(mealId)` derives a deterministic UUID from the meal
  id (four FNV-1a lanes, RFC-4122 v4-shaped). `saveMealToHealth` stores it as
  `ccSpikeMealId` metadata and queries by that metadata before saving, so a retry finds
  the earlier row and answers `saved: false` instead of double-saving. This is the
  workaround for the missing UUID parameter (see next section).
- Failures are the typed `HealthMealError` (`notAvailable` / `unauthorized` / `saveFailed`
  / `queryFailed`); every exported function returns `HealthResult<T>` and nothing throws
  out of the adapter. The unauthorized guard runs before any query/save/delete because the
  library README warns that querying a never-requested type can crash the app (README line
  67). Write status of the correlation type is the proxy: `notDetermined` and
  `sharingDenied` both map to `unauthorized` (Apple never exposes read grants).
- Read-back reduction (`correlationsToMeals`) only accepts correlations that carry our
  `ccSpikeMealId` metadata — other apps never see our custom keys, so key presence is the
  "written by this app" filter without source-proxy round trips. Quantities whose unit is
  not the saved one are counted into `unknownUnits`, never silently coerced.
- Deletion is `deleteObjects` with an equalTo metadata predicate on the derived id — no
  stored HealthKit UUID needed.

## Where the README is wrong or silent

1. **The save API takes no UUID** (and `HKCorrelation` has no UUID-taking initializer in
   HealthKit at all — HealthKit assigns the UUID). The plan's "stable UUID … so a retry
   cannot save twice" is implemented as derived-UUID-in-metadata + query-before-save
   (`saveMealToHealth`). Consequence to verify on simulator: if the user grants write but
   not read, the idempotency probe silently finds nothing and a retry would double-save.
2. **Correlations are undocumented in the README** — the capability table (line 16) says
   ✅ and nothing more; the real API is only in `specs/CorrelationTypeModule.nitro.ts`.
3. **README line 106 shows a positional call `requestAuthorization(['HK…'])`** — wrong for
   16.2.0; the real signature is the `AuthDataTypes` object (`{ toShare, toRead }`).
4. **README line 88 awaits `isHealthDataAvailable()`** — it is sync `() => boolean` in
   16.2.0 (`healthkit.ios.d.ts:62`). Awaiting works, but it is not async.
5. **Units on read-back**: "units are never required when querying, it always defaults to
   the users preferred unit" (README line 201). The correlation query has no unit override
   (only plain `QueryOptionsWithSortOrder`), so a user with a non-canonical preferred unit
   (e.g. kJ for energy) would break a naive kcal read-back — the reduction flags such rows
   via `unknownUnits` instead. Verify on simulator (see below).
6. **`react-native-nitro-modules` 0.37.2 does not export `AnyMap`** although the healthkit
   types import it (`src/types/*.ts` imports `AnyMap` from `react-native-nitro-modules`;
   no such export exists anywhere in that package's TS). `expo/tsconfig.base` sets
   `skipLibCheck: true`, so `tsc --noEmit` stays clean and the metadata param is
   effectively untyped. Nothing to fix in the spike; recorded for the rewrite decision.
7. The library is pure Nitro (`NitroModules.createHybridObject` in `src/modules.ts:14-43`)
   — it cannot load in Jest, hence the manual mock (`src/__mocks__/@kingstinct/`), which
   the tests activate with `jest.mock('@kingstinct/react-native-healthkit')`.

## Decisions taken inside T4's scope

- The contract `Meal` shape is declared locally in `mealToHealthKit.ts` (plan forbids
  importing `packages/api-contract`).
- `dayKeyRange` / `dayKeyOf` (local-time day keys) live in the health folder because
  `packages/core` is T1's file and does not have `dayKey` yet; if T1's core helper lands,
  the adapter can switch to it.
- Fixture meal: `FIXTURE_MEAL_ID` is a fixed literal so repeated `health-save` runs
  exercise the retry path; `fiberG: 4` (display-only, never saved to HealthKit); 624 kcal
  is saved as given (note: `kcalFromMacros` on 38/70/18 would say 594 — the brief's number
  wins; HealthKit stores what we pass).
- `scripts/measure.sh` supports `MEASURE_RUNTIME=0` for a size-only dry run; without it,
  the script runs the full spec D6 flow. Debug mode warns (not fails) when Metro is not on
  :8081.

## Registration lines (for T6)

```ts
import { healthSpikeActions } from '../data/health/spikeActions';
for (const action of healthSpikeActions) registerSpikeAction(action);
```

or individually: `registerSpikeAction(healthRequestAction)`,
`registerSpikeAction(healthSaveAction)`, `registerSpikeAction(healthReadAction)`,
`registerSpikeAction(healthDeleteAction)`. Names: `health-request`, `health-save`,
`health-read`, `health-delete`; all `item: 'health'`.

## What must be observed on a simulator (T6 checklist)

1. `health-request` shows the system authorization sheet; note that only the write side
   has visible toggles — read grants are invisible by Apple's design.
2. Health app: after `health-save`, does the meal appear under Nutrition as a meal with
   its four child samples? (Simulator Health data lives under Browse → Nutrition.)
3. `health-read` after a fresh save: does the read-back come back in kcal/g (simulator
   user's preferred units are normally canonical) and does 624 read back as 624?
4. `health-delete`: does deleting the correlation delete its four child samples too, or
   are they orphaned? (The adapter deletes the correlation row by metadata; check in the
   Health app or by querying quantity samples afterwards.)
5. Round trip of custom metadata (`ccSpikeMealId`) — the idempotency probe depends on the
   library actually persisting custom keys on correlations.
6. Saving/querying with authorization never requested — README claims an app crash; the
   adapter's unauthorized guard should make this unreachable, but T6 should confirm the
   guard fires before the first library call.

## Not verified (and why)

- Everything native: no `expo run:ios` / `pod install` in T4 (limits), so authorization
  sheet, save, read-back, delete and metadata round trip are all pending T6.
- `scripts/measure.sh` beyond the size branch: idle memory and cold start need the T1
  `first-render.txt` marker, which only exists after integration. `bash -n` passes and the
  size branch ran on the real Debug build (197568 kB / 192.9 MB; zipped 38552 kB / 37.6 MB
  — see `evidence/measurements/debug.txt`, marked as dry run). The simulator was not
  touched because T1 shares it.
