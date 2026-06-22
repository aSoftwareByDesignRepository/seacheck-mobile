#!/usr/bin/env bash
# UAT scenario A4: revoked app password returns 401 (session expiry path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NC_ROOT="$(cd "$ROOT/../nextcloud" && pwd)"
SMOKE_USER="${AUDIOCHECK_SMOKE_USER:-admin}"
SCENARIO_NAME="audiocheck-uat-a4-revoke"

if ! docker compose -f "$NC_ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q nextcloud-app; then
  echo "SKIP UAT A4: nextcloud container is not running"
  exit 0
fi

exec_in_app() {
  docker compose -f "$NC_ROOT/docker-compose.yml" exec -T nextcloud "$@"
}

resolve_token_id() {
  local user="$1"
  local name="$2"
  exec_in_app php occ user:auth-tokens:list "$user" | awk -F'|' -v n="$name" '
    index($0, "|") && $3 ~ n {
      gsub(/^ +| +$/, "", $2)
      if ($2 + 0 > max) max = $2 + 0
    }
    END { if (max > 0) print max }
  '
}

delete_tokens_named() {
  local user="$1"
  local name="$2"
  local id
  while read -r id; do
    [[ -n "$id" ]] && exec_in_app php occ user:auth-tokens:delete "$user" "$id" -n >/dev/null 2>&1 || true
  done < <(
    exec_in_app php occ user:auth-tokens:list "$user" | awk -F'|' -v n="$name" '
      index($0, "|") && $3 ~ n {
        gsub(/^ +| +$/, "", $2)
        if ($2 != "") print $2
      }
    '
  )
}

cleanup_token() {
  delete_tokens_named "$SMOKE_USER" "$SCENARIO_NAME"
}

trap cleanup_token EXIT

echo "==> UAT A4: create temporary app password"
delete_tokens_named "$SMOKE_USER" "$SCENARIO_NAME"
TOKEN_OUTPUT="$(exec_in_app php occ user:auth-tokens:add "$SMOKE_USER" --name="$SCENARIO_NAME" -n 2>&1)"
APP_PASSWORD="$(printf '%s\n' "$TOKEN_OUTPUT" | awk '/^app password:/{getline; print; exit}')"
if [[ -z "$APP_PASSWORD" ]]; then
  echo "FAIL UAT A4: could not create app password"
  exit 1
fi

auth_header="$(printf '%s:%s' "$SMOKE_USER" "$APP_PASSWORD" | base64 -w0 2>/dev/null || printf '%s:%s' "$SMOKE_USER" "$APP_PASSWORD" | base64)"

echo "==> UAT A4: token should exist in auth-tokens list"
TOKEN_ID="$(resolve_token_id "$SMOKE_USER" "$SCENARIO_NAME")"
if [[ -z "$TOKEN_ID" ]]; then
  echo "FAIL UAT A4: token not found after create"
  exit 1
fi
echo "PASS UAT A4: token id=${TOKEN_ID} created"

echo "==> UAT A4: revoke app password on server"
exec_in_app php occ user:auth-tokens:delete "$SMOKE_USER" "$TOKEN_ID" -n >/dev/null
trap - EXIT
sleep 2

echo "==> UAT A4: revoked token must return 401"
code_revoked="$(exec_in_app curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Basic ${auth_header}" \
  -H 'OCS-APIRequest: true' \
  -H 'Connection: close' \
  "http://localhost/index.php/apps/audiocheck/api/prefs")"
if [[ "$code_revoked" != "401" && "$code_revoked" != "403" ]]; then
  echo "FAIL UAT A4: prefs returned HTTP $code_revoked after revoke (expected 401/403)"
  exit 1
fi
echo "PASS UAT A4: prefs -> $code_revoked after revoke"

echo "UAT server scenario A4 passed."
