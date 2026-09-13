#!/bin/sh
# Scans a built IPA for secrets: known leaked proof credentials, Supabase
# service keys, private keys, and common cloud-provider key formats.
# Usage: scan-ipa-secrets.sh [path/to/App.ipa]
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
IPA=${1:-"$ROOT/native/artifacts/export/CoachCal.ipa"}

if [ ! -f "$IPA" ]; then
    echo "SECRET-SCAN-FAILED: IPA not found: $IPA"
    exit 1
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/coachcal-ipa-scan.XXXXXX") || exit 2
OUT=$(mktemp -d "${TMPDIR:-/tmp}/coachcal-ipa-scan-hits.XXXXXX") || exit 2
trap 'rm -rf "$WORK" "$OUT"' EXIT

if ! unzip -q "$IPA" -d "$WORK"; then
    echo "SECRET-SCAN-FAILED: cannot unzip $IPA"
    exit 2
fi

scan_one() {
    label=$1
    flags=$2
    pattern=$3
    # Hit files live outside WORK so pattern greps never scan their own output.
    # shellcheck disable=SC2086
    grep $flags "$pattern" "$WORK" 2>/dev/null | sed "s|^|$label |" >> "$OUT/hits" || true
}

# Case-sensitive formats: key material shapes.
scan_one supabase_secret_key  "-raoE" 'sb_secret_[A-Za-z0-9][A-Za-z0-9_=-]{19,}'
scan_one private_key_block    "-raoE" '-----BEGIN [A-Z ]*PRIVATE KEY-----'
scan_one aws_access_key       "-raoE" '(AKIA|ASIA)[0-9A-Z]{16}'
scan_one google_api_key       "-raoE" 'AIza[0-9A-Za-z_-]{35}'
scan_one openai_api_key       "-raoE" 'sk-(proj-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]*'
scan_one anthropic_api_key    "-raoE" 'sk-ant-[A-Za-z0-9_-]{20,}'
scan_one stripe_live_key      "-raoE" '(sk|rk)_live_[0-9a-zA-Z]{20,}'
scan_one github_token         "-raoE" 'gh[pousr]_[A-Za-z0-9]{36,}'
scan_one slack_token          "-raoE" 'xox[baprs]-[0-9A-Za-z-]{10,}'
# Case-insensitive: leaked Phase-1 proof credentials and Supabase role boundary.
scan_one proof_leak_literals  "-raioE" 'a@proof\.local|b@proof\.local|phase1-proof-2026'
scan_one proof_domain         "-raioE" 'proof\.local'
scan_one service_role_marker  "-raioE" 'service_role'

# grep cannot see inside base64url JWT payloads: a service-key JWT carries
# "service_role" only after decoding, so decode every JWT-looking string.
find "$WORK" -type f | while IFS= read -r f; do
    SCAN_FILE=${f#"$WORK"/}
    export SCAN_FILE
    strings -a "$f" 2>/dev/null | perl -MMIME::Base64 -e '
        while (my $line = <STDIN>) {
            while ($line =~ /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})/g) {
                my @seg = split /\./, $1;
                my $payload = $seg[1];
                $payload =~ tr/-_/+\//;
                $payload .= "=" x ((4 - length($payload) % 4) % 4);
                my $json = eval { MIME::Base64::decode_base64($payload) } // "";
                if ($json =~ /service_role|sb_secret/) {
                    print "decoded_service_role_jwt $ENV{SCAN_FILE}: service-key JWT payload\n";
                }
            }
        }'
done >> "$OUT/hits"

sort -u -o "$OUT/hits" "$OUT/hits"
FILES=$(find "$WORK" -type f | wc -l | tr -d ' ')
FINDINGS=$(grep -c . "$OUT/hits" 2>/dev/null || true)

if [ "$FINDINGS" -gt 0 ]; then
    echo "SECRET-SCAN-FAILED: $FINDINGS finding(s) in $IPA"
    while IFS= read -r hit; do
        label=${hit%% *}
        rest=${hit#* }
        file=${rest%%:*}
        file=${file#"$WORK"/}
        match=${rest#*:}
        printf '  [%s] %s : %.24s...REDACTED\n' "$label" "$file" "$match"
    done < "$OUT/hits"
    exit 1
fi

echo "SECRET-SCAN-CLEAN: $FILES files scanned in $IPA, zero secret matches"
exit 0
