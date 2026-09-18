# Task 2 Fix Round 1 Re-Verification — Tuist Migration CI

Diff: 830dade..de16a2f (1 commit, native/Project.swift only, +19/-0)

## Finding Verdicts

**Finding 1 (CODE_SIGN_IDENTITY overridden by Tuist target defaults) — RESOLVED.**
- Diff adds explicit `"CODE_SIGN_IDENTITY": "iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)"` to both `appSettings` (CoachCal target) and the inline widget settings dict (CoachCalWidget target).
- Independently regenerated (`tuist generate --no-open`) and grepped the produced `project.pbxproj`:
  - `"iPhone Developer"` → 0 occurrences (was previously injected by Tuist's `.recommended` default at target scope).
  - `CODE_SIGN_IDENTITY` → 6 occurrences, all `"iPhone Distribution: Doan Duy Phuong (K2TYLYAWMK)"`: 2 at project scope (projectBaseSettings, Debug+Release) + 2 at CoachCal target (Debug+Release) + 2 at CoachCalWidget target (Debug+Release). Matches the project's only two real targets (no test targets exist in this Project.swift yet — those land in Task 3).
  - `CODE_SIGN_STYLE` / `DEVELOPMENT_TEAM` still only appear at project scope (2 each) and are not duplicated at target scope — confirms Tuist's default injection is specific to `CODE_SIGN_IDENTITY` and the fix didn't need to touch those two keys.

**Finding 2 (PrivacyInfo.xcprivacy dropped from bundle) — RESOLVED.**
- Diff adds `"App/CoachCal/SupportingFiles/PrivacyInfo.xcprivacy"` to the CoachCal target's `resources:` array.
- Grepped the regenerated pbxproj: `PrivacyInfo.xcprivacy` → 4 occurrences (PBXBuildFile, PBXFileReference, PBXGroup entry, PBXResourcesBuildPhase entry) — all under the CoachCal app target, none under the widget target (correct scope; the finding was specifically about the app bundle).
- Went further than a static grep: ran `tuist build CoachCal -- -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO` and confirmed the build log actually shows `[CoachCal] Copying PrivacyInfo.xcprivacy` during the resources-copy phase, i.e. the file lands in the built `.app`, not just referenced in the project file.

**Build regression check — PASS.** Full `tuist build` (app + widget + all 5 local SPM modules + third-party deps) succeeded: `Build Succeeded` / `✔ Success — The project built successfully`.

## New Breakage in the Fix Diff

None found. The diff is purely additive (3 new `SettingsDictionary` entries + 1 new resources array entry + explanatory comments); it doesn't touch sources, dependencies, entitlements, or any other target. No new "iPhone Developer" or missing-resource regressions introduced, no unrelated key changes.

## Out-of-Scope Observations (non-blocking, unrelated to these 2 findings)

- Build emits pre-existing warnings unrelated to this diff: `'nonisolated(unsafe)' has no effect on property '...'` in `AppEnvironment.swift`, `CoachFlow.swift`, `DiaryDayModel.swift`, `OnboardingModel.swift`, `ProfileFlow.swift`, `ProgressFlow.swift`, `TodayModel.swift` (Swift 6 language-mode nuance, should use plain `nonisolated`) — none of these files are touched by the fix diff.
- Build emits `Accent color 'AccentColor' is not present in any asset catalogs` — pre-existing asset-catalog gap, unrelated to signing/privacy-manifest.
- CoachCalWidget has no `PrivacyInfo.xcprivacy` entry of its own. Not in scope for this finding (which was specifically about the app bundle dropping its manifest), but worth flagging to the plan owner if the widget extension collects data types requiring its own privacy manifest under current App Store rules — a future task/finding, not a regression from this diff.
- `tuist build` prints a deprecation warning recommending `tuist xcodebuild build` instead — already flagged by the controller's own Ruling B in the ledger for Task 3 to address; not new.

## Verdict

**Fix round:** All findings addressed, no new Critical/Important breakage.
