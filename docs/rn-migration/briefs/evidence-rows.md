# The rows of every evidence unit

One table per unit. "How" names the way in; every step that is not plain tapping is in the common
brief (`briefs/evidence-common.md`). The frames are files under `docs/design/ember/frames/`.

## U-74e Diary (rows DY-01 to DY-08) — running

See `briefs/U-74e.md`.

## U-76e Today (row TD-01)

See `briefs/U-76e.md`: the three frames 07, 08, 09; the empty day; High Contrast; the two proofs
of Zed (the four-digit number on one line; the macro grid not cut at the edge); the header
offline.

## U-73e Onboarding (rows OB-01 to OB-10) — after PR 36

| Row | Frame | How |
|---|---|---|
| Steps 1 to 9 in light | `20-onboarding-1-welcome.png` to `28-onboarding-9-your-plan.png` | a fresh install (`--ccFreshStart`), tap "Get started", walk the nine steps |
| Steps 1 to 9 in dark | `47-darkmode-1-welcome-dark-same-in-both-modes.png` to `55-darkmode-9-your-plan-dark.png` | `appearance dark` before the walk |
| The plan reveal with ED-Safe on | next to 28 (derived) | launch with `--ccEDSafe` before the walk, or turn the toggle of step 7 on |
| Step 7 with the ED-Safe toggle on | next to 26 (derived) | the toggle of step 7 |
| The clamp on blur (proof) | no frame | type 250 in the field of height and leave it: the field shows 220; type 9: 120 |
| The pace of step 4 | `23-onboarding-4-goal-weight-and-pace.png` | the three options, Steady selected; tap Relaxed and Faster |
| High Contrast, step 1 | next to 20 (derived) | `increase_contrast enabled` |
| Step 8 | `27-onboarding-8-building-your-plan.png` | no timer: the screen waits for "See your plan"; capture it as it is before the tap |

## U-75e Progress and Coach (rows PG-01 to PG-04, CH-01) — after PR 42

| Row | Frame | How |
|---|---|---|
| Progress in light | `11-core-progress.png` | the Progress tab of the seeded Today |
| Progress in dark | next to 11 (derived) | `appearance dark` |
| Progress with ED-Safe on | next to 11 (derived) | `--ccEDSafe`: the weekly energy card is not drawn |
| The range selector | next to 11 (derived) | tap Week, Month, 3M and Year: only the weight trend changes |
| The weight log sheet | next to `68-target-edit-goal-sheet-light.png` (derived) | tap the weight card |
| Coach in light | `12-core-coach.png` | the Coach tab |
| Coach in dark | next to 12 (derived) | `appearance dark` |
| Coach with ED-Safe on | next to 12 (derived) | `--ccEDSafe` |
| "See the days" open | next to 12 (derived) | tap the action of an insight that holds days |
| High Contrast, Progress | next to 11 (derived) | `increase_contrast enabled` |

## U-77e Profile, Settings and Billing (rows PR-01 to PR-03, PL-14) — after PR 43 and PR 39

| Row | Frame | How |
|---|---|---|
| Profile in light | `13-profile-profile.png` | the Profile tab |
| Profile in dark | `81-darkmore-profile-dark.png` | `appearance dark` |
| Profile with ED-Safe on | next to 13 (derived) | `--ccEDSafe`: the daily target is hidden, the weight stays |
| Settings in light | `14-profile-settings.png` | Profile, then Settings |
| Settings in dark | `82-darkmore-settings-dark.png` | `appearance dark` |
| The two billing buttons disabled | part of 14 | they look disabled and the note says why |
| The export: the share sheet dismissed | `45-export-export-share-sheet-cancelled-light.png`, `46-…-dark.png` | tap Export, dismiss the share sheet of the system: the row says "Not shared" in the information tone |
| The export: no data in range | `43-export-export-no-data-in-range-light.png`, `44-…-dark.png` | a range of dates without entries, if the screen offers one; otherwise a derived row with the reason |
| The export: write failed | `41-export-export-write-failed-light.png`, `42-…-dark.png` | a write failure cannot be forced on the Simulator without a fixture: the row is derived and says so, unless the Debug console offers a switch |
| The quota sheet | `17-billing-quota-reached-sheet.png`, `56-darkmode-quota-reached-dark-sheet.png` | built in the scan unit: open it with the way the findings of U-72 name (a scan that answers `FREE_LIMIT_REACHED`) |
| The paywall, failed | `79-paywallstates-paywall-prices-failed-light.png`, `80-…-dark.png` | Settings, "Change plan": the shell ends in the failed state; "Try again" inside the caution card; no Restore |
| The paywall, loading | `78-paywallstates-paywall-loading-light.png` | capture during the load if the state lasts long enough to shoot; otherwise derived with the reason |
| The cancel flow | `19-billing-cancel-flow.png`, `58-darkmode-cancel-flow-dark.png` | Settings, "Cancel subscription": the copy before the tap; do not tap the primary on the Simulator |
| The edit goal sheet | `68-target-edit-goal-sheet-light.png`, `69-…-dark.png`, `70-…-ed-safe.png` | Profile, the goal weight: light, dark, ED-Safe |
| A goal under the minimum | next to `71-target-goal-below-healthy-range-light.png` (derived) | type a goal under 40 kg and save: the caution card names the requested and the clamped value; frame 71 shows the height-based floor, which is not built |
| High Contrast, Settings | next to 14 (derived) | `increase_contrast enabled` |

