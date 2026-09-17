# TestFlight First Build Report — Plan 1.1-06 Task 5

**Status: ASC-HANDOFF** (defined expected-stopping state, DEC-1106-08 — SC5 remains UNMET until
the operator completes the upload and this report is re-issued with `TESTFLIGHT-PROCESSED` +
`SMOKE-PASS`.)

> **UPDATE 2026-09-13 ~21:35 +07 — signing is no longer a blocker.** Via `asc-signing-setup`
> (asc CLI team **K2TYLYAWMK** / Doan Duy Phuong): bundle id `com.nextlabs.coachcal` registered
> (`J47X4FF757`) with the HEALTHKIT capability, new iOS Distribution certificate `7HSKSL3BF9`
> (expires 2027-09-13) minted via inline CSR, App Store profile **"CoachCal AppStore"**
> (`XBPY696S38`, ACTIVE, healthkit + beta-reports-active) issued and installed locally, **signed
> archive succeeded**, and `CoachCal.ipa` exported (chain: iPhone Distribution → WWDR G3 →
> Apple Root CA; TeamIdentifier K2TYLYAWMK). Signed-product secret scan: **SIGNED-PRODUCT-CLEAN**.
> Signing artifacts live in `native/artifacts/signing/` (gitignored; keys 0600) including the
> dedicated `coachcal.keychain-db` holding the identity.

## What was completed (autonomous)

| Step | Result |
|------|--------|
| Release archive (unsigned, initial product-scan artifact) | ✅ `native/artifacts/CoachCal.xcarchive` |
| **Signed Release archive** | ✅ `native/artifacts/CoachCal-signed.xcarchive` (ARCHIVE SUCCEEDED, manual signing) |
| ipa export (method app-store-connect) | ✅ `native/artifacts/export/CoachCal.ipa` (EXPORT SUCCEEDED) |
| Product secret scan over archived `.app` | ✅ zero matches, all three tokens (PRODUCT-CLEAN; re-confirmed SIGNED-PRODUCT-CLEAN) |
| Rotation-before-upload ordering | ✅ rotation evidence 2026-09-13T13:58:30Z < upload attempt 2026-09-13T14:30+Z |
| Release simulator smoke, CLEAN install (uninstall-first per DEC-1106-01) | ✅ WalkingSmokeUITests 2/2 — walking screen title + increment flow |

## Remaining handoff blockers (exact)

1. **No App Store Connect app record** for `com.nextlabs.coachcal`. `asc web apps create` requires
   an authenticated Apple **web** session: `asc web auth status` → appleId
   `95doanphuong@gmail.com`, `authenticated: false` (password not stored; 2FA is interactive).
2. Consequently `asc builds upload` cannot run yet (it requires `--app APP_ID`).

## Operator steps to finish Task 5 (SC5)

1. In a terminal: `asc web auth login --apple-id "95doanphuong@gmail.com"` (password + 2FA).
2. `asc web apps create --name "CoachCal" --bundle-id "com.nextlabs.coachcal" --sku "coachcal-2026"`
3. `asc apps list` → copy the CoachCal APP_ID, then:
   `asc builds upload --app APP_ID --ipa native/artifacts/export/CoachCal.ipa --version "1.0" --build-number "1"`
4. Poll processing (`asc builds list --app APP_ID`) and smoke-launch from TestFlight on a device;
   the on-device smoke also extends the Task 2 checkpoint.
5. Re-issue this report ending with `TESTFLIGHT-PROCESSED` + `SMOKE-PASS`.

## Build identity (from the signed archive)

- Bundle id: `com.nextlabs.coachcal` · version 1.0 (build 1) · deployment target iOS 18.0
- Team: **K2TYLYAWMK** (Doan Duy Phuong) — manual signing, profile "CoachCal AppStore"
- Surface: HealthKit entitlement placeholder, `NSCameraUsageDescription`,
  `ITSAppUsesNonExemptEncryption=false`, `PrivacyInfo.xcprivacy` (tracking=false; email
  collected for app functionality; C617.1 file-timestamp reason) — all present in the product.

SIMULATOR-SMOKE-PASS

---

## UPDATE 2026-09-15 ~22:03 +07 — TestFlight upload processed; device smoke is the only remaining step

Root cause of the 507f3c04 rejection (errors 90683×2, 90713, 90022) was exactly the
uncommitted `project.yml`/`Info.plist`/`Assets.xcassets` edits the earlier update flagged.
Fixed end-to-end:

| Step | Result |
|------|--------|
| Commit health strings + app icon (`native/App/CoachCal/Info.plist`, `native/project.yml`, `Assets.xcassets/AppIcon.appiconset`) | ✅ commit `b0b3595` |
| `xcodegen generate` | ✅ regenerated `CoachCal.xcodeproj` |
| Signing keychain unblock | The dedicated `native/artifacts/signing/coachcal.keychain-db` was locked with an unknown password and popped a GUI prompt during `codesign`, failing the archive with `errSecInternalComponent`. Imported the same identity's `dist.p12` (password on disk at `native/artifacts/signing/p12-pass`) into the default login keychain and dropped `coachcal.keychain-db` from the keychain search list — no password needed, no GUI prompt on retry. |
| Re-archive (Release, signed) | ✅ `native/artifacts/CoachCal-signed.xcarchive` — ARCHIVE SUCCEEDED |
| Re-export (app-store-connect) | ✅ `native/artifacts/export/CoachCal.ipa` — EXPORT SUCCEEDED; confirmed `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` present and `AppIcon60x60@2x.png` is a real 120×120 PNG in the unzipped bundle |
| `scan-ipa-secrets.sh` | ✅ SECRET-SCAN-CLEAN, 22 files, zero matches |
| `check-artifact-compliance.sh` | ✅ COMPLIANCE-OK, com.nextlabs.coachcal 1.0(1) |
| `asc builds upload --app 6811619144 --ipa native/artifacts/export/CoachCal.ipa --version 1.0 --build-number 1` | ✅ uploaded, committed, no immediate rejection (uploadId `0beb43a3-2ad5-42c4-8178-4cfbcc409a9f`) |
| ASC processing | ✅ **TESTFLIGHT-PROCESSED** — `processingState: VALID`, `internalBuildState: READY_FOR_BETA_TESTING` |
| TestFlight internal group | ✅ Created "Internal Testers" (`49bbebae-d9f9-426d-b540-131721530c55`, access-all-builds) and added `95doanphuong@gmail.com` as an internal tester — the build is installable via the TestFlight app now |

**Remaining blocker (operator, device-only):** SMOKE-PASS — open TestFlight on a physical
device signed in as `95doanphuong@gmail.com`, install CoachCal 1.0 (1), launch it, and confirm
the walking screen renders. This cannot be done from this session (no physical device attached).
Once confirmed, re-issue this report ending `TESTFLIGHT-PROCESSED` + `SMOKE-PASS` and re-run
`/gsd-verify-work 1.1` to close SC5.

**Status: TESTFLIGHT-PROCESSED** (SMOKE-PASS outstanding — device install pending)
