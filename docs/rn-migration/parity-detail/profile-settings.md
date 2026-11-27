# Profile and Settings parity detail (U-41)

Per-behavior record of the Group F profile/settings port (`apps/mobile/src/features/profile`).
Sources of truth: `native/App/Features/Profile/` (read in full), `native/App/CoachCal/AppEnvironment.swift`
(the toggle persistence, lines 88–110 and the reset around line 330), `native/App/CoachCalUITests/EdSafeTests.swift`.
Test evidence: `apps/mobile/src/features/profile/**/*.test.tsx` plus the plan-reveal ED-safe case in
`apps/mobile/src/features/onboarding/PlanRevealScreen.test.tsx`, run by `npm test`.

## Files

| Swift source | RN file | Parity row |
|---|---|---|
| ProfileFlow.swift (157) | `app/(tabs)/profile.tsx` (stats queries, settings push, sheet presentation) + `features/profile/profileModel.ts` | PR-01 |
| ProfileView.swift (211) | `features/profile/ProfileView.tsx` | PR-01 |
| SettingsDetailView.swift (248) | `app/settings.tsx` (real seams) + `features/profile/SettingsDetailView.tsx` + `settingsModel.ts` + `settingsCopy.ts` | PR-02 |
| TargetEditSheet.swift (180) | `features/profile/targetEditModel.ts` + `TargetEditSheet.tsx` | PR-03 |
| AppEnvironment.swift toggle persistence | `app/settings.tsx` (key + design flag binding) + `settingsModel.ts` (write path) | PL-08 write half |
| SettingsTests.swift (334) | `features/profile/settingsModel.test.tsx` (10-case twin) | — |

## PR-01 Profile

| Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|
| Stats snapshot: latest target, member-since (MIN updated_at), latest weight, 30-day logged days | ProfileModel.swift (ValueObservation tracking closure) | `app/(tabs)/profile.tsx` `loadStats()` (the same SQL over the data environment) | The Swift suite had no query test; the RN queries are route-bound and verified by typecheck + the screen tests over injected stats (see findings/U-41.md §6) |
| Plan line from the display-only entitlement state: "Free · Since Sep 2026" / "Free plan" (en-US pinned month) | ProfileView.planLine | `profileModel.ts` `planLine()`; the plan name is injected ("Free" from the route) | twin case 9 (`the profile renders the group F inventory`); month formatting pinned by the exact-string assertion |
| User card: gradient avatar "A", name, plan line, label "Alex, <plan line>" | ProfileView.userCard | `ProfileView.tsx` userCard | twin case 9 + `ProfileView.test.tsx` (label assertion) |
| Quick stats: daily target (ED-safe collapse), days logged, weight; labels "<caption> <value>" | ProfileView.quickStats/statCard | `ProfileView.tsx` quickStats + StatCard | `ProfileView.test.tsx` (values, labels, identifiers) |
| Goals group: daily target (ED-safe collapse), macro ratios, goal weight; rows open the edit sheet only when a target exists | ProfileView.goalsGroup | `ProfileView.tsx` goalsGroup | `ProfileView.test.tsx` (press, disabled-without-target) |
| Apple Health row reveals the Phase-4 footnote on tap — never a permission prompt | ProfileView (showsHealthNote) | `ProfileView.tsx` health note | twin case 10 (`the apple health tap shows the phase 4 footnote`) |
| Preferences rows: Reminders Off / Appearance System / Units Metric (inert) | ProfileView.preferences | `ProfileView.tsx` | twin case 9 |
| Settings row pushes the settings screen | ProfileFlow (navigationDestination) | route `onOpenSettings` → `router.push('/settings')` | `ProfileView.test.tsx` (press fires the callback) |
| No Health Connect row (Android out of scope post-pivot) | testProfileRendersGroupFInventory | — | twin case 9 sweeps every testID |

## PR-02 Settings

| Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|
| Locked copy (wellness title/description, delete dialog, billing note, version, burn add-back) | SettingsCopy enum | `settingsCopy.ts` (values verbatim) | twin case 4 (verbatim strings) + `SettingsDetailView.test.tsx` |
| The toggle persists the policy: app_settings `'1'/'0'` under the app-wide key, then the design flag applies; a fresh instance reads the persisted value | AppEnvironment.edSafeToggle didSet (UserDefaults key `edSafeMode`) | `settingsModel.ts` `setWellnessPolicy` (persist → apply); the key literal lives in `app/settings.tsx` and U-51 reads it at launch | twin case 1 (`the toggle flips and persists the wellness policy across a relaunch`); the route binding is `app/settings.tsx` |
| Toggle announcement: "ED-Safe Mode, on/off", carried by the toggle element | SettingsCopy.edSafeAnnouncement + the toggle's identifier | `settingsCopy.ts` `wellnessAnnouncement()`; the Switch carries it as its accessibility label | twin case 2 (label function + the switch element) |
| Burn add-back: defaults off, persists `'1'/'0'` under `burnAddBackEnabled`, no consumer yet (IN-01 note stays) | AppEnvironment.burnAddBackEnabled didSet | `settingsModel.ts` `setBurnAddBack`/`loadBurnAddBack` | twin case 3 (`burn add-back defaults off and its toggle persists the stored flag`) |
| Delete account: the entry opens the confirmation with the locked copy; the destructive action runs the best-effort chain (server cascade → sync store reset → sign-out); a failed step never skips the next; flags clear | SettingsDetailView.confirmationDialog + AppEnvironment.performLocalAccountReset | `SettingsDetailView.tsx` confirm overlay + `settingsModel.ts` `resetAccount` | twin case 5 (`the local account reset wipes tables and routes to onboarding` — order + failure-tolerance) + `SettingsDetailView.test.tsx` (confirm-gated calls) |
| Subscription card display-only: "Subscription"/"Active"/"Free"/"Change plan"/"Cancel subscription" inert + billing footnote | SettingsDetailView.subscriptionCard | `SettingsDetailView.tsx` | twin case 6 (`the subscription card renders display only`) |
| Export CSV: ShareLink present, disabled until the injected action resolves, shares exactly what it produced | SettingsDetailView.dataPrivacyGroup + CSVExportService | `SettingsDetailView.tsx` export row + Share.share of `model.exportedCsv` | twin case 7 (`export CSV presents the share link with the produced export`) + `SettingsDetailView.test.tsx` (disabled → enabled → share payload) |
| Support rows (Help & FAQ, Contact us) and version caption | SettingsDetailView.support | `SettingsDetailView.tsx` | `SettingsDetailView.test.tsx` (identifiers) |

## PR-03 Target edit

| Behavior | Swift source | RN file | Jest evidence |
|---|---|---|---|
| ±50 kcal steps, never below zero; macros preview re-derives per edit | TargetEditSheet.dailyTargetSection | `TargetEditSheet.tsx` + `targetEditModel.ts` `adjustKcal`/`macros` | `TargetEditSheet.test.tsx` (steps + preview) |
| Floor banner below the floor (locked copy from OnboardingCopy.safetyFloorBanner) | TargetEditSheet.isFloored | `TargetEditSheet.tsx` | `TargetEditSheet.test.tsx` (banner appears under 1,200) |
| Goal weight wheel 40…150, `<n> kg` | TargetEditSheet CCWheelField | `TargetEditSheet.tsx` WheelField | `TargetEditSheet.test.tsx` (momentum end picks the row) |
| Every save goes through TargetsEngine: kcal clamps to the sex floor, macros re-derive 30/40/30, goal weight ≥ 40 kg, same id, fresh timestamp | TargetEditSheet.reclamped | `targetEditModel.ts` `reclamped()` + `save()` | twin case 8 (`the target edit save reclamps through the targets engine`) + `TargetEditSheet.test.tsx` (save path → injected save, sub-floor clamp) |
| Daily-target section collapses under ED-safe; wheel and Save stay | TargetEditSheet `.edSafeHidden()` | `TargetEditSheet.tsx` EdSafeCollapse | `TargetEditSheet.test.tsx` ED-safe case |

