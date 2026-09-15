# Golden fixtures — tracked origin

This directory is the **tracked origin** for every `*.golden.json` fixture
in this repo. `native/App/CoachCal/Resources/Golden/` (used by
`FixtureApiClient`) is a verbatim copy — see the comment at the top of
`FixtureApiClient.swift`:

> Golden fixtures under `native/App/CoachCal/Resources/Golden/` are copied
> verbatim from `supabase/functions/tests/golden/` (the tracked origin); a
> Phase 4 CI check must diff both directories so the bundled shapes cannot
> drift from the server contract.

## CI drift-check obligation (T-P42-03)

**Not yet wired into CI.** A future CI step must `diff -r` this directory
against `native/App/CoachCal/Resources/Golden/` and fail the build on any
divergence — the client bundle must never silently drift from the server
contract these files define. Until that step exists, any manual edit to a
fixture on one side MUST be mirrored on the other side by hand in the same
commit.

## `run-golden-eval.ts` bound recalibration (Phase 4 / Pitfall 8)

`scripts/run-golden-eval.ts`'s `TIER1_RESOLUTION_TARGET` (0.85) and
`P95_LATENCY_MAX_MS` (1200) are calibrated against the deterministic
fixture's fixed sentinel latencies (400–900ms) and fixed sentinel outputs —
they are not a claim about the real Gemini model.

The harness now runs in one of two modes, selected automatically by
environment:

- **Fixture mode** (`VLM_PROVIDER` unset/`fixture`, or `GEMINI_API_KEY`
  absent): unchanged — per-case exact-match assertions against the golden
  JSON, plus the two fixture-calibrated bounds enforced as a hard CI gate.
- **Live mode** (`VLM_PROVIDER=gemini` AND `GEMINI_API_KEY` present):
  per-case exact-match assertions are skipped (a real model will never
  byte-for-byte reproduce the fixture's sentinel items/kcal), and the
  measured Tier-1 resolution rate and p95 latency are **printed as OBSERVED
  values**, never silently compared against the fixture-calibrated
  literals above.

**Manual promotion required.** Nobody has run the live-mode path against a
real `GEMINI_API_KEY` yet — this coding-agent session had no live key
(RESEARCH's own Environment Availability table confirms `GEMINI_API_KEY` is
unset locally). The exact recalibrated numbers cannot be produced without an
operator run. Once an operator runs `VLM_PROVIDER=gemini deno run --allow-all
scripts/run-golden-eval.ts` with a real key and reviews the printed OBSERVED
Tier-1 rate + p95, promote those numbers into `TIER1_RESOLUTION_TARGET`/
`P95_LATENCY_MAX_MS` (or new `_LIVE`-suffixed constants, if fixture-mode CI
should keep asserting the original fixture bounds side by side) by hand.

## Scan-correction persistence — explicit re-deferral, not a silent drop

(RESEARCH Open Question 2 / Pitfall 9; recorded verbatim from
`04-COVERAGE.md`'s CONTEXT discretion table.)

Scan-correction upload/persistence is **explicitly re-deferred**, not
silently dropped a third time. Neither a ROADMAP Phase 4 success criterion
nor a REQUIREMENTS.md ID names a corrections-upload pipeline; 03-05's
in-memory "Fix Issue" capture already satisfies LOG-06 (a Phase 3
requirement, already complete). Building a server-side learning-loop
pipeline over those corrections is new, unscoped work with no locked source
item — named and recorded here rather than dropped a third time.
