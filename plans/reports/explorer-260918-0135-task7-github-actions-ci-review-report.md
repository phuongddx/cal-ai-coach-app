# Task 7 Review: GitHub Actions CI Workflow (tuist-migration-ci, final task)

**Base:** 4c4e678 · **Head:** 698b59f (HEAD, branch `tuist-migration-ci`) · Reviewed 2026-09-18 01:35–02:05 ICT.

### Spec Compliance

`.github/workflows/ci.yml` (68 lines, diff `review-4c4e678..698b59f.diff`) is a **byte-for-byte match** of the plan's patched Task 7 YAML (`docs/superpowers/plans/2026-09-17-tuist-migration-github-actions-ci.md`, "### Task 7" section):
- Triggers: `push` / `pull_request` / `workflow_dispatch`, no branch filters — matches.
- `runs-on: macos-26` — matches; empirically valid (the run queued and ran on this label with no queue delay).
- `xcode-select -s /Applications/Xcode_26.6.app` — matches.
- Tuist install with `command -v` guard + `brew install` — matches.
- Cache step: same path list (`native/.tuist`, `~/.tuist`), same key `${{ runner.os }}-tuist-${{ hashFiles('native/Tuist/Package.resolved') }}`, same restore-keys — matches.
- `tuist install` → `tuist generate --no-open` → per-module `swift test` loop skipping `CoachCalDesignSystem` → `tuist test CoachCal --no-selective-testing -- -destination "$destination" CODE_SIGNING_ALLOWED=NO` with the same inline comments — matches, including the "DISCOVERED DURING EXECUTION (Task 3)" comment carried over verbatim.

No drift, no extra steps, no omitted steps.

**Branch safety:** `git log main..HEAD --oneline` (run from the worktree) lists 14 commits ending at `698b59f`, HEAD is `tuist-migration-ci`, not `main`. Push target confirmed as the feature branch; `main` is untouched. Consistent with the implementer's report ("Did not merge to or touch main").

### Live CI status (as of my check)

Run `35256900114` (`gh run view 35256900114 --repo phuongddx/cal-ai-coach-app`), polled at hand-off time and again ~5 min later:

