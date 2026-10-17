#!/bin/sh
# Asserts the release surface required by ROADMAP SC5 — privacy manifest,
# NSCameraUsageDescription, HealthKit entitlement placeholder — in the
# source-of-truth configs, and inside the built IPA when one exists.
# Usage: check-artifact-compliance.sh [path/to/App.ipa]
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

SRC_PLIST="$ROOT/native/App/CoachCal/Info.plist"
SRC_ENTITLEMENTS="$ROOT/native/App/CoachCal/SupportingFiles/CoachCal.entitlements"
SRC_PRIVACY="$ROOT/native/App/CoachCal/SupportingFiles/PrivacyInfo.xcprivacy"
PROJECT_CONFIG="$ROOT/native/Project.swift"
IPA=${1:-"$ROOT/native/artifacts/export/CoachCal.ipa"}

WORK=$(mktemp -d "${TMPDIR:-/tmp}/coachcal-compliance.XXXXXX") || exit 2
trap 'rm -rf "$WORK"' EXIT
: > "$WORK/failures"

fail() {
    printf '%s\n' "$1" >> "$WORK/failures"
}

if [ ! -f "$SRC_PLIST" ]; then
    fail "source Info.plist missing: $SRC_PLIST"
else
    camera=$(plutil -extract NSCameraUsageDescription raw -o - "$SRC_PLIST" 2>/dev/null) ||
        fail "source Info.plist: NSCameraUsageDescription missing"
    [ -n "${camera:-}" ] || fail "source Info.plist: NSCameraUsageDescription empty"
fi

if [ ! -f "$SRC_ENTITLEMENTS" ]; then
    fail "source entitlements missing: $SRC_ENTITLEMENTS"
elif ! grep -A1 '<key>com.apple.developer.healthkit</key>' "$SRC_ENTITLEMENTS" | grep -q '<true/>'; then
    fail "source entitlements: com.apple.developer.healthkit not set to true"
fi

if [ ! -f "$SRC_PRIVACY" ]; then
    fail "source privacy manifest missing: $SRC_PRIVACY"
else
    plutil -lint "$SRC_PRIVACY" >/dev/null 2>&1 ||
        fail "source PrivacyInfo.xcprivacy: not a valid plist"
    tracking=$(plutil -extract NSPrivacyTracking raw -o - "$SRC_PRIVACY" 2>/dev/null) ||
        fail "source PrivacyInfo.xcprivacy: NSPrivacyTracking key missing"
    [ "${tracking:-}" = "false" ] || fail "source PrivacyInfo.xcprivacy: NSPrivacyTracking must be false"
fi

grep -q 'CoachCal.entitlements' "$PROJECT_CONFIG" 2>/dev/null ||
    fail "Project.swift: CoachCal entitlements not wired"

IPA_MODE=source-only
if [ -f "$IPA" ]; then
    IPA_MODE=ipa
    if ! unzip -q "$IPA" -d "$WORK/ipa"; then
        fail "IPA: cannot unzip $IPA"
    elif [ ! -d "$WORK/ipa/Payload/CoachCal.app" ]; then
        fail "IPA: Payload/CoachCal.app missing"
    else
        APP="$WORK/ipa/Payload/CoachCal.app"

        plutil -lint "$APP/PrivacyInfo.xcprivacy" >/dev/null 2>&1 ||
            fail "IPA bundle: PrivacyInfo.xcprivacy missing or invalid"

        ipa_camera=$(plutil -extract NSCameraUsageDescription raw -o - "$APP/Info.plist" 2>/dev/null) ||
            fail "IPA Info.plist: NSCameraUsageDescription missing"
        [ -n "${ipa_camera:-}" ] || fail "IPA Info.plist: NSCameraUsageDescription empty"

        ent_xml=$(codesign -d --entitlements :- "$APP" 2>/dev/null) ||
            fail "IPA: no embedded entitlements (binary unsigned?)"
        printf '%s\n' "$ent_xml" |
            perl -0777 -ne 'exit 1 unless /<key>com\.apple\.developer\.healthkit<\/key>\s*<true\/>/' ||
            fail "IPA embedded entitlements: com.apple.developer.healthkit true missing"

        bundle_id=$(plutil -extract CFBundleIdentifier raw -o - "$APP/Info.plist" 2>/dev/null || echo "?")
        version=$(plutil -extract CFBundleShortVersionString raw -o - "$APP/Info.plist" 2>/dev/null || echo "?")
        build=$(plutil -extract CFBundleVersion raw -o - "$APP/Info.plist" 2>/dev/null || echo "?")
    fi
fi

FAILS=$(grep -c . "$WORK/failures" 2>/dev/null || true)
if [ "$FAILS" -gt 0 ]; then
    echo "COMPLIANCE-FAILED: $FAILS check(s)"
    while IFS= read -r line; do
        printf '  - %s\n' "$line"
    done < "$WORK/failures"
    exit 1
fi

if [ "$IPA_MODE" = "ipa" ]; then
    echo "COMPLIANCE-OK: source configs and $bundle_id $version($build) IPA carry privacy manifest, camera string, HealthKit entitlement"
else
    echo "COMPLIANCE-OK-SOURCE-ONLY: source configs carry the surface (no IPA at $IPA)"
fi
exit 0
