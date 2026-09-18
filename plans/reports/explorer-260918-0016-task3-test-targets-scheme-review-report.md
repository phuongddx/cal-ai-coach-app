# Task 3 Review: `Project.swift` — test targets + scheme

**Range reviewed:** `de16a2f..997e891` (3 commits: `c1d8e5f` gitignore, `9a3414b` Project.swift, `997e891` plan-doc update)
**Branch/worktree:** `tuist-migration-ci` @ `.worktrees/tuist-migration-ci`
**Method:** independent re-verification (not trust of implementer/controller claims) — ran `tuist generate`, inspected the generated `.pbxproj`/`.xcscheme` directly, and ran `tuist test` myself against a live simulator to confirm real build/link/run.

## Spec Compliance

Compared `native/Project.swift`'s new targets/scheme against `git show d70b4a9:native/project.yml`'s `CoachCalTests`/`CoachCalUITests`/`schemes:` block.

| Aspect | project.yml (original) | Project.swift (new) | Verdict |
|---|---|---|---|
| `CoachCalTests` sources | `App/CoachCalTests`, `CoachCalWidget/CaloriesRemainingTimelineProvider.swift` | identical | ✅ match |
| `CoachCalUITests` sources | `App/CoachCalUITests` | identical | ✅ match |
| Bundle IDs | `.unit-tests` / `.tests` | identical | ✅ match |
| ViewInspector / SnapshotTesting deps | on `CoachCalTests` | identical | ✅ match |
| `UI_TESTING=YES` | on `CoachCalUITests` | identical | ✅ match, confirmed in generated pbxproj (`UI_TESTING = YES;` at both Debug/Release configs) |
| `TEST_HOST`/`BUNDLE_LOADER` (unit tests) | explicit in project.yml | **not declared** in Project.swift — relies on Tuist's automatic host-app wiring via the `.target(name: "CoachCal")` dependency | ✅ **works, independently verified** — `grep TEST_HOST\|BUNDLE_LOADER` on the generated pbxproj shows both correctly auto-wired to `$(BUILT_PRODUCTS_DIR)/CoachCal.app/.../CoachCal` for both Debug/Release. Neither the implementer's report nor the ledger checked this explicitly — it was an unverified assumption that happened to be correct, not a verified one. See Issues/Important. |
| `TEST_TARGET_NAME` (UI tests) | explicit `CoachCal` | not declared, auto-wired via `.uiTests` product + `.target(name: "CoachCal")` dependency | ✅ confirmed present (`TEST_TARGET_NAME = CoachCal;`) in generated pbxproj |
| `GENERATE_INFOPLIST_FILE=YES` | explicit | replaced by `infoPlist: .default` (Tuist's own generated-Info.plist mechanism, `Derived/InfoPlists/CoachCal{Tests,UITests}-Info.plist`) | ✅ functionally equivalent, not a regression — corroborated by the `native/.gitignore` commit (`c1d8e5f`) adding `Derived/`, which is exactly where these generated plists land |
| Scheme test-action env vars (`TEST_EMAIL`/`TEST_PASSWORD`/`SUPABASE_ANON_KEY`) + "must be scheme-level, not shell-level" rationale | `schemes.CoachCal.test.environmentVariables` with explanatory comment | `arguments: .arguments(environmentVariables:)` on the `.targets(...)` test action, comment preserved and updated to explain the API-shape deviation | ✅ **verified in the actual generated `CoachCal.xcscheme`**: the three vars appear inside `<TestAction>/<EnvironmentVariables>`, not `<LaunchAction>` and not read from shell — same placement/semantics as the original |
| Manual signing preserved (the "same trap Task 2 hit") | N/A (XcodeGen never had this bug) | `CODE_SIGN_IDENTITY` explicitly set on both new test targets | ✅ **verified independently**: `grep -c '"iPhone Developer"' CoachCal.xcodeproj/project.pbxproj` → `0`. Implementer's account of catching/fixing the trap is accurate. |

**Build/run verification (the task's actual bar — "compile, link, and run without a build/wiring error"):**
- `tuist generate --no-open` — succeeds cleanly.
- Ran `tuist test CoachCal -- -destination "platform=iOS Simulator,name=iPhone 17 Pro" CODE_SIGNING_ALLOWED=NO` myself (not just re-reading the claim): it built, linked, launched the simulator, and executed real `CoachCalTests` (Swift Testing) and `CoachCalUITests` (XCTest) suites — dozens of suites ran with genuine pass/fail content results (snapshot mismatches, a `.missingConfiguration` sync-proof test, a live-Supabase-credential UI test — all pre-existing/unrelated-to-migration, exactly as the ledger describes). No "unable to resolve module dependency" error at any point. I stopped the run partway through (after ~9 min, having already reached the point the task requires proof of) to keep this a read-only review; confirmed via `git status`/snapshot-dir hash diff that stopping it early left no additional working-tree mutation.
- Independently re-ran `tuist xcodebuild build-for-testing -scheme CoachCal -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO`: fails with the identical `unable to resolve module dependency: 'CoachCalCore'` in `CoachCalWidget`, confirming the plan-doc commit's (`997e891`) claim that `tuist xcodebuild` (a thin xcodebuild passthrough) inherits the same failure is accurate and checkable, not a hand-wave.

**Conclusion: the implementation matches spec intent and the `997e891` doc update's factual claims hold up under independent re-verification.**

## Strengths
- Manual-signing trap explicitly anticipated by the task brief was actually checked (not just recalled from Task 2) and fixed with the same identity string used elsewhere — consistent, not copy-drifted.
- The scheme-level (not shell-level) placement of the three test env vars — the one piece of the original project.yml with an explicit "why" comment — was preserved with an accurate, updated comment explaining exactly why the plan's literal draft code didn't compile and what the real fix is.
- The `native/.gitignore` commit is a minimal, correctly-scoped consequence of `infoPlist: .default` generating `Derived/InfoPlists/*.plist`, not scope creep.
- The plan-doc commit's claims (`tuist xcodebuild` also fails) are concrete, falsifiable, and — checked — true.

## Issues

#### Critical (Must Fix)
None found.

#### Important (Should Fix)
- **TEST_HOST/BUNDLE_LOADER/TEST_TARGET_NAME auto-wiring was never actually checked by the implementer or controller.** Both the task-3-report.md and progress.md ledger are silent on this — the report only mentions the signing trap and the `TestAction` API-shape issues, and Step 2's "Expected: `** TEST BUILD SUCCEEDED **`" check from the plan was itself abandoned (build-for-testing fails for the unrelated widget-module reason, so it never ran long enough to prove test-host wiring either). It happened to work (I verified the pbxproj directly), but the plan brief specifically flagged this as an open question ("does relying on Tuist's automatic host-app wiring actually work, or was this dropped without verification?") and the answer that shipped was "it works" without evidence in the artifacts, not "verified working." Recommend amending task-3-report.md (or a follow-up note) to record the actual verification method now that it exists, so a future re-read of the report doesn't have to re-derive it from scratch.

#### Minor (Nice to Have)
- The report's "Unresolved / handed to next task" section says Task 4 needs to verify `tuist test` doesn't hit the module-resolution failure — this was already answered affirmatively during Task 3 itself per the ledger and my own re-run, so that line in task-3-report.md is now stale relative to the ledger's own claim of having "definitively resolved" it. Not incorrect, just slightly out of sync with the more authoritative progress.md; harmless since Task 4 will re-derive it anyway.

## Assessment
**Task quality:** Approved
**Reasoning:** Spec compliance holds on every checked axis (sources, bundle IDs, deps, signing, scheme env-var placement, auto-wired TEST_HOST/TEST_TARGET_NAME), and I independently reproduced both the "tuist test reaches real test execution" success and the "raw/passthrough xcodebuild still fails identically" claims rather than trusting the reports. The one gap (unverified-but-correct auto-wiring assumption) is a documentation/rigor gap, not a functional defect.

## Unresolved Questions
None.
