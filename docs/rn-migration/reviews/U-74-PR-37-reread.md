# Review of PR 37, unit U-74, the correction (head cfa35a5)

The verdict of the independent re-read, as the reviewer wrote it. The reviewer did not write the
code and read only, in the integration worktree `rn-integrate` at `11f7eba` (main `5bf273d` with
`cfa35a5` merged). Gate `w6a` on the tree `82ca97c49a98`: 1,677 tests with PostgreSQL 17, 0
sql-skip, typecheck 0, parity 0, both smokes, the sync script. The owner read the two lines the
verdict rests on before acting: `wins()` in `apps/api/src/sync.ts` (an upsert wins only when its
`updatedAt` is greater than the stored one; a tombstone is stored with its own time) and
`undoDelete` in `diaryDayModel.ts` (it re-records `item.entry` as it was).

## Findings

1. must-fix | 1 | `apps/mobile/src/features/diary/diarySnapshot.ts:154-163`; `apps/mobile/src/data/sync/engine.ts:230,266,298`; `apps/mobile/src/data/sync/store.sqlite.ts:207-218` | The transaction makes the look and the cancel atomic, but an op row that is still in `pending_ops` does not mean the engine has not taken it. `dueOperations` is a plain SELECT and the row stays for the whole network push; it is deleted only by `applyPushAcks`, after the answer. An Undo tapped during that push (from 500 ms after the delete, the debounce at engine.ts:121, until the round trip ends) finds the op, cancels it and restores the row with no op (the `true` path, 164-196). The ack then finds no op and changes nothing (`syncMergeRepository.ts:151-153`), and the pull of the same dispatch applies the server's tombstone: the restored row has no pending intent and carries the older version (`syncMergeRepository.ts:184-212`). The entry comes back and disappears again within a second. That is the case the first review named. The new test models the take as a deleted row (`DiaryWaterExercise.test.ts:272`), which is the ack, not the read, so it passes without covering this. To do: after an undo the record must never be left with zero ops. In the same transaction, replace the cancelled tombstone (and the record's other pending ops) by one upsert op of the restored entry, or have the store mark an op when `dueOperations` reads it and let the seam treat a marked op as gone.
2. must-fix | 2 | `apps/mobile/src/features/diary/diaryDayModel.ts:182`; `apps/mobile/src/data/repos/diaryEntryRepository.ts:74,203`; `apps/mobile/src/data/sync/store.sqlite.ts:85,436-467`; `apps/api/src/sync.ts:86-91,104-116`; `apps/mobile/src/data/repos/syncMergeRepository.ts:165-172` | The re-record writes `item.entry` as it was before the delete, so the mirror row keeps the old `updatedAt`, and the wire meal carries that value. The API applies an upsert only when `meal.updatedAt` is greater than the stored record's `updatedAt` (sync.ts:88-89), and a stored tombstone carries the tombstone's own timestamp (sync.ts:113), which is later. The upsert is answered as a loser with the tombstone; the client deletes its op and force-writes the tombstone into the mirror. The entry is back for half a second plus one round trip, then gone for good. This is the branch for every Undo tapped after the delete's own push was acknowledged: on an ordinary connection, from about one second after the delete to the end of the window. No test pushes a re-recorded entry. Both "after the push" tests stop at the local row count (`DiaryWaterExercise.test.ts:240-256, 262-286`), and the fake server has the same rule (`fakeServer.ts:68,76-77`). To do: re-record with `updatedAt` set to the undo time, as `updateEntry` does at `diaryDayModel.ts:158`, and add a test through the engine against `FakeServer` that asserts the entry survives push, ack and pull.
3. must-fix | 3 | `apps/mobile/src/features/diary/diaryDayModel.ts:187-191` (called from `screens/DiaryDayView.tsx:115`); `apps/mobile/src/data/sync/store.sqlite.ts:283-289,92-109` | The edit's Undo re-records `prev.entry` verbatim, with the same old `updatedAt`. This line is from 0691d9e, not from the correction; it is listed because correction 2 asks whether the undo promise holds on both branches.
   - Once the edit has synced, its upsert loses the way described in finding 2 and the ack puts the edited record back. The Undo is reverted about half a second plus a round trip later.
   - If the Undo lands before the edit's op is taken, both ops travel in one batch with the same wire meal, because the meal is built from the current mirror row at dispatch (store.sqlite.ts:413-433). The second is answered as a loser, and the store's loser path rewrites the detail row from the wire record: grams, confidence, source and scanId become null or `'sync'`, and the meal slot is re-derived from the hour (92-109). The text is right, but the entry can no longer recompute kcal from grams.
   - §13.2's "the undo is real" (`docs/rn-migration/findings/U-74.md:577`) does not hold for this branch once sync runs.
   - To do: stamp the restored entry with the undo time, and stop the loser path from overwriting local-only detail fields. That second part is the store, outside this unit.