- **Completed. Conclusion: `failure`.**
- Steps 1–8 (Set up job → Test local Swift packages): all `success`, ~7m23s total (18:07:37–18:15:00 UTC).
- Step 9, "Build and test CoachCal app": `failure`, ran 18:15:00–18:38:53 UTC (**23m53s**), total job wall time **31m22s**. This is plausible for a cold macOS runner's first Sentry+GRDB+Supabase+widget compile plus a full `tuist test` sweep (build succeeded — `xcodebuild` log shows "Testing started" at 18:18:01 and real test execution for ~20.7 min; this is not a build/compile failure).
- **Root cause of the failure is test *content*, not the workflow or the build graph:**
  - Multiple suites fail with `Caught error: .missingConfiguration` (`CrossUserDenialProof`, `OfflineReconnectProof`, `OnlineLatencyProof`, `RealAuthConvergenceProof`, `ReplayIdempotencyProof`, `E2ESyncConvergenceTests`) — the workflow sets **no env vars at all** (`grep env: ci.yml` → nothing), so `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`TEST_EMAIL`/`TEST_PASSWORD` are unset. This is exactly the "pre-existing environment-gating condition, not a regression" case the plan itself calls out at line ~427/431 of the plan doc (tests literally named `...ConvergesOnRealSupabase` need real credentials the plan says won't be set in CI/local ad-hoc runs).
  - Snapshot suites (`EdSafeSweepSnapshotTests`, `OnboardingSnapshotTests`, `ProgressSnapshotTests`, `ScanSnapshotTests`, `TodayDiarySnapshotTests`, `WidgetSnapshotSnapshotTests`) fail — also explicitly anticipated by the plan as "simulator/OS-version-sensitive."
  - `AccessibilityAuditTests.testCoreScreensPassCuratedAccessibilityAudit` fails with `Invalid target app 33726` — an accessibility-audit/simulator plumbing issue, not a migration defect.
  - 16 other test groups report **0 failures** (e.g. `FoodSearchTests` 5/5, `MainShellSmokeTests` 2/2, the long-running `EdSafeTests` 1/1 at 142.9s) — the app/widget/package build and most functional tests genuinely pass.
  - **83 individual failing-test lines** in the final report, but per the plan's own triage rule (line 431: distinguish "fails to build/wire" [must be zero — it is zero here] from "fails because a specific test needs credentials/exact snapshot baseline" [pre-existing, not a regression]), none of the observed failures fall in the blocking category.
- Net effect: the workflow, as literally specified by the plan, will fail on essentially every push today, because it runs the full `tuist test CoachCal` surface (including live-Supabase-dependent and snapshot suites) with zero secrets/env configured and no baseline snapshots committed for the `macos-26` simulator. That's a real, currently-true fact about the CI's signal quality — flagged below since it affects whether "the workflow passes" is achievable, even though it's not an implementer deviation from Task 7's literal spec.

### Strengths
- Task 7 output is an exact match to the plan's patched YAML — no scope creep, no missed steps, no silent edits.
- Correctly used `tuist test`/`tuist generate`, not raw `xcodebuild`, consistent with the hard-won Task 3 finding carried through the whole plan.
- Cache key (`hashFiles('native/Tuist/Package.resolved')`) is sensible: invalidates on dependency-lock changes, `restore-keys` gives a same-OS fallback on a cache miss for warm-start speed.
- Per-module `swift test` loop correctly skips `CoachCalDesignSystem` (consistent with earlier tasks' finding that it's an iOS-only SwiftUI package not exercisable via plain `swift test`).
- Implementer's report is honest about the unresolved state at hand-off (in-progress, not assumed green) rather than claiming success prematurely.

### Issues

#### Critical (Must Fix)
- None in the Task 7 diff itself — the workflow file matches spec exactly and the build/test-wiring goal (Task 3/7's actual scope) is proven: zero module-resolution or build failures.

#### Important (Should Fix)
- **No `timeout-minutes` on the `build-and-test` job.** GitHub's default job timeout is 360 minutes; this run already needed ~31 min cold, and the final `tuist test` step alone ran ~24 min. A future hang (e.g. simulator boot stall, a genuinely hung UI test) could consume runner minutes for up to 6 hours before GitHub kills it, with no earlier signal. Recommend `timeout-minutes: 45–60` on the job (or a smaller value on the "Build and test CoachCal app" step specifically) now that a real cold-run baseline (~31 min) exists.
- **CI is not actually green-able as configured**, independent of this task's spec compliance: `tuist test CoachCal --no-selective-testing` with no `env:`/secrets block will always fail the Supabase-credentialed suites, and no baseline snapshots exist for the `macos-26` runner's simulator, so snapshot suites will always fail too. If the intent of this CI job is "gate merges on green," it currently cannot succeed without either (a) injecting `SUPABASE_ANON_KEY`/`TEST_EMAIL`/`TEST_PASSWORD` via repo secrets and pointing at a real (or CI-dedicated) Supabase project, (b) excluding live-dependency/snapshot test targets from the CI test plan/scheme, or (c) both. This is a plan-level gap (the plan explicitly deferred this exact question to "Task 4's job to triage," and Task 4 was scoped as an ad-hoc local run, not this CI job) rather than something the Task 7 implementer introduced, but it's worth surfacing before this workflow is treated as a real gate.

#### Minor (Nice to Have)
- No `concurrency:` group, so back-to-back pushes to the same branch will run overlapping ~30 min macOS jobs rather than canceling the stale one — wastes runner minutes on rapid iteration. Not required by the plan's spec, but cheap to add (`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`).
- The `resolved_name` simulator-name sniff (`xcrun simctl list devices available | grep -m1 -o 'iPhone [^(]*' ...`) picks whatever simulator happens to sort first on the runner image; on a shared GitHub-hosted image this is usually stable but is implicit rather than pinned. Matches the plan exactly, so not a deviation — just an observation for future hardening.

### Assessment
**Task quality:** Approved (implementation) — CI health flagged separately, not a Task 7 defect.
**Reasoning:** The workflow file is an exact, unmodified match to the plan's Task 7 spec, correctly uses `tuist` orchestration, and empirically proves what Task 7 needed to prove (build succeeds, test execution is reached, no module-resolution regressions — zero failures in that category). The observed live-run `failure` conclusion is entirely inside the "environment-gated / pre-existing, not a migration regression" bucket the plan itself defined (missing Supabase credentials, simulator-sensitive snapshots, one accessibility-audit plumbing issue) — not a Task 7 implementation bug. The one actionable gap worth fixing before relying on this as a merge gate is adding `timeout-minutes`, and separately (at the plan level, not this task) deciding how the CI job should handle credentialed/snapshot-sensitive tests so it can ever report green.

## Unresolved Questions
- Should CI secrets (`SUPABASE_ANON_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`) be provisioned against a dedicated CI Supabase project, or should the CI test invocation exclude live-dependency/snapshot suites via a dedicated test plan/scheme? Not decided by the plan or by Task 7.
- Is there an existing snapshot baseline captured on a `macos-26`-equivalent simulator anywhere in the repo, or do all snapshot tests need re-recording for this OS/Xcode combination?
- Should `timeout-minutes` be added to the job now, or deferred to a follow-up CI-hardening task?
