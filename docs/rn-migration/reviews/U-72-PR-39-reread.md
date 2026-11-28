# Re-read of the correction of PR 39, unit U-72 (head 3872662)

The verdict of an independent re-reader, as written. Gate `w5f` on the integration tree
`a2dd1ebe93f6` (main `120872b` with this head): 1,648 tests with PostgreSQL 17, 0 sql-skip,
typecheck 0, parity 0, both smokes, the sync script. Merged as `7f10adf`.

## Findings

1. `note | docs/rn-migration/parity-detail/scan.md:73 | The label "Report sent" remains in the table of the document (and in a bullet of the findings). Prose of a document only, not copy of the app; the decision governs the strings in the sheet.`
2. `note | apps/mobile/src/features/scan/CorrectionCaptureView.tsx:47,71,96 | The internal state `sent` and the identifiers scan.correction.sentTile and sentTitle keep the word "sent"; both existed before the correction, they are identifiers of record, and only scan.correction.includePhoto was ruled removed.`
3. `note | apps/mobile/src/features/scan/scanScreens.test.tsx:216 | The regular expression of the banned words (send, sends, sent, sending, team, read, reads) leaves out words such as "upload" or "check", but the helper copy and the toggle are asserted absent separately; the coverage is adequate.`

## Verified

1. The toggle is gone entirely: no Switch import, no state, testID, label, helper or style of the photo row anywhere in the sheet; in the whole repository `includePhoto` remains only in the assertion of absence and in the findings. The dock reads "Save report". The state after the tap reads "Report saved on this device" and "Nothing leaves it. Your review hasn't changed: to fix this meal now, edit the item." Every string a user sees was checked: nothing of sending, the network, a team, reading or checking. The direct fixes stay (the row to fix now, the reasons, the note field).
2. The model: `captureCorrection(kind, note, itemId)` without the options; the report still clears "Review needed" and unlocks Save; nothing else changed. The type of a correction is `{ kind, note }`, byte-equal to main.
3. Tests: two sentences renamed, one added, all three added by this unit and none on main; the reasons are in the findings. The assertion of absence by identifier, the text "Save report", the absence of "Send report", the title of the saved state with the words "nothing leaves it", and the shape of the report can each fail.
4. The findings: `scan.correction.includePhoto` under the identifiers removed with its reason; the stale sentence on item 4 corrected ("PR 37 is not on main yet; it waits for the owner's line"); every changed sentence listed with its reason.
5. The parity detail agrees with the code on the identifiers of the report sheet.
6. Hygiene: seven files inside the writable list; nothing under design, data, app or packages; no literal color in the added lines; a Conventional Commit with scope rn; no attribution.
7. Regression: the commit touches only the file of the report sheet in the feature.

## Not checked

The execution of the tests (forbidden for the re-reader; the owner ran the gate).

## Verdict

PASS+NOTES.

## What the owner did

- Note 1: the label "Report sent" of the parity detail and of the findings is corrected in the evidence unit of the scan, with the row of frame 77.
- Notes 2 and 3 stay as recorded.
