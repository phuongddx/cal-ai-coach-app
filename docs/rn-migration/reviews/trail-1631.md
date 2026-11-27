# Review of the decision trail, rows at 16:31:02Z (commit 99a6a24)

The flags of an independent reviewer who took no part in the work, as the reviewer wrote them. The
owner's answer to each flag is in `trail.tsv` under the phases `u-76`, `u-71g`, `u-77b` and
`trail-review-3`.

## Flags

1. ROW u-76 | Offline chip kept beside the calendar button; frame 08 shows the chip in the button's place with no button | Keeping both states merges two frames into a layout neither shows; it is honestly recorded as a deviation but deserves the person's sign-off | Viewed both PNGs: 07 has calendar button, no chip; 08 has chip, no button.
2. ROW u-77b | Literal style numbers crept in: `fontSize: 13` and `'500'` (EmailStep:180), `'700'` (:126), `'500'` on "or" (EntryStep) | A restyle should draw with tokens; 13 likely duplicates a typography token | Grepped both files; no literal hex colors found.
3. ROW u-76 | Stage-A code claims (cards removed, macro grid, 24 files) have no pointer into head ee7771b, only Worker-S2's report on PR 50 | The "read the pushed head" standard is met for U-77b (exact line pointers) but not here | The ledger row; `gh pr view 50` head equals ee7771b; no file or line evidence.
4. ROW u-76 | The U-71g addendum is backed only by its receipt, and no ledger row updates U-71g itself | A unit's durable state is its ledger row; U-71g silently gained item 10 | The trail row; no u-71g row at that timestamp.

## Checked

- All six keyboard props hold at exactly the lines the trail cites (EmailStep 104 to 107 and 137 to 138; EntryStep 112); the old `SignInScreen.tsx` had the same six, none lost.
- The thirteen original `it(` sentences are present word for word (the first thirteen of the branch's twenty-six) against the thirteen on main.
- "Three tests added" matches the correction commit 659d4e6 (29 test lines).
- The frames support "no chevron" and the number without its unit; neither frame shows an "N of M" count.
- "A diary entry holds no photo" is true: a grep over the schema and the repositories is empty; `ScanThumb` shows an in-memory `captureThumb` only.

## Could not check

The content of the worker's report on PR 50; whether the drawn Today screen matches the frames; the baseline of the act() warnings.
