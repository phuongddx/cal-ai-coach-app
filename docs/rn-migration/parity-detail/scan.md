# Scan parity detail (U-30, restyled on Ember in U-72)

Per-row record of the scan flow port (`apps/mobile/src/features/scan`, route `apps/mobile/src/app/scan/index.tsx`).
Swift sources are under `native/App/Features/Scan/` (read in full). Test evidence is run by `npm test`.
Jest files are in `apps/mobile/src/features/scan/`: `scanKcalParity.test.ts`, `scanCapturePermission.test.tsx`,
`scanModelTransitions.test.ts` (46 cases), `scanScreens.test.tsx` (35), `scanCapture.test.ts` (9).
U-72 restyled every screen on Ember (frames in `docs/design/ember/frames`, Describe and Report frames from Designer round 3); see `findings/U-72.md`.

**Simulator evidence: not captured.** The machine has no iOS Simulator runtime and no devices
(`xcrun simctl list runtimes` and `list devices` print empty headers; `xcrun simctl runtime list`: 0 disk images).
Every "screenshot" cell below is therefore `not captured`; the proof is the Jest case. See `findings/U-30.md`.

## SC-01 State machine (ScanModel.swift, ScanFlowView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Starts in capture, no result | ScanModel.init | `scanModel.ts` | transitions: "starts in capture with no result" |
| analyze → analyzing, keeps thumb, opens re-entrancy gate | ScanModel.analyze | `scanModel.ts` | "analyze moves capture to analyzing, keeps the thumb and opens the gate"; "the re-entrancy gate ignores analyze while one is running" |
| 200 lands in review the moment the call settles. No checklist steps, no dwell timer, no watchdog (U-72: Ember frame has no step list; Swift's 0.5 s dwell is dropped, see findings) | ScanModel.analyze | `scanModel.ts` | "a 200 lands in review with the result and no step in between"; "analyzing without a timer: nothing advances by itself while the call is pending"; "a response lands in review the moment the call settles, without a dwell" |
| Only an envelope with code FREE_LIMIT_REACHED → quotaReached (the envelope's entitlement, or null when it carries none: no invented limit, U-72b); any other error, including a non-envelope error flagged quota, → failed(analysisFailure) | ScanModel.route | `scanModel.ts` | "a 402 surfaces immediately…"; "a FREE_LIMIT_REACHED envelope without an entitlement reaches quota with no entitlement…"; "only a FREE_LIMIT_REACHED envelope routes to quota…" |
| 404 → failed(barcodeNotFound); 422 and other errors → failed(analysisFailure) | ScanModel.analyze | `scanModel.ts` | "a 404 becomes…"; "a 422 becomes…"; "a non-API error…"; "a synchronous throw…" |
| cancelAnalyzing returns to capture; stale work cannot clobber | ScanModel.cancelAnalyzing, generation | `scanModel.ts` | "cancelAnalyzing…" (2), `cancelledAnalyzingStaysCancelledWhenStaleWorkCompletes`, `staleResumeCannotClobberANewAnalysis` |
| analyzeDescription (text scan) | ScanModel.analyzeDescription | `scanModel.ts` | "analyzeDescription sends the text as textDescription…" |
| receive builds ids by index; reportCaptureFailure; retry; retake; startNewScan | ScanModel | `scanModel.ts` | "receive builds ids…", "reportCaptureFailure…", "retry…", "retake…", "startNewScan…" |
| Displayed kcal recomputed from current grams (I6), negative grams clamp to 0 | ScanModel.setGrams, KcalArithmetic | `scanModel.ts` (`KcalArithmetic.mealKcal` from `@coachcal/core`) | `goldenParityAtFixtureGrams`, `editedGramsNeverEchoFixtureKcal`, `mealKcalIsSumOfRecomputedItemKcal`; "setGrams clamps…"; screens: `testGramsStepperRecomputesKcal` (464 kcal, three presses of `scan.grams.<id>.increment`, 508 kcal read from `scan.itemKcal.<id>`) |
| Unresolved item gates Save until resolved | ScanModel.captureCorrection | `scanModel.ts` | `unresolvedItemGatesSaveUntilResolved`; "captureCorrection records the note and clears the unresolved flag"; "captureCorrection keeps includePhoto only when it was turned on"; "removeItem…" (4 cases); screens: "Save is disabled while an item is unresolved", "Remove item drops an unresolved item, the total follows and Save opens" |
| Hidden-fat total (now a per-item line, no chip) | ScanModel | `scanModel.ts` | "the hidden-fat chip total is the recomputed kcal…" |
| Meal macros in whole grams from the current grams | ScanModel (added U-72) | `scanModel.ts` (`mealMacros`) | "mealMacros sums the macros of the current grams in whole grams" |
| Save = one `recordUpserts` then one `notify`; second tap ignored | ScanModel.save | `scanModel.ts`, `scanPersistence.ts` | `concurrentSaveTapsProduceExactlyOneBatch`, `saveEnqueuesOnePendingOpPerEntryAndUndoTombstones`; "save writes once, notifies once…"; screens: call log `['save','notify']` |
| Failed write keeps review open, Save retries | ScanModel.save | `scanModel.ts` | "a failed write keeps the review open and lets Save retry" |
| Undo = `recordTombstone` for every entry, details deleted, notify again, back to review; a second call while one runs does nothing | ScanModel.undo | `scanModel.ts`, `scanPersistence.ts` | "undo tombstones every saved entry…"; "a second undo while one is running tombstones each entry once"; screens: call log `['save','notify','notify']`; "save then undo on the real repositories…" |
| setMealSlot rejects a fifth slot; setDescribeText keeps the draft | ScanModel | `scanModel.ts` | "setMealSlot ignores…", "setDescribeText keeps the draft" |
| Phase → screen switch (text mode shows the Describe sheet instead of the analyzing screen) | ScanFlowView | `ScanFlowView.tsx` | screens: "switches to analyzing, review, and saved as the phase moves"; "text mode shows the describe sheet instead of the viewfinder" |
| Wiring: route builds dependencies; features hold no data/debug imports | (rule 19) | `app/scan/index.tsx` | grep in the PR report |

## SC-02 Capture viewfinder and camera service (CaptureViewfinderView.swift, CameraCaptureService.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Fixture seam always reports access granted | CameraCaptureService / FixtureCaptureService | `scanCapture.ts` | `testFixtureCaptureSeamAlwaysReportsAccessGranted` |
| Denied card renders copy and a Settings escape | CaptureViewfinderView | `CaptureViewfinderView.tsx` | `testDeniedPermissionCardRendersCopyAndSettingsEscape` |
| Granted state hides the card | CaptureViewfinderView | `CaptureViewfinderView.tsx` | `testGrantedStateHidesPermissionCard` |
| Viewfinder with the fixture feed | CaptureViewfinderView | `CaptureViewfinderView.tsx`, `assets/fixture-meal.png` | screens: "capture shows the viewfinder with the fixture feed"; screenshot not captured |
| Ember viewfinder: four mode chips (`scan.modePill.<value>`), glass close (`scan.close`), flip 44 pt and library 52 pt, no zoom readout, no flash (the capture seam has no torch) | CaptureViewfinderView | `CaptureViewfinderView.tsx` | screens: "the viewfinder offers the four mode chips, a close button and no zoom readout"; "the Describe chip opens the describe sheet and its close button returns to the camera" |
| Flip camera switches front/back (device passes `facing` to `CameraView`; fixture keeps the bundled feed and only records the switch) | CaptureViewfinderView.flipCamera, CameraService.flipCamera | `CaptureViewfinderView.tsx`, `scanCapture.ts` (`facing`, `flipCamera`) | capturePermission: "pressing Flip camera switches the fixture service…"; "the device viewfinder passes the new facing to the live CameraView" |
| Fixture capture: photo, label (uploads image), barcode, library | FixtureCaptureService | `scanCapture.ts` | scanCapture: first three cases |
| Device capture: permission, empty frame, 1024-wide JPEG at 0.7, library pick/cancel, barcode from photo, live barcode | CameraService | `scanCapture.ts` (expo-camera, expo-image-picker, expo-image-manipulator) | scanCapture: remaining cases; real camera not run |

Differences from Swift in SC-02 (intentional):

- Label hint copy: Swift's label mode said text is read automatically. RN says "Point at the nutrition label — the photo is analyzed to read it", because the photo is uploaded and analyzed server-side.
- Swift's library-pick label path ran OCR on the device and sent text; RN sends the image for both paths. The contract has no OCR-text label request.

## SC-03 Analyzing (AnalyzingView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| "Reading your plate", "Usually under 5 seconds", the photo thumb (`scan.analyzing.thumb`) and Cancel. No checklist rows (the frame has none) | AnalyzingView | `AnalyzingView.tsx` | screens: "shows the heading, the thumb and Cancel while analyzing, with no checklist"; screenshot not captured |
| Cancel returns to capture | AnalyzingView | `AnalyzingView.tsx` | screens: "Cancel returns to capture" |

## SC-04 Review sheet and quota (ReviewSheetView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Ember header (glass close, retake), confidence badge, total, macros (`scan.macros`), item cards with a grams pill (`scan.grams.<id>`) and a per-item hidden-fat line (`scan.hiddenFat.<id>`). The warning chip is gone | ReviewSheetView | `ReviewSheetView.tsx` | screens: "renders the review header, badge, total, macros and both ingredient rows"; screenshot not captured |
| Dark scheme | same | same | screens: "renders in dark scheme…"; screenshot not captured |
| ED-safe hides kcal and shows `EdSafeNote`, grams stay editable (components own the rule) | same | `EdSafeCollapse`, `EdSafeNote`, `EdSafeAlternate` in design | screens: "ED-safe hides every kcal figure and shows the note while the grams stay editable"; `grep -rnE "useEdSafeHidden\(|edSafeHidden\(|edSafeMode\(" apps/mobile/src/features/scan` prints nothing |
| Long title stays one line, editable | same | `ReviewSheetView.tsx` | screens: "keeps a long meal title editable on one line" |
| Grams pill opens the ruler editor (one open at a time); increment / decrement recompute kcal | same | same | screens: `testGramsStepperRecomputesKcal`; "tapping the grams pill of another item opens its editor and collapses the first" |
| Retake / Close | same | same | screens: "retake and close call back" |
| Save to chosen meal | same | same | screens: "Save to the chosen meal runs one save…" |
| Quota sheet on frames 17 / 56 (U-72b): backdrop, `Sheet`, close glass button, 64 pt tile, "You've used this week's N free scans", "Scans reset <weekday>. You can still log anything by search, barcode or description, for free.", dock "See plans" and "Log manually, free". N and the weekday come from the 402 entitlement; with none the sheet names no number and no day. "See plans" calls `onSeePlans` and the route opens `/plans`; the local plans sheet is gone | QuotaReachedView | `QuotaReachedView.tsx`, `app/scan/index.tsx`, `scanCopy.ts` (`resetWeekday`) | screens: "shows the quota copy from the server entitlement…", "the limit and the reset day come from the entitlement…", "without an entitlement the sheet names no number and no day", "See plans hands off to the route…", "Log manually hands off to the route", "the close button hands the close to the route" |
| Report sent: success-tint tile and success check, 520 pt sheet with the dock at the bottom (frame 77, look only; copy stays "noted") | CorrectionCaptureView | `CorrectionCaptureView.tsx` | screens: "Report a problem records the reason and note…" (tile tint) |
| 404 / 422 inline error cards | ScanErrorCard | `ScanFlowView.tsx`, `DescribeMealSheet.tsx` | screens: "a 404 barcode failure…", "a 422 failure…"; screenshots not captured |

## SC-05 Describe sheet (DescribeMealSheet.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| 500-character limit (RN clamps the field to 500 characters on the client with `slice`; Swift clamps only in the request schema), placeholder, helper line, length over 500 (`scan.describe.counter`), Estimate disabled until non-space text. No free-scans line until the server sends a limit | DescribeMealSheet | `DescribeMealSheet.tsx` | screens: "Estimate is disabled until the text has non-space characters"; "shows the helper line and the length over 500, and nothing about free scans" |
| Estimating state: field read-only, meal segment and card (`scan.describe.estimating`), dock says "Estimating…", Cancel keeps the text | same | same | screens: "while estimating the field is read-only, the dock says Estimating and Cancel keeps the text" |
| Submit sends the trimmed text | same | same | screens: "submits the trimmed description as a text scan" |
| Failure overlay, Back to description | same | same | screens: "a failure overlays the error card…" |
| Header X returns to the camera (`scan.describe.close`); no search icon, "Search manually" lives on the error card | same | same | screens: "the Describe chip opens the describe sheet and its close button returns to the camera"; "Search manually on the error card calls the route escape, and there is no search icon in the header" |
| Text mode shows the sheet | ScanFlowView | `ScanFlowView.tsx` | screens: "text mode shows the describe sheet…"; screenshot not captured |

## SC-06 Correction capture (CorrectionCaptureView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| "Report a problem" (`scan.fixIssue.<id>`) opens the sheet: item pills, five kinds (wrongFood, portionOff, notEaten, nutritionOff, other), direct fix first (grams editor, remove item), note, "Include the photo" off by default, sent state "Thanks, report noted". Nothing is transmitted (no report endpoint); the entry is not changed; the item stops being "Review needed" | CorrectionCaptureView | `CorrectionCaptureView.tsx` | screens: "Report a problem records the reason and note, leaves the item as it was, and confirms"; "the photo is not included in a report unless the toggle is turned on"; "Report a problem offers the direct fix first: Shouldn't be here removes the item"; "Report a problem on another item: the item pills retarget the report and Wrong amount offers the grams editor"; screenshot not captured |

## SC-07 Saved screen (ScanSavedView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Ember Saved screen replaces the toast and peek: "Saved to <Meal>" (`scan.savedToast`), kcal added, "Today so far" card, Undo (`toast:undo`), Scan another (`scan.addMore`), View diary (`scan.viewDiary`) | ScanSavedView | `ScanSavedView.tsx` | screens: "shows the saved screen with the dish and kcal, the today card, Undo and both actions"; screenshot not captured |
| Undo tombstones and notifies, a second press does nothing more | same | same | screens: "Undo tombstones the entries and notifies again, and a second press does nothing more" |
| View diary closes; Scan another starts a new scan | same | same | screens: "View diary and Add more call back; Add more starts a new scan" |
| ED-safe shows the dish without kcal and drops the today card | same | same | screens: "ED-safe shows the dish without kcal and drops the today card" |
| First-log streak card only when streak is 1 | same | same | transitions: "save writes once… streak" |

## PL-12 Live Activity port (start, update, end)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Starts after save with calories remaining and the ED-safe flag | ScanModel.startLiveActivity | `scanModel.ts`, `scanActivity.ts` (no-op) | transitions: "the Live Activity starts after the save…" |
| Ends when its lifetime runs out | ScanModel | same | "the Live Activity ends itself when its lifetime runs out" |
| Refused activity is silent | ScanModel | same | "a refused Live Activity is silent" |
| `update` unused by the model (as in Swift) | — | `scanActivity.ts` | — |
| Native implementation | CoachCalLiveActivityAttributes | none | U-43 |

## DB-01 (Today after save, quit, relaunch)

Not captured (no Simulator runtime). Jest covers the repository write path: "save then undo on the real repositories
leaves the same single-call write" (sql.js). The `expo-sqlite` device path is still unevidenced.

## U-72 identifier changes

Added: `scan.modePill.<value>`, `scan.close` (viewfinder), `scan.describe.close`, `scan.describe.counter`,
`scan.describe.estimating`, `scan.describe.meal`, `scan.describe.sheet`, `scan.removeItem.<id>`, `scan.item.<id>`,
`scan.hiddenFat.<id>`, `scan.macros`, `scan.edSafeNote`, `scan.grams.<id>.ruler`, `scan.header`,
`scan.thumb.placeholder`, `scan.correction.item.<id>`, `scan.correction.fixNow`, `scan.correction.includePhoto`,
`scan.correction.sentTitle`, `scan.correction.back`.

Removed: `scan.zoom`, `scan.checklist`, `scan.step.<step>`, `scan.warningChip`, `scan.describe.search`,
`ccstepper.*` / `stepper:<name>` on Review, `chip-option:*` in the correction sheet, and the old toast / peek structure.

Unchanged: `scan.fixIssue.<id>`, `scan.correction.sheet`, `scan.correction.close`, `scan.correction.note`,
`scan.correction.save`, `scan.correction.kind.<kind>`, `scan.grams.<id>` (now the collapsed pill),
`scan.itemKcal.<id>`, `scan.analyzing`, `scan.cancel`, `scan.describeTitle`, `scan.describeField`,
`scan.describeSubmit`, `scan.quota*`.
