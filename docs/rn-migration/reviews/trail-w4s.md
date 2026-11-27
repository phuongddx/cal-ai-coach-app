# Review of the decision trail, turn of 2026-11-27 22:25 to 22:40 (rows at or after 15:25:34Z)

The flags of an independent reviewer who took no part in the work, as the reviewer wrote them. The
reviewer had the repository, the log directory and GitHub, not the owner's transcript. The owner's
answer to each flag is in `trail.tsv` under the phase `trail-review` and in the rows it names.

## Flags

1. ROW w4q | the "independent review (PASS+NOTES, three notes)" of PR 45 | Cited as evidence but exists nowhere checkable: `gh pr view 45 --json reviews` returns `[]` and rn-logs holds only gate logs, so the durable log records as verified something a reader cannot verify | gh pr view 45; ls rn-logs
2. ROW w4s (repair) | "awk … zero malformed timestamps" after repair | Overstated: the ledger still holds ~12 rows like `2026-11-27T08:22:UTC` / `09:21:UTC` ("UTC" in the seconds field); the awk evidently matched only the doubled-year form, so the repair stopped halfway while claiming clean | awk ISO-8601 check on ledger.tsv, lines 33 to 42 and more
3. ROW w4s (repair) | two ledger rows edited in place on an append-only log | Breaks "never edit a row" with no supersede row in the ledger itself, while the trail's evidence error got an appended supersede: inconsistent; needs Phương's ratification as a file-level exception | git show 9474006 vs ffc21b2
4. ROW u-71e | plurals parked ("220 cals" passes the ED-safe screen) | I confirm the miss and agree parking is defensible, but ED-safe is the product's stated differentiator; "no caller sends it" deserves Phương's explicit sign-off, not just a follow-up note | Toast.tsx lines 34 to 36: both regexes fail on "cals"
5. ROW u-75 | "WeightChart.tsx deleted", "one test sentence deleted (axis ticks)" | Both are intra-branch churn, not facts vs main: the main…branch diff has no deletions and "axis ticks" matches nothing on main; a stage B reviewer diffing vs main will find neither | git diff --name-status; git grep
6. ROW u-77 | "five route files" in the ledger cell | The diff shows four route files plus routes.test.tsx | git diff --name-status

## Checked

Merge 2680208 is the tip of origin/main; tree 17179b941fa9 equals the tree in gate-w4q.log and the tree of origin/main; w4q-test.log totals 252 + 979 + 47 + 87 = 1,365; PR 45 is six files in scope; the GitHub heads of U-74, U-75 and U-77 match the ledger; the file counts 26, 20 and 24 match the cells and the briefs' scopes; manifest.json holds 107 frames and FRAMES.md on main cites 0 file names; the five open PR heads match the last rows of their units (36 at 39a1356, 37 at 94d921b, 39 at 48c51d7, 42 at c79f856, 43 at aad7c0c); the briefs U-77b and U-61c match their rows, including the rule-22 exception and the deferred privacy lines (the reviewer agrees with both); 118 and 137 are the right counts after the repair; the w4r row honestly says "not a review"; starting the two JS-only units is sound.

## Could not check

The content of the review of PR 45; the message receipts and thread ids; "load 6 on 11 cores"; the two visual frame deviations of U-77; the CI state of the open PRs.
