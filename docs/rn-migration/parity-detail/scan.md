# Scan parity detail (U-30)

Per-row record of the scan flow port (`apps/mobile/src/features/scan`, route `apps/mobile/src/app/scan/index.tsx`).
Swift sources are under `native/App/Features/Scan/` (read in full). Test evidence is run by `npm test`.
Jest files are in `apps/mobile/src/features/scan/`: `scanKcalParity.test.ts`, `scanCapturePermission.test.tsx`,
`scanModelTransitions.test.ts` (37 cases), `scanScreens.test.tsx` (26), `scanCapture.test.ts` (9).

**Simulator evidence: not captured.** The machine has no iOS Simulator runtime and no devices
(`xcrun simctl list runtimes` and `list devices` print empty headers; `xcrun simctl runtime list`: 0 disk images).
Every "screenshot" cell below is therefore `not captured`; the proof is the Jest case. See `findings/U-30.md`.

## SC-01 State machine (ScanModel.swift, ScanFlowView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Starts in capture, no result | ScanModel.init | `scanModel.ts` | transitions: "starts in capture with no result" |
| analyze → analyzing(detecting), keeps thumb, opens re-entrancy gate | ScanModel.analyze | `scanModel.ts` | "analyze moves capture to analyzing(detecting)…"; "the re-entrancy gate ignores analyze while one is running" |
| 200 plays three steps (0.5 s dwell) then review | ScanModel.analyze | `scanModel.ts` | "a 200 plays the three checklist steps and lands in review with the result" |
| 4th step only after the 5 s watchdog | ScanModel.analyze | `scanModel.ts` | "a call that outlasts the escalation budget shows the fourth step before review" |
| 402 → quotaReached with entitlement, free-tier fallback | ScanModel.analyze | `scanModel.ts` | "a 402 surfaces immediately…"; "a quota error without an entitlement falls back…" |
| 404 → failed(barcodeNotFound); 422 and other errors → failed(analysisFailure) | ScanModel.analyze | `scanModel.ts` | "a 404 becomes…"; "a 422 becomes…"; "a non-API error…"; "a synchronous throw…" |
| cancelAnalyzing returns to capture; stale work cannot clobber | ScanModel.cancelAnalyzing, generation | `scanModel.ts` | "cancelAnalyzing…" (2), `cancelledAnalyzingStaysCancelledWhenStaleWorkCompletes`, `staleResumeCannotClobberANewAnalysis` |
| analyzeDescription (text scan) | ScanModel.analyzeDescription | `scanModel.ts` | "analyzeDescription sends the text as textDescription…" |
| receive builds ids by index; reportCaptureFailure; retry; retake; startNewScan | ScanModel | `scanModel.ts` | "receive builds ids…", "reportCaptureFailure…", "retry…", "retake…", "startNewScan…" |
| Displayed kcal recomputed from current grams (I6), negative grams clamp to 0 | ScanModel.setGrams, KcalArithmetic | `scanModel.ts` (`KcalArithmetic.mealKcal` from `@coachcal/core`) | `goldenParityAtFixtureGrams`, `editedGramsNeverEchoFixtureKcal`, `mealKcalIsSumOfRecomputedItemKcal`; "setGrams clamps…"; screens: "three grams increments recompute…" (320→350 g, "508 kcal") |
| Unresolved item gates Save until resolved | ScanModel.captureCorrection | `scanModel.ts` | `unresolvedItemGatesSaveUntilResolved`; "captureCorrection records the note…"; screens: "Save is disabled while an item is unresolved" |
| Hidden-fat chip total | ScanModel | `scanModel.ts` | "the hidden-fat chip total is the recomputed kcal…" |
| Save = one `recordUpserts` then one `notify`; second tap ignored | ScanModel.save | `scanModel.ts`, `scanPersistence.ts` | `concurrentSaveTapsProduceExactlyOneBatch`, `saveEnqueuesOnePendingOpPerEntryAndUndoTombstones`; "save writes once, notifies once…"; screens: call log `['save','notify']` |
| Failed write keeps review open, Save retries | ScanModel.save | `scanModel.ts` | "a failed write keeps the review open and lets Save retry" |
| Undo = `recordTombstone` for every entry, details deleted, notify again, back to review | ScanModel.undo | `scanModel.ts`, `scanPersistence.ts` | "undo tombstones every saved entry…"; screens: call log `['save','notify','notify']`; "save then undo on the real repositories…" |
| setMealSlot rejects a fifth slot; setDescribeText keeps the draft | ScanModel | `scanModel.ts` | "setMealSlot ignores…", "setDescribeText keeps the draft" |
| Phase → screen switch | ScanFlowView | `ScanFlowView.tsx` | screens: "switches to analyzing, review, and saved as the phase moves" |
| Wiring: route builds dependencies; features hold no data/debug imports | (rule 19) | `app/scan/index.tsx` | grep in the PR report |

