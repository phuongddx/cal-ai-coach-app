# Credential Rotation Evidence — Plan 1.1-06 Task 2 (Human Checkpoint)

## Disposition: Legacy proof accounts retired by nonexistence (operator-approved)

- **Checkpoint closed by:** operator (ddphuong), 2026-09-13 ~20:56 +07 (13:56 UTC), selecting the
  pragmatic disposition (Option B) after reviewing the verification below.
- **Legacy accounts:** the two Phase-1 proof accounts (`a@proof.local`, `b@proof.local`).
- **Legacy credential:** the Phase-1 shared proof password (value deliberately not reproduced in
  this or any report; referenced hereafter as "the leaked credential").

## Verification (2026-09-13T13:58:30Z)

| Check | Result |
|-------|--------|
| `auth.users` rows for the two legacy proof emails | **0** (accounts absent) |
| Total `auth.users` rows on the stack | 38 (all ephemeral per-run proof accounts) |
| Password grant with the leaked credential, account a | **HTTP 400** (invalid credentials) |
| Password grant with the leaked credential, account b | **HTTP 400** (invalid credentials) |
| Sessions / refresh tokens for the legacy accounts | none possible — accounts absent |

## Basis

1. The local stack was rebuilt via `supabase db reset` on 2026-09-13 (18:23 +07), which wiped
   `auth.users`; the legacy proof accounts were not recreated.
2. The leaked credential is therefore invalid by nonexistence: no account accepts it, and no
   session or refresh token for those accounts can exist.
3. New proof automation creates ephemeral per-run accounts (DEC-1105-02); the legacy accounts are
   permanently retired and will not be recreated.
4. Recreating the accounts with new passwords was evaluated and rejected as strictly worse: it
   would reintroduce two long-lived credential rows to protect for no functional need.

## Ordering requirement

This checkpoint is closed BEFORE any TestFlight upload attempt in Task 5; the rotation evidence
timestamp above precedes the upload timestamp recorded in the TestFlight report.

ROTATION-VERIFIED
