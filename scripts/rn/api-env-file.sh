# Prints the env file scripts/rn/start-api.sh writes for this checkout. RN_API_ENV_FILE overrides it.
#
# The name carries a hash of the checkout path, so a worktree never reads the cluster another one
# started (three units of wave 2 tested against a schema they did not have). The Jest harness of
# apps/api derives the same name: apps/api/src/testing/sqlHarness.ts, `defaultEnvFile`.
#
# Source this file and call `api_env_file`.
api_env_file() {
  local root key
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  key="$(printf '%s' "$root" | shasum -a 256 | cut -c1-12)"
  printf '%s\n' "${RN_API_ENV_FILE:-${TMPDIR:-/tmp}/coachcal-rn-api-$key.env}"
}
