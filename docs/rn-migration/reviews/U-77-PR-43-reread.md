# Re-read of the correction of PR 43, unit U-77 (head cbb4030)

The verdict of an independent re-reader, as written. Gate `w5c` on the integration tree
`d68fb4c4e0ce` (main `8ab29cc` with PR 43 and PR 36): 1,594 tests with PostgreSQL 17, 0 sql-skip,
typecheck 0, parity 0, both smokes, the sync script. Merged as `c2cc55e`.

## Findings

1. `note | apps/mobile/src/features/billing/PaywallView.tsx:150, paywallModel.ts:126-130 | the one remaining caught-less void promise is void model.purchaseSelected(); purchaseSelected awaits deps.purchase bare and the route's stub throws. Unreachable today (the loader always rejects, so never ready) and untouched by this correction, but the same class of hazard the restore fix closed.`
2. `note | docs/rn-migration/parity-detail/profile-settings.md:135 | the export-states row still enumerates settings.exportError/Empty/Cancelled/Retry/Done with no ShareAgain. The letter of the decision is met (the parity detail delegates new identifiers to findings U-77 section 3, updated).`
3. `note | d12e3c3, ddd0f4d | tests first is unprovable from git: each fix bundles the test and the implementation in one commit; the findings record the claim. Every new test does fail on the pre-fix code.`
4. `note | frame 79 | the frame itself draws Restore and the note about restore; the correction deviates on purpose, recorded in findings section 10 and in the paywall row of the parity detail.`

## Verified

1. Restore is gone in every state: the row at the top holds only `plans.close`; the style is deleted. No sentence is drawn: the two strings stay in the copy file and are referenced nowhere. Tests assert the absence in the three states.
2. The rejection is caught inside the model and becomes `restoreError`; the model resolves and notifies on both paths; tested.
3. Frame 79: "Try again" sits inside the tinted caution card; its identifier did not change.
4. `settings.exportShareAgain` is on the cancelled row; `settings.exportRetry` belongs to exactly one control, the failed row's retry; the cancelled test asserts the old identifier is null and presses the new one.
5. Test sentences: one renamed (the subject Restore to Close, a copy change), three added, none otherwise changed.
6. Hygiene: the three commits touch exactly the seven files of the unit; nothing under design; no hex or rgba in the added lines; Conventional Commits; no attribution.
7. Regression: the loading and ready states, "Price unavailable", the disabled primary, the rejecting loader and the binding of the share are unchanged.

## Not checked

The gates (the owner ran them); the behavior on a device.

## Verdict

PASS+NOTES.