## SC-02 Capture viewfinder and camera service (CaptureViewfinderView.swift, CameraCaptureService.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Fixture seam always reports access granted | CameraCaptureService / FixtureCaptureService | `scanCapture.ts` | `testFixtureCaptureSeamAlwaysReportsAccessGranted` |
| Denied card renders copy and a Settings escape | CaptureViewfinderView | `CaptureViewfinderView.tsx` | `testDeniedPermissionCardRendersCopyAndSettingsEscape` |
| Granted state hides the card | CaptureViewfinderView | `CaptureViewfinderView.tsx` | `testGrantedStateHidesPermissionCard` |
| Viewfinder with the fixture feed | CaptureViewfinderView | `CaptureViewfinderView.tsx`, `assets/fixture-meal.png` | screens: "capture shows the viewfinder with the fixture feed"; screenshot not captured |
| Fixture capture: photo, label (uploads image), barcode, library | FixtureCaptureService | `scanCapture.ts` | scanCapture: first three cases |
| Device capture: permission, empty frame, 1024-wide JPEG at 0.7, library pick/cancel, barcode from photo, live barcode | CameraService | `scanCapture.ts` (expo-camera, expo-image-picker, expo-image-manipulator) | scanCapture: remaining cases; real camera not run |

## SC-03 Analyzing (AnalyzingView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Headings, 160 pt thumb with shimmer, three rows (check / spinner / idle), Cancel | AnalyzingView | `AnalyzingView.tsx` | screens: "shows the headings, the thumb, three checklist rows and Cancel while detecting"; screenshot not captured |
| Cancel returns to capture | AnalyzingView | `AnalyzingView.tsx` | screens: "Cancel returns to capture" |
| 4th row only when escalated | AnalyzingView | `AnalyzingView.tsx` (`visibleSteps`) | transitions 4th-step case |

## SC-04 Review sheet and quota (ReviewSheetView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Header, badge, total, warning chip, ingredient rows | ReviewSheetView | `ReviewSheetView.tsx` | screens: "renders the review header, badge, total, warning chip and both ingredient rows"; screenshot not captured |
| Dark scheme | same | same | screens: "renders in dark scheme…"; screenshot not captured |
| ED-safe hides kcal, grams stay (components own the rule) | same | `EdSafeCollapse.tsx` + design hooks | screens: "ED-safe hides every kcal figure…"; `grep -rn "edSafe" apps/mobile/src/features` prints nothing |
| Long title stays one line, editable | same | `ReviewSheetView.tsx` | screens: "keeps a long meal title editable on one line" |
| Stepper edits grams, kcal recomputed | same | same | screens: "three grams increments…" |
| Retake / Close | same | same | screens: "retake and close call back" |
| Save to chosen meal | same | same | screens: "Save to the chosen meal runs one save…" |
| Quota card: reset date, See plans, Log manually | QuotaReachedView | `QuotaReachedView.tsx` | screens: "shows the quota copy…", "See plans opens…" |
| 404 / 422 inline error cards | ScanErrorCard | `ScanFlowView.tsx`, `DescribeMealSheet.tsx` | screens: "a 404 barcode failure…", "a 422 failure…"; screenshots not captured |

## SC-05 Describe sheet (DescribeMealSheet.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| 500-character limit, placeholder, Analyze disabled until non-space text | DescribeMealSheet | `DescribeMealSheet.tsx` | screens: "Analyze description is disabled until…" |
| Submit sends the trimmed text | same | same | screens: "submits the trimmed description as a text scan" |
| Failure overlay, Back to description | same | same | screens: "a failure overlays the error card…" |
| Search icon escape | same | same | screens: "the search icon calls the route escape" |
| Text mode shows the sheet | ScanFlowView | `ScanFlowView.tsx` | screens: "text mode shows the describe sheet…"; screenshot not captured |

## SC-06 Correction capture (CorrectionCaptureView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Issue kind grid (default wrongFood), note field, Save note | CorrectionCaptureView | `CorrectionCaptureView.tsx` | screens: "Fix Issue opens the correction sheet and Save note marks the item Fix noted"; screenshot not captured |

## SC-07 Saved screen (ScanSavedView.swift)

| Behavior | Swift source | TS file | Proof |
|---|---|---|---|
| Toast "Saved to <Meal>", kcal added, Today so far peek, quick actions | ScanSavedView | `ScanSavedView.tsx` | screens: "shows the toast with the saved kcal, the today peek, and the quick actions"; screenshot not captured |
| Undo tombstones and notifies | same | same | screens: "Undo hides the toast and tombstones the entries, notifying again" |
| View diary closes; Add more starts a new scan | same | same | screens: "View diary and Add more call back…" |
| ED-safe collapses the peek | same | same | screens: "ED-safe collapses the today peek" |
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