4. note | 4 | `apps/mobile/src/features/diary/screens/DiaryDayView.tsx:297-303`; `screens/DiaryEditSheet.tsx:205-213` | The deferral is `setTimeout(…, 0)`, and the captured item is the sheet's own `item`, the entry being edited. The handle is discarded: nothing clears the timer on unmount and nothing checks that the view is still mounted. If the view unmounts within that tick, the confirmation can present over another screen and its toast is lost. The window is one tick. Two sheets cannot come out in practice: the sheet unmounts in the commit of the first press (`DiaryDayView.tsx:291`), so a second press has no target. The JS has no guard of its own, and neither has the native manager (`react-native/React/CoreModules/RCTActionSheetManager.mm:117-217`).
5. note | 5 | `apps/mobile/src/features/diary/screens/DiaryDayView.tsx:105-117`; `apps/mobile/src/design/components/Toast.tsx:93-101` | `undoCurrent` reads the front toast from the render and slices the queue unconditionally. A tap processed in the turn where the front's timer fired slices twice: the next toast is dropped without being shown, and the expired one is undone. The Toast's Undo button has no double-tap guard, so with a queued toast a quick second tap lands on the next toast's Undo and undoes that too. Both are rare. A ref to the live queue closes the first.
6. note | 6 | `apps/mobile/src/features/diary/__tests__/DiaryDayViewUndoQueue.test.tsx:238-266,268-299` | What remains proves three things: a second toast does not replace the first (229, 258), it appears later in order (232, 262), and Undo calls the model with the first item only (291-293). It does not prove the windows are five seconds. The assertions bound appearance and disappearance from above only, so the "two full windows" of the title at 238 would still pass with a first window cut short. The cut assertion was the only one for the hand-over after an Undo. By reading, that hand-over is the same `slice(1)` as the timer's (`DiaryDayView.tsx:86,110`), after which the effect restarts for the new front (81-89). I find no code gap behind the cut; it leaves that path unpinned.
7. note | 7 | `apps/mobile/src/features/diary/screens/DiaryDayView.tsx:242-251,253-271,474` | The "Saved to <meal>" toast is separate state and renders at the same position as the undo toast. A log followed within four seconds by a delete or an edit stacks the undo toast over it, and the hidden toast's Undo cannot be reached. This was the same before the queue; the queue covers only the two undo toasts.
8. note | 8 | `docs/rn-migration/findings/U-74.md:555-599,601-638`; `apps/mobile/src/features/diary/diarySnapshot.ts:144-146` | The findings do not match the code or the rule in five places.
   - §13.3 (582-583) and the closing paragraph (593-594) say the deferral test runs the tick with `jest.runAllTimers` and that the fake-timer cases live in the new file. The file uses no fake timers (header 6-8, `waitFor` at 203).
   - §13.1 (567-573) and the doc comment at diarySnapshot.ts:144-146 say a re-recorded entry cannot be out-argued by a server tombstone. Findings 1 and 2 say otherwise.
   - §13.2 (577) "the undo is real": see finding 3.
   - The test sentences of the delta are described in prose but not tabulated. The move and rename of "the edit sheet Delete item opens the delete confirmation" to "… after the sheet closes" is not recorded, and the old sentence is still listed as existing at 379.
   - The policy grep quoted at 598-599 omits `useEdSafeMode(`, the one pattern with matches.

## Verified

**Correction 1 (partly)**
- One transaction covers the read and all three writes: diarySnapshot.ts:154-197, all on `tx`.
- Other transactional writers wait on the handle's queue (sqlDb.ts:44-56). The store's two plain updates (store.sqlite.ts:322-344) would join the open transaction rather than commit inside it; that is older than this PR.
- The "op gone" branch is reached and writes one upsert op: diaryDayModel.ts:179-183, diaryEntryRepository.ts:198-212, pinned at DiaryWaterExercise.test.ts:283-285.
- The crash-between-writes hole is closed.
- The new test would fail on the old shape. The old `findPendingTombstoneOp` awaited a bare select, which runs at the await on the sql.js driver (`drizzle-orm/query-promise.js`, `then` calls `execute()`; `sqlite-core/query-builders/select.js`, `async execute() { return this.all() }`; the sql-js session `all` is synchronous). It ran before the queued `take` began (sqlDb.ts:46,60), found the op, took the cancel path and left 0 ops, so `toBe(1)` fails.
- End to end the correction does not hold: findings 1 and 2.

**Correction 2**
- One `confirmDelete` serves both paths: DiaryDayView.tsx:124-143, the row at 211, the edit sheet at 297-303.
- Strings: title `Delete ${item.title}?`, message `This will remove it from <meal>. You can undo for 5 seconds.`, options `['Delete item', 'Cancel']`. No accessibility label is set.
- `item.kcal` is no longer read in the confirm, and there is no mode gate, so the sheet is identical under ED-Safe (DiaryDayView.test.tsx:320-344; changed expectation at 252).
- The title embeds the entry's name unscreened, as the row already does (FoodRow.tsx:64-66).
- The undo promise holds mechanically (138-140, 150-153) but not end to end: findings 1-3.

**Correction 3**
- Deferred by `setTimeout(…, 0)`, with the right item. The rest is finding 4.

