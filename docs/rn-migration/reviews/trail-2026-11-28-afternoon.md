# Two reviews of the decision trail on 2026-11-28 after 13:10 (drains w5f, w5g and w5h)

The flags of two independent reviewers who took no part in the work, as they wrote them. Until
this file existed their text lived only in the transcript of the owner; the second reviewer
flagged that. The owner's answer to each flag is in `trail.tsv` under the phases named below.

## First review (the rows of the drains w5f and w5g)

Flags

1. `ROW U-74 | the ledger row says "three code changes" of ab293e2 stay; the trail row says "four code changes" | the same commit counted two ways blurs what stays once the evidence leaves the branch | the diff of ab293e2: four code files under apps/mobile (the three fixes found on the device) plus the flow script`
2. `ROW (none) | the commit 85c5556 adds a section to briefs/U-76e.md ("What the harness cannot do") | a decision of the repository since 06:10Z with no row in the trail`
3. `ROW U-82 | the ledger row pins the head 3556ec0 | the head was already 518c3dd when the row was appended; accurate only for the read quoted at 13:27`

Checked and found true by that reviewer: PR 57 merged with the tree of the ledger and the totals of its gate (1,622 tests); PR 59 changed exactly two documents and its counts in the parity table are right; the two rules in plan.md are stated as rules and its state paragraph was true; PR 39 was still at d787a07 with its gate green on the tree 062867ab161d; PR 37 had not moved since ab293e2; the worktree of U-74e held pictures under DY-01 to DY-08 and its Metro served that worktree; PR 58 had two jobs passed and the iOS job pending; no AI attribution anywhere in the commits of the day or the bodies of the two pull requests.

## Second review (the rows of the drain w5h)

Flags

1. `ROW ledger U-82 | "two flows wait for strings the app never renders on main" | both waits sit in one flow (.maestro/02-tabs-diary-sheet.yaml, lines 29 and 35); the ledger miscounts the flows as two`
2. `ROW trail-review-1310 | the evidence is "its text is in the transcript of the owner" | a pointer that cannot be opened: the text of the review is not durable, so a later session cannot audit it; only its three consequences are logged`

Checked and found true by that reviewer: the commit ab293e2 holds exactly four code files under apps/mobile and the flow file under scripts/rn/evidence; the commit 85c5556 adds six bullets to the brief of U-76e; at the head 518c3dd of PR 58 the three defects of the review are still present (two waits for strings that are nowhere on main, where CoachView renders "Coach" and "Insights" and ProfileView "Plan" and "App"; the step that installs Maestro calls it before GITHUB_PATH applies); the report sheet of the scan at d787a07 held the toggle, the dock "Send report" and the state "Thanks, report noted", and nothing in the scan feature transmits a report; the decision of the owner matches the plan of phase 4; the gate w5e ran on the tree of d787a07 merged on main and its totals add up to 1,647; the correction of PR 39 was pushed as 3872662 with the toggle dropped and the state reading "Report saved on this device".

## What the owner did

- First review: a row supersedes the count (three fixes in four files; the flow file is evidence); the brief section has its row; the head of U-82 has a row with 518c3dd.
- Second review: a row supersedes the count of flows (one flow, two waits); this file makes the text of both reviews durable.

## Third and fourth reviews (the rows of the drains w5h to w5k)

Flags of the third review (the rows of w5h)

1. `ROW ledger U-82 | "two flows wait for strings the app never renders on main" | both waits sit in one flow (.maestro/02-tabs-diary-sheet.yaml, lines 29 and 35)`
2. `ROW trail-review-1310 | the evidence is "its text is in the transcript of the owner" | a pointer that cannot be opened`

Flags of the fourth review (the rows of w5i to w5k)

1. `ROW U-82 | the head of PR 58 moved from 518c3dd to 48dcf84 since the ledger row; at the new head the third should-fix is still unfixed (the step "Install Maestro" appends to GITHUB_PATH and runs maestro --version in the same step) | the row says the three should-fixes are being corrected | gh pr view 58; the workflow and the flow at 48dcf84`

What the owner found on reading the head 48dcf84 herself: none of the three should-fixes is fixed at that head (the flow still waits for the two strings; the step is unchanged; nothing under apps/ changed). The head was pushed at 13:42, before the message of the owner reached the worker at 13:45; the message waits in the thread of the worker. The iOS job is queued on GitHub and will fail at that step when it runs; the worker iterates.

Both reviews checked and found true: the merge of PR 39 and its tree against its gate (1,648 tests); the toggle gone on main with the dock "Save report" and the state on this device; PR 60 changed one file and its counts are right; the three rows of PR 60 end in a true and clear record; the briefs of the evidence units exist with a table each; the worktree of U-70 descends from main; PR 37 has not moved; no attribution in the commits or the body of PR 60.
