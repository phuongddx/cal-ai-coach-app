# Task 5 Review: Remove XcodeGen artifacts

**Worktree:** `.worktrees/tuist-migration-ci` (branch `tuist-migration-ci`)
**Diff reviewed:** `997e891..7cad160`
**Report reviewed:** `.superpowers/sdd/2026-09-17-tuist-migration-github-actions-ci/task-5-report.md`

### Spec Compliance

Plan section "### Task 5: Remove XcodeGen artifacts" (plan line 437) specifies exactly three steps:
1. `git rm project.yml Package.resolved`
2. Regenerate from a clean state (`rm -rf CoachCal.xcodeproj && tuist generate --no-open`) to confirm nothing depends on the deleted files
3. Commit

The actual diff (`review-997e891..7cad160.diff`) deletes exactly two files — `native/project.yml` (155 lines) and `native/Package.resolved` (78 lines) — 233 deletions, 0 additions, 0 other files touched. `git diff 997e891..7cad160 --stat` independently confirms the same two-file, 233-deletion stat. **Matches the plan exactly — nothing extra touched.**

The implementer's report claims Step 2 (clean regenerate) and a build both succeeded. I independently re-ran the equivalent verification myself (sandbox required `python3 shutil.rmtree` in place of `rm -rf`, same substitution the implementer's report notes it made for the same reason):

```
cd native && python3 -c "shutil.rmtree('CoachCal.xcodeproj')"
tuist generate --no-open   → ✔ Success, Project generated. (Total time 1.062s)
tuist build CoachCal -- -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO
   → Build Succeeded / ✔ Success — The project built successfully
```

Only pre-existing, unrelated warnings appeared (AccentColor asset-catalog warning, `'nonisolated(unsafe)' has no effect` in `AppEnvironment.swift`/`App/Features/**`) — same set the implementer's report lists, none caused by this diff.

`git status --short` was empty both before and after running the verification commands (checked with `--ignored=matching` too — the only `!!` entries are the pre-existing gitignored `.xcodeproj`/`.xcworkspace`/`.build`/`Derived` artifacts). `HEAD` remained at `7cad160` throughout. **The 71 dirty snapshot PNGs the implementer's report mentioned as pre-existing/unstaged are no longer present in the working tree** — the tree is fully clean now, so that leftover from Task 4 evidently got reconciled elsewhere (out of scope for this review; not a Task 5 problem either way, and it doesn't affect Task 5's diff or verification).

### Strengths

- Diff is a pure, minimal two-file deletion exactly matching the plan — no scope creep.
- Implementer's report is honest about the sandbox `rm -rf` substitution and about the pre-existing dirty snapshots, and explicitly flags them as out-of-scope rather than silently absorbing or hiding them.
- Verification claims in the report are reproducible; I re-ran them independently and got identical results (clean regenerate, successful build, same pre-existing warnings).

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)
- `native/scripts/check-artifact-compliance.sh` reads `PROJECT_YML="$ROOT/native/project.yml"` and does `grep -q 'CODE_SIGN_ENTITLEMENTS' "$PROJECT_YML"` — that file no longer exists after this diff, so running this script now unconditionally fails with `project.yml: CODE_SIGN_ENTITLEMENTS not wired` (`COMPLIANCE-FAILED`). Nothing in the repo currently invokes this script (grep across `.sh`/`.yml`/`.yaml` found no caller besides itself), so this is a **latent** break, not an active CI failure — but it's a real regression the moment anyone runs it or wires it into CI later. This script is not mentioned anywhere in the plan's 7 tasks, so it's a plan-level gap rather than something Task 5's own spec asked the implementer to handle — flagging for whoever owns the follow-up, not blocking Task 5 approval.

#### Minor (Nice to Have)
- `native/README.md` still describes XcodeGen as the source of truth in three places (line 3: "generated with XcodeGen... checked-in source of truth is `project.yml`"; line 15: file-tree comment `project.yml # XcodeGen manifest`; line 51: CI description says the hook "verifies XcodeGen, regenerates the project from `project.yml`"). Like the compliance script, this isn't in any of the plan's 7 tasks (grepped the whole plan for "README" — zero hits), so it's a pre-existing gap in plan scope, not a Task 5 defect.

### Assessment

**Task quality:** Approved

**Reasoning:** The diff matches the Task 5 spec exactly (two files deleted, nothing else touched), and I independently reproduced both the clean-regenerate and build verification with identical successful results and a clean working tree. The two flagged items (`check-artifact-compliance.sh`, `README.md`) are genuine stale references to the deleted `project.yml`, but neither is in Task 5's file scope or mentioned by any plan task — they're gaps in the overall migration plan, not something this task's implementer failed to do.

## Unresolved Questions
- None for Task 5 itself. Whether `check-artifact-compliance.sh` and `README.md` get updated should be raised with whoever scopes a follow-up task (they weren't assigned to Tasks 6 or 7 either).
