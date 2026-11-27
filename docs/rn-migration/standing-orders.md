# Standing orders for every unit

The owner (CoachCal bot) includes these rules verbatim in every brief as the STANDING field. A rule
that has to be repeated in briefs belongs here.

## Places

| What | Value |
|---|---|
| Main checkout, never touch | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app` (on `main`, holds Phương's uncommitted work) |
| Coordinator worktree, read only | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-expo` |
| Native worktree, only for the unit that holds the native slot | `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-native` |
| Your worktree and branch | named in your brief; already created, `node_modules` already present |
| Simulator, only for the unit that holds the simulator slot | the available `iPhone 17 Pro` on iOS 26.4; scripts find it by name through `scripts/rn/sim-udid.sh`. Never write a UDID into a script: the machine lost every Simulator on 2026-11-27 and the device came back with a new id |
| Metro, only for the simulator slot holder | port 8081 |
| API and PostgreSQL 17, only when your brief gives you the API slot | `http://127.0.0.1:8787`, port 5433, through `scripts/rn/start-api.sh`; the env file it writes is named after your checkout |
| The database handle and the repositories | `apps/mobile/src/data/environment.ts` (`getDataEnvironment()`); after a write through a repository call `notifyLocalMutation()` from `apps/mobile/src/data/sync/runtime.ts` |
| Debug and fixture flags | `apps/mobile/src/debug/launchArgs.ts` (`getDebugFlags()`, `setDebugFlags()`) |
| Log directory | `/private/var/folders/nn/n6wtxkdd3n10d78wf4xmygrm0000gp/T/opencode/rn-logs/` |
| App identity | `com.nextlabs.coachcal`, scheme `coachcal`, display name CoachCal |

## Rules

1. Work only inside your own worktree. Never run a git command that changes the main checkout
   (`checkout`, `stash`, `reset`, `clean`, `pull` there), never edit a file outside your worktree.
2. Commit on your branch with Conventional Commits, scope `rn` (`feat(rn): port targets engine to
   core`). Push the branch with `git push -u origin <branch>`. Open the pull request against `main`
   with `gh pr create`; the title is the first commit's subject, the body is your report. Never
   merge, never rebase, never force-push.
3. If `origin/main` moved, run `git fetch origin && git merge origin/main` and resolve conflicts in
   files you own. A conflict in a file you do not own: stop and report it.
4. Do not add, remove or upgrade a package, and never edit `package.json` or `package-lock.json`,
   unless your brief names you the dependency writer for that wave or names the fields of one
   package file you may edit. If you need a package, report it.
5. No native build (`expo prebuild`, `expo run:ios`, `pod install`, `xcodebuild`) and no Simulator
   use (`xcrun simctl`, `axe`, Simulator.app) unless your brief gives you that slot.
6. Files you may not edit unless your brief lists them: `apps/mobile/app.config.ts`,
   `apps/mobile/src/app/**`, `apps/mobile/package.json`, `package.json`, `package-lock.json`,
   `packages/api-contract/src/index.ts`, `packages/core/src/index.ts`, `apps/api/src/app.ts`,
   `apps/mobile/src/data/environment.ts`, `apps/mobile/src/debug/launchArgs.ts`,
   `apps/mobile/src/data/sync/runtime.ts`, `docs/rn-migration/parity.tsv` (the owner sets status and
   evidence). You always may add your findings file `docs/rn-migration/findings/<unit>.md` and your
   detail file `docs/rn-migration/parity-detail/<area>.md`.
7. Ids: `apps/mobile/src/data/sync/uuid.ts` is the only id source in the app; never
   `crypto.randomUUID` under `apps/mobile`. `packages/core` imports nothing but its own files.
8. No Supabase, no EAS, no new accounts, no secrets, no `.env` file edits (`.env.example` files
   are yours to write), no deploy, no App Store Connect. Never commit a file that holds a key or a
   token.
