# Re-read of the correction of PR 36, unit U-73 (head e13cf45)

The verdict of an independent re-reader, as written. Gate `w5c` on the integration tree
`d68fb4c4e0ce`: 1,594 tests with PostgreSQL 17, 0 sql-skip, typecheck 0, parity 0, both smokes, the
sync script. Merged as `769c0a0`.

## Findings

1. `note | onboardingModel.test.tsx, BodyMetricsScreen.tsx:46-52 | in-range decimals are not rounded: a blur of "175.5" keeps 175.5 (the clamped value equals the parsed one, so no rewrite), though the old wheel held whole centimetres. The brief enumerated no rounding, so this is per spec. Same for "80.6" kg.`
2. `note | BodyMetricsScreen.tsx:66 | after a blur on an empty field the field shows "" while the draft keeps its last value (165); the gate of the button depends only on the date of birth, so Continue saves the last value of the draft, never an empty one, as the brief says. A mismatch of display only.`
3. `note | GeneratingPlanScreen.tsx:79 | the label for the screen reader dropped the percent of main ("Generating your plan" against "Generating your plan, 100%"), and the step gains the formula rows and "See your plan". These are the redesign of the generating step on its Ember frame, beyond the three named copy exceptions, ordered by the frame.`
4. `note | GoalWeightPaceScreen.tsx | the icons of the goal cards changed (flame to chart, and three others): visual assets; titles and subtitles identical to main.`
5. `note | 22649b2, cf28750, e13cf45 | each correction is one commit that mixes tests and code, so tests first cannot be proven from the order of the commits; nothing contradicts it.`

## Verified

1. The header of step 4 reads "Weekly pace", as on main; the options Relaxed, Steady and Faster are unchanged; every other string a user sees in the nine steps matches main.
2. Nothing under design changed: `FillField` on main already had `onBlur` with its test. A blur cannot fire without a focus; a focus that moves to another field fires the blur of the first. Callers without `onBlur` render the tree of main.
3. The clamp lives in the model only; the screens parse, guard and call. 250 becomes 220, 9 becomes 120, the bounds of weight and of the goal hold, a value inside the range is untouched, typing is raw: all asserted at the screen and at the model. The clamped values reach TargetsEngine. A paste takes the same path and clamps on blur.
4. The plan reveal: the hero and the weekly range were already collapsed; the kcal row of the edit panel is now too. The macro grams stay. The test asserts the kcal row and its steppers gone and the macro fields present, so it can fail.
5. Sentences: ten added, two changed (the header, a copy change), none removed.
6. The three commits touch only six files under features/onboarding; no hex in the added lines; no ED-safe call in the feature; Conventional Commits; no attribution.

## Not checked

The gates (the owner ran them); the Simulator; the pixels of the frames.

## Verdict

PASS+NOTES.

## What the owner did

- Notes 1 to 5 go to the evidence unit of onboarding and to the final report. Note 1 is a candidate for a follow-up: the old wheel held whole centimetres and whole kilograms.
