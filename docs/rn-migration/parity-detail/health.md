# Health parity detail (U-42)

Per-row record of the HealthKit, local-notification and CSV-export wiring. Sources read in
full: `native/App/Features/Health/HealthKitService.swift` (137) and `ConfirmedEnergyEntry.swift`
(15), `native/App/Modules/CoachCalCore/Sources/CoachCalCore/NotificationScheduler.swift`,
`native/App/CoachCalTests/HealthKitServiceTests.swift` (139), the call sites
(`TodayModel.swift` 163, `AppEnvironment.swift` ~245/~330, `SettingsDetailView.swift` 175,
`ProfileFlow.swift` 123), and the spike (`apps/mobile/src/data/health/`, spike report item 3 +
`evidence/spike/item3/health-actions-log.txt`). Test evidence: the suites named per row below,
run by `npm test` in `apps/mobile`.

## Files

| Swift source (lines) | RN file | Notes |
|---|---|---|
| HealthKitService.swift (137) | `data/health/healthKitService.ts` | The service over an injected `HealthKitNativePort` (the `HealthStoring` seam); type-only module — Jest never loads the Nitro library |
| HealthKitService.swift `extension HKHealthStore: HealthStoring` | `data/health/healthKitNative.ts` | The real port over `@kingstinct/react-native-healthkit` 16.2.0; the casts to the library's branded identifier unions live here, so the service stays library-free |
| ConfirmedEnergyEntry.swift (15) | `data/health/confirmedEnergyEntry.ts` | Branded type (unexported unique symbol) + the `confirmEnergyEntry` memberwise-init seam |
| HealthKitService.swift `aggregateStepCount` | `data/health/healthKitService.ts` `aggregateStepCount` | Pure, directly unit-tested |
| NotificationScheduler.swift `refresh()` (the non-core half, listed by findings U-10 §4) | `platform/notifications/notificationScheduler.ts` | `refreshNotifications()` over an injected `NotificationCenterPort`; the default port maps the repeating calendar triggers to `expo-notifications` |
| CSVExportService.swift file half (`CSVDocument` + `ShareLink`, SettingsDetailView.swift 175) | `platform/csv/csvExportFile.ts` | Generator stays `data/repos/csvExport.ts` (U-12, untouched); file write via the expo-file-system `File`/`Paths.cache` API (the spike's pattern), share via `expo-sharing` |
| ProfileFlow.swift 123 (`csvExportAction` closure) | `app/settings.tsx` (binding only) | Binds `prepareCsvExport` — see the binding note in the PL-14 row and findings §2 |
| PrivacyHealthView.swift (59) ask | `features/onboarding/healthAccess.ts` | The ask is the service's `requestAuthorizationIfNeeded()` — steps only — instead of the five types U-31 shipped (the OB-03 narrowing) |

## Per parity row

| Row | Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|---|
| PL-13 | JIT ask: requests only while `.notDetermined`, reads steps only (`toShare: []`), never throws, false on denial, no re-ask once determined | HealthKitService.swift `requestAuthorizationIfNeeded` | healthKitService.ts | `healthKitService.test.ts` — "requests exactly once when the status is not determined", "never requests again when already authorized", "returns false without throwing when the status is a terminal denial", "the authorization ask reads the step count only and shares nothing", "returns false without throwing when the ask itself fails"; `healthAccess.test.ts` — the same narrowing over the real library mock |
| PL-13 | Hourly background delivery for steps, no-op unless authorized, `try?` | HealthKitService.swift `enableBackgroundDeliveryIfAuthorized` | healthKitService.ts | `healthKitService.test.ts` — "enables background delivery only when authorized" |
| PL-13 | Today step count: midnight-to-now anchored query, anchor kept across calls, 0 while unauthorized | HealthKitService.swift `todayStepCount` + `aggregateStepCount` | healthKitService.ts | `healthKitService.test.ts` — "queries today steps through the anchored query and stores the new anchor", "returns zero step counts without querying while unauthorized", "aggregates step samples by summing their quantities" (the Swift stub-sample case), "aggregates an empty sample list to zero" |
| PL-13 | Burned-energy write only from a user-confirmed value | ConfirmedEnergyEntry.swift + `writeBurnedEnergy` | confirmedEnergyEntry.ts + healthKitService.ts | `healthKitService.test.ts` — "writes burned energy from a confirmed energy entry" (kcal, unit, start=end=confirmedAt reach the port) |
| PL-13 / I12 | Deleting a meal deletes the correlation AND each child sample, per quantity type, by the derived metadata id | spike `healthKitMeals.ts` (the Swift delete lives in the diary flow; the routine is the spike's, proven on the Simulator by `health-actions-log.txt`) | healthKitService.ts `deleteMealSamples` | `healthKitService.test.ts` — "deleting a meal removes the correlation and each child sample" |
| PL-13 | Burn add-back read: the Settings toggle's stored key, defaults false | HealthKitService.swift `burnAddBackEnabled` + `HealthKitSettingsKey` | healthKitService.ts `burnAddBackEnabled` (key: `platform/storedFlags.ts` `BURN_ADD_BACK_SETTING_KEY`) | `healthKitService.test.ts` — "defaults burn add-back to false", "reads the stored burn-add-back flag the Settings toggle writes" |
| PL-10 | The three reminders (`meal.lunch` 12:30, `meal.dinner` 18:30, `eod.recap` 21:00, repeating), suppressed per logged slot, ED-Safe recap without digits | NotificationScheduler.swift `refresh()` | notificationScheduler.ts (decision: `@coachcal/core` `NotificationScheduler.pendingRequests`, ported in U-10) | `notificationScheduler.test.ts` — "asks for permission, cancels every identifier, then schedules the three reminders", "schedules the three reminders with their copy and repeating calendar times", "suppresses the lunch reminder on a day with lunch logged and dinner not" |
| PL-10 | Idempotent replace: lazy permission ask, all three identifiers removed before re-adding, at most 3 pending, never additive, never throws | NotificationScheduler.swift `refresh()` (T-P44-02) | notificationScheduler.ts `refreshNotifications` | `notificationScheduler.test.ts` — "a second refresh does not duplicate a pending request", "never throws when the center refuses the permission or a schedule" |
| PL-10 | The calendar-trigger mapping to expo-notifications | NotificationScheduler.swift `UNCalendarNotificationTrigger(dateMatching:repeats: true)` | notificationScheduler.ts `expoNotificationCenter` | `notificationScheduler.test.ts` — "the expo port schedules a repeating calendar trigger at the requested hour and minute" (over the library's manual mock) |
| PL-14 | The generator's output becomes the cache file `CoachCal Data.csv` | SettingsDetailView.swift `CSVDocument(data:)` (the `.task` pre-compute) | csvExportFile.ts `prepareCsvExport` / `exportCsvAndShare` | `csvExportFile.test.ts` — "prepareCsvExport returns the generator output the view shares and writes the same file", "rewrites the same cache file on a second export" |
| PL-14 | The file URL goes to the share sheet | SettingsDetailView.swift `ShareLink(item: CSVDocument…)` | csvExportFile.ts `exportCsvAndShare` (expo-sharing, `text/csv`) | `csvExportFile.test.ts` — "exportCsvAndShare writes the generator output to the file and the share port receives its URL" |
| OB-03 | The privacy step's button runs the real JIT ask; granted advances, denied shows the footnote | PrivacyHealthView.swift | features/onboarding (unchanged screen/model) | `PrivacyHealthScreen.test.tsx` (U-31, untouched — the injected ask keeps its `'granted' \| 'denied'` shape), plus the narrowing cases of `healthAccess.test.ts` |

## What still has no caller

- `refreshNotifications()` — Swift's caller is `AppEnvironment.notifyLocalMutation()` (the
  write/foreground seam). The RN write seam is a later unit; nothing calls it yet. Listed in
  findings U-10 §4 as this unit's hand-off; the wiring contract (deps + port) is final.
- `healthKitService.todayStepCount()` / `enableBackgroundDeliveryIfAuthorized()` — Swift's
  caller is `TodayModel.loadStepsIfNeeded()` (line 163). Binding steps into Today belongs to
  the unit that owns Today.
- `healthKitService.deleteMealSamples()` — Swift's caller is the diary delete flow. The RN
  diary delete is a later unit; the spike console actions (`data/health/spikeActions.ts`) keep
  using their own adapter until it lands.
- `healthKitService.writeBurnedEnergy()` + `confirmEnergyEntry()` — Swift's caller is the
  confirm sheet (and `burnAddBackEnabled` the Today budget math). Both belong to later units.
- `exportCsvAndShare()` — the Swift `ShareLink` shares the FILE on tap; the RN view still
  shares the export text (`Share.share(message:)`, U-41's approximation). Moving the tap to
  the file share is a `features/profile` change — out of this unit's scope. Until then the
  route binds `prepareCsvExport` (write + return text), so the row behaves exactly as before.
- `healthKitService.burnAddBackEnabled()` has no route binding yet (Swift reads it in
  `AppEnvironment`); until a caller passes `readBurnAddBack`, the service answers false — the
  `NoOpHealthKitService` default. IN-01 parity: nothing consumes the flag yet on either side.
