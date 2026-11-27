# Messages the owner could not send

A turn that a worker result started cannot address that worker without the rework flag and a new
thread. The messages below wait here and go out in the next turn another worker starts. A turn
also opens at most five new threads: the sixth call of a turn is refused.

## When U-71g is merged (Worker-S1, thread 31cd8275 is the unit's own thread)

The go for the code step of U-77b, on a new thread with the rework flag. Content: merge `main`;
swap the two fields onto the text variant of `FillField` with their keyboard props; build the code
step on frames `112-auth-code-entry-light.png` and `113-auth-code-entry-dark.png` with `CodeField`
("Enter the code", "We sent a 6-digit code to **address**.", "Can't find it? Look in Junk or
Promotions.", Verify enabled at six digits, "Resend code in" after 60 seconds, "Use a different
email"); the e-mail step on `108-auth-email-step-light.png` and `109-auth-email-step-dark.png`
("Continue with email", "We'll email you a 6-digit code. If you're new, the same code creates your
account."); the errors on 110, 111, 114 and 115; `SheetHeader` for the header (`auth.emailBack`);
`SecondaryButton leading` for the three buttons of the entry step. Replace the three literal sizes and
weights of the correction by the text styles of `useTokens().type` (`EmailStep.tsx` lines 126 and
180, `EntryStep.tsx` line 127 at 659d4e6). Stage B then waits for the Simulator slot.

## When the slot reaches U-76 (after U-72): the go for its stage B

- The decisions on the three questions of Worker-S2: the sentence "N of M meals" stays out (no
  source); the offline chip sits beside the diary button (a recorded deviation from frame 08 that
  Phương may overrule); the meal rows take `chevron={false}` and `unitHidden` of `FoodRow` once
  U-71g is on `main`; the photo tile of the frames is not built (a diary entry holds no photo).
- For the worker: prove the new `TodayView` tests can fail (one run with the view mutated under
  test, quoted in the findings).
- For the reviewer: `CalorieRing` gained the variant `md` and its render was restructured; the
  variants `hero`, `compact` and `goal` must draw as before.

## When a report arrives

- PR 50 (U-76 stage A, Worker-S2): drain, then stage B waits for the slot after U-72.
- PR 37 (U-74 stage B, Worker-G2): read every screenshot, an independent review of the whole pull
  request, the gates on an integration tree, merge; then the slot to Worker-G1 for the stage B of
  U-73 (new thread, rework flag).
- PR 47 (U-77b correction, Worker-S1): read; no merge before the code step.
- PR of U-71g (Worker-S1): gate, independent review, merge; then the go above.
- PR of U-61d (Worker-G1): run `node scripts/rn/check-frames-doc.mjs` on the pushed head, read a
  sample, merge with the tree recipe.

## Still open from before

- The owner docs pull request is done (PR 52).
- The U-72 stage A2 (the picker of U-74 on `main`) waits for the merge of PR 37.

## For the next owner pull request

- A gate lock: `scripts/rn/gate.sh` runs the three gates under a lock (one gate on the machine at
  a time), and rule 10 names it. At 23:30 the load was 43 to 62 on 11 cores while the stage B of
  U-74 captured evidence.