## U-72e Scan (rows SC-01 to SC-07) — after PR 39

| Row | Frame | How |
|---|---|---|
| The viewfinder | `01-scan-viewfinder.png` | the Scan button; the camera of the Simulator shows no picture, so the capture uses the fixture: `--ccScanScenario <the fixture of the findings of U-72>` with `--ccFixtureCapture` |
| Analyzing | `02-scan-analyzing.png` | the fixture answers at once: capture what the client shows while a request is in flight, or a derived row that says the request has no stages |
| The review in light | `03-scan-review-light.png` | the fixture of the scan |
| The review in dark with an item that needs review | `04-scan-review-dark-item-needs-review.png` | the fixture that leaves an item unresolved, in dark |
| The review with ED-Safe on | `05-scan-review-ed-safe.png` | `--ccEDSafe` |
| The kcal rule (proof) | no frame | three taps on the plus of the first item: 464 kcal becomes 508 kcal |
| Saved | `06-scan-saved.png` | Save: the toast with Undo |
| Describe a meal, typing | `72-scansheets-describe-a-meal-typing-light.png`, `73-…-dark.png` | the Describe chip of the viewfinder; paste a text so the keyboard shows |
| Describe a meal, estimating | `74-scansheets-describe-a-meal-estimating-light.png` | after the send |
| Report a problem | `75-scansheets-report-a-problem-light.png`, `76-…-dark.png` | the menu of an item |
| Report saved | `77-scansheets-report-sent-light.png` | after "Save report": the sheet says the report is saved on this device; the row notes the difference with the title of the frame if there is one |
| High Contrast, the review | next to 03 (derived) | `increase_contrast enabled` |

## U-77ce Sign-in (row AU-01) — after PR 57

The e-mail code needs the API of this machine: the message of the owner gives the API slot with
it (`scripts/rn/start-api.sh`); the sender of the local API writes the code in its log.

| Row | Frame | How |
|---|---|---|
| The entry step in light | `61-auth-sign-in-light.png` | `--ccRequireSignIn` on a fresh install with a target, signed out |
| The entry step in dark | `62-auth-sign-in-dark.png` | `appearance dark` |
| The e-mail step | `108-auth-email-step-light.png`, `109-…-dark.png` | tap "Continue with email", type an address |
| The code could not be sent | `110-auth-code-could-not-be-sent-light.png`, `111-…-dark.png` | an address the API refuses, if it refuses one; otherwise derived with the reason |
| The code entry | `112-auth-code-entry-light.png`, `113-…-dark.png` | "Send code", then the six digits of the API log |
| A wrong code | `114-auth-wrong-or-expired-code-light.png`, `115-…-dark.png` | type a code that is not the one sent |
| The Apple button | part of 61 | on a Simulator without an Apple account the button is not drawn: the row says so |
| High Contrast, the entry step | next to 61 (derived) | `increase_contrast enabled` |

## Not in this catalog

Widgets and Live Activity (PL-11, PL-12) wait for U-78, a unit of the native slot. The app icon
(PL-17) waits for U-80.