**Correction 4**
- State is `UndoToast[]` with the front at index 0 (75-76).
- The effect depends on `[currentUndo]` (81-89), so a later enqueue does not restart the front's window, the next front gets a new five seconds, and the cleanup clears the timer on unmount.
- A third action appends. Undo on a toast that is not the last undoes the front only.
- Delete-then-edit and edit-then-delete both queue in order (138-140, 150-153).
- `diary.toast.undo`, `diary.toast.undoEdit` and their copy are unchanged (254-270).

**Rule 22, test sentences in the delta (none changes a testID)**

| Change | Where | Reason | Tabulated |
|---|---|---|---|
| Added: "an undo whose op the sync takes between the tap and the write re-records the entry" | DiaryWaterExercise.test.ts:262 | new seam | prose only (§13.1) |
| Changed expectation, same sentence | DiaryDayView.test.tsx:252 | copy changed | prose only (§13.2) |
| Added: "the delete confirmation carries no kcal" and "… under the ED-safe policy either" | DiaryDayView.test.tsx:320, 333 | copy changed | prose only (§13.2) |
| Deleted from DiaryDayView.test.tsx, added as "the edit sheet Delete item opens the delete confirmation after the sheet closes" | DiaryDayViewUndoQueue.test.tsx:192 | presentation deferred | no (finding 8) |
| Added: the three queue cases | DiaryDayViewUndoQueue.test.tsx:212, 238, 268 | behaviour mandated by the review | prose only (§13.4) |
| `ab293e2` | no test sentence | behaviour fixes and visuals | n/a |

**ED-Safe grep under `features/diary`**
- `useEdSafeMode(` has 3 call sites: FoodSearchView.tsx:305, WaterCard.tsx:46, CustomFoodSheet.tsx:43.
- `edSafeMode(`, `edSafeHidden(`, `useEdSafeHidden(` have 0.
- All three existed at 94d921b and are listed as stays in §8 (192-202) and §11 (430-436). The delta added none.

**ab293e2 code against §14**
- §14.1: `sheetInitialDetentIndex: 1` at `app/diary.tsx:70`; the option exists in react-native-screens 4.30.1.
- §14.2: the snapshot is rebuilt on every `emit`, and every mutation path calls `emit` (foodSearchModel.ts:88-91, 96, 103, 116, 130, 146).
- §14.3: `useSyncExternalStore` over a model held in `useMemo` (FoodSearchView.tsx:83-86, 99-103).
- §14.4: `Sheet detent="large"` caps the height at 92 % of the window (DiaryEditSheet.tsx:85; Sheet.tsx:24-27, 49).

**Repository rules**
- Design diff: 0 files.
- Literal colours in the diary feature: none added, two removed.
- Evidence diff: prints nothing.
- `parity.tsv`: not touched. `docs/rn-migration/parity-detail/diary.md` is touched.
- Commits: 16 own commits, all `type(rn):`, same author and committer, good signatures, empty bodies, no AI wording in subjects, bodies or trailers.

**Known item**
- `DiaryDayView.tsx` line 69 and the render-time reads at 91 and 165-229 are left as they were; the correction commits added no render-time model read.

## Not checked

- The pull request body: I cannot read it, so the no-AI-author rule is unchecked for it.
- The gate results quoted in §13 (npm test, typecheck, parity:check); nothing was run.
- Whether one tick is enough for the action sheet after the edit sheet. `RCTPresentedViewController()` skips a controller that is being dismissed, so the sheet presents on the controller below the modal only if the dismissal has begun when the native call lands. The Simulator run on record never exercised this path after the change (U-74.md:507-509, 535-537), and §13.3 cites only the Jest spy.
- Whether `sheetInitialDetentIndex`, set in an effect after mount, applies to the first presentation. §14.1 rests on a Simulator run whose evidence left the branch.
- Whether the flakiness behind the cut assertion is a test artifact or an intermittent failure of the hand-over after Undo.
- The deployed server. I read `apps/api/src/sync.ts` and `fakeServer.ts` in this checkout.

## Verdict

FAIL — for a signed-in user the delete undo still loses the entry when tapped after the sync engine has read the op (findings 1 and 2), and the edit undo is reverted or strips the detail row (finding 3), so "You can undo for 5 seconds" is false outside the first half second.

## What the owner did

- PR 37 is not merged at this head. The three must-fixes went back to the author as a second
  correction on the branch of PR 37, with the design the owner chose: an undo never leaves a
  record with zero ops and never restores an old `updatedAt`; in one transaction it replaces the
  pending ops of the record by one upsert op of the restored entry, stamped with the time of the
  undo. The tests go through the sync engine against the fake server and are seen red first
  (receipt in the trail).
- Notes 4, 5 and 8 went along as part of the correction; notes 6 and 7 go to the final report.
- The second part of must-fix 3 (the loser path of the store rewrites local-only fields of a
  detail row when two ops of one record travel in one batch) is a defect of the sync store, older
  than PR 37: it becomes its own unit and is listed for the final report.
- PR 58 no longer waits for PR 37: it is gated alone on main (gate `w6c`) and merges first.
- The Today evidence (U-76e) stays without a worker until the correction lands: Worker-G2, who
  was to capture it, corrects PR 37 first.
