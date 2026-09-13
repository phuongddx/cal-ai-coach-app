#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_SERVICE_KEY:-}" && -n "${PROOF_ENV_FILE:-}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROOF_ENV_FILE"
  set +a
fi

: "${SUPABASE_URL:=http://127.0.0.1:54321}"
: "${SUPABASE_SERVICE_KEY:=$SERVICE_ROLE_KEY}"
: "${SUPABASE_ANON_KEY:=$ANON_KEY}"
: "${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY must be set}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY must be set}"
: "${TEST_ACCOUNT_ENV:?TEST_ACCOUNT_ENV must be set}"

email="golden-$(date +%s)-$RANDOM$RANDOM@inbox.test"
password="$(openssl rand -base64 32)"
payload="$(printf '{"email":"%s","password":"%s","email_confirm":true}' "$email" "$password")"

http_status="$(
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --request POST "$SUPABASE_URL/auth/v1/admin/users" \
    --header "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    --header "apikey: $SUPABASE_SERVICE_KEY" \
    --header 'Content-Type: application/json' \
    --data "$payload"
)"

if [[ "$http_status" != 2* ]]; then
  echo "test account creation failed with HTTP $http_status" >&2
  exit 1
fi

cat > "$TEST_ACCOUNT_ENV" <<EOF
TEST_EMAIL=$email
TEST_PASSWORD=$password
EOF