9. Read every Swift or Deno source you port in full before you write. Port its tests with it: one
   Jest case per old test case, same behavior sentence as the test name.
10. Before you report, at the repo root: `npm test`, `npm run typecheck` and `npm run parity:check`
    are green. Quote their last lines in the report.
11. A command that can run over a minute writes to a log file in the log directory and gets a long
    timeout. Never rerun a timed-out command unchanged; read its log first.
12. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before anything that runs CocoaPods or
    `expo run:ios`. Before a native build run `df -h /System/Volumes/Data`; under 6 GB free, stop
    and report.
13. When a library does not behave as the brief says, read its docs and typings in `node_modules`
    before guessing. Still blocked after a real attempt: stop and report exactly what blocks you.
    Never work around a blocker by changing a file outside your scope.
14. Evidence beats description. Report what you ran and what it printed, and say what you did not
    verify.
15. Timebox: when it expires, push what you have, open or update the pull request, report partial.
16. Do not change the public preview of the product, do not redesign a screen, do not add a feature
    the old app does not have.
17. The API and PostgreSQL 17 are a slot, like the native build. Only the unit whose brief gives it
    the API slot runs `scripts/rn/start-api.sh`, and it runs `stop` before it reports. In every
    other unit the root `npm test` prints `[sql-skip]` lines for the SQL suites: that is green.
    Never alter a database or a cluster you did not start.
18. Other projects build on this machine. Never run `docker system prune`, `docker builder prune`,
    `docker image prune`, `docker volume prune` or any cleanup that is not limited to a name or tag
    you created. Remove containers, images and volumes by the name you gave them.
19. Feature code never opens the database and never reads process arguments. A feature model takes
    its repositories, its API client, its clock and its flags through the constructor (Jest builds it
    with test doubles); its route file gets the real ones from `getDataEnvironment()` and
    `getDebugFlags()`. After a write through a repository, call `notifyLocalMutation()`.
20. The ED-safe rule for feature code (I7) is about policy branches, not about letters. No file
    under `apps/mobile/src/features/**` may call `edSafeMode(`, `edSafeHidden(` or
    `useEdSafeHidden(` to decide what to show: hide a calorie framing with `EdSafeCollapse` from
    `src/design`, which owns the branch. A feature may read the mode to show a control's state
    (`useEdSafeMode()` for the switch in Settings). An accessibility identifier, a copy key or a
    stored key that merely contains `edSafe` is correct: the Swift app has
    `settings.edSafeToggle` and the stored key `edSafeMode`. Never rename one to satisfy a grep.
21. A unit that runs the built development app checks first that the app holds every native module
    the code on `main` requires (look into `Frameworks/` of the built app; `uuid.ts` needs
    `ExpoCrypto`). If one is missing, stop and ask the owner for the native slot. Do not weaken the
    code to fit an old build.
22. The token source is `docs/design/ember/tokens.css` (light in `:root`, dark in `.dark`), not the
    Swift `Tokens.swift`. Feature code uses tokens and design components only, never a literal
    color. A unit that restyles a screen does not change its behavior, its tests' sentences or its
    identifiers: a test may change only where it asserts a visual value.

## Report format

```text
Status: done | partial | blocked
Branch and commits: <branch>, <sha> <subject> per commit
Pull request: <number and url>
Parity rows: <ids> with the status you claim for each (done | partial | not-done) and the evidence path
Deliverables: one line each, done / partial / not done
Commands run: the ones that matter, with the key output lines (test summary, build result)
Findings: pitfalls, docs that were wrong, anything native you had to write
Not verified: what you could not run or observe, and why
Open questions: only those that need the owner's decision
```

## What the owner does with a report

The owner reads the diff, not only the report; re-runs the checks on the pushed head; looks at every
screenshot; sets status and evidence in `parity.tsv`; merges the pull request with a merge commit
once it is green and synced with `main`; closes the worker's thread; removes the worktree. Work
outside the brief's scope does not stay in the unit.