## OB-09 (the ED-safe gap of the plan reveal)

The kcal hero and the weekly range hide in ED-safe mode through the design system's
`EdSafeCollapse` (PR 21's component). Placement matches the Swift `.edSafeHidden()`:
the hero VStack collapses whole (number, subtitle, announced label); the range Text
collapses inside its card, leaving the headline and caption visible. Evidence:
`PlanRevealScreen.test.tsx` "renders neither the kcal hero nor the weekly range in
ED-safe mode"; the four pre-existing cases keep passing unchanged in normal mode.

## Accessibility identifier table

Every `accessibilityIdentifier` of the Swift views and its RN `testID`. One deviation,
marked below; the acceptance grep (`grep -rn "edSafe" apps/mobile/src/features/profile`
prints nothing) forbids the Swift string, whose literal contains the design policy API's
name — the same convention U-31 applied to copy field names (values stay verbatim).

| Swift identifier | RN testID | Element |
|---|---|---|
| profile.userCard | profile.userCard | user card |
| profile.stat.dailyTarget | profile.stat.dailyTarget | daily-target stat card |
| profile.stat.daysLogged | profile.stat.daysLogged | days-logged stat card |
| profile.stat.weight | profile.stat.weight | weight stat card |
| profile.row.dailyTarget | profile.row.dailyTarget | goals: daily target row |
| profile.row.macroRatios | profile.row.macroRatios | goals: macro ratios row |
| profile.row.goalWeight | profile.row.goalWeight | goals: goal weight row |
| profile.row.appleHealth | profile.row.appleHealth | integrations: Apple Health row |
| profile.healthNote | profile.healthNote | revealed health footnote |
| profile.row.settings | profile.row.settings | settings entry row |
| settings.edSafeToggle | **settings.wellnessToggle** (deviation, see above) | wellness switch |
| settings.wellnessCard | settings.wellnessCard | wellness card |
| settings.burnAddBackToggle | settings.burnAddBackToggle | burn add-back switch |
| settings.burnAddBackNote | settings.burnAddBackNote | burn add-back note |
| settings.row.export | settings.row.export | Export CSV row |
| settings.row.deleteAccount | settings.row.deleteAccount | delete account entry |
| settings.deleteConfirm | settings.deleteConfirm | confirmed destructive action |
| settings.subscriptionCard | settings.subscriptionCard | subscription card |
| settings.planValue | settings.planValue | plan value ("Free") |
| settings.changePlan | settings.changePlan | inert Change plan button |
| settings.cancelSubscription | settings.cancelSubscription | inert Cancel subscription button |
| settings.billingNote | settings.billingNote | billing footnote |
| settings.row.help | settings.row.help | Help & FAQ row |
| settings.row.contact | settings.row.contact | Contact us row |
| settings.version | settings.version | version caption |
| settings.targetEdit.goalWeight | settings.targetEdit.goalWeight | goal weight wheel |
| settings.targetEdit.save | settings.targetEdit.save | Save button |
| settings.targetEdit.kcalDown | settings.targetEdit.kcalDown | −50 step |
| settings.targetEdit.kcal | settings.targetEdit.kcal | kcal value |
| settings.targetEdit.kcalUp | settings.targetEdit.kcalUp | +50 step |
| settings.targetEdit.safetyFloor | settings.targetEdit.safetyFloor | floor banner |
| (Swift cancel button has no identifier) | settings.cancelDelete | RN confirmation cancel |
| debug.toggleOffline (#if DEBUG) | — not ported | see findings/U-41.md §7 |

## Storage keys (the write half of PL-08)

| Key | Value format | Written by | Read by |
|---|---|---|---|
| `edSafeMode` | `'1'` / `'0'` | `app/settings.tsx` → writeAppSetting over the data environment (through the model's injected writer) | U-51 at launch (same key and format) |
| `burnAddBackEnabled` | `'1'` / `'0'` | same path | no consumer yet (IN-01), as in the Swift app |
