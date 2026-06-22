#!/usr/bin/env bash
# Authenticated AudioCheck API smoke test (creates a temporary app password).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NC_ROOT="$(cd "$ROOT/../nextcloud" && pwd)"
SMOKE_USER="${AUDIOCHECK_SMOKE_USER:-admin}"
SMOKE_NAME="audiocheck-mobile-smoke"

if ! docker compose -f "$NC_ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q nextcloud-app; then
  echo "SKIP: nextcloud container is not running"
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
  delete_tokens_named "$SMOKE_USER" "$SMOKE_NAME"
}

trap cleanup_token EXIT

echo "==> Creating temporary app password for $SMOKE_USER"
delete_tokens_named "$SMOKE_USER" "$SMOKE_NAME"
TOKEN_OUTPUT="$(exec_in_app php occ user:auth-tokens:add "$SMOKE_USER" --name="$SMOKE_NAME" -n 2>&1)"
APP_PASSWORD="$(printf '%s\n' "$TOKEN_OUTPUT" | awk '/^app password:/{getline; print; exit}')"
if [[ -z "$APP_PASSWORD" ]]; then
  echo "FAIL: could not create app password"
  printf '%s\n' "$TOKEN_OUTPUT"
  exit 1
fi

auth_header="$(printf '%s:%s' "$SMOKE_USER" "$APP_PASSWORD" | base64 -w0 2>/dev/null || printf '%s:%s' "$SMOKE_USER" "$APP_PASSWORD" | base64)"

check_json_route() {
  local path="$1"
  local code
  code="$(exec_in_app curl -s -o /tmp/ac-smoke.json -w '%{http_code}' \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    "http://localhost${path}")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL: $path returned HTTP $code (expected 200)"
    head -c 400 /tmp/ac-smoke.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: $path -> $code"
}

check_ocs_user_route() {
  local path="/ocs/v1.php/cloud/user?format=json"
  local code
  code="$(exec_in_app curl -s -o /tmp/ac-smoke-ocs.json -w '%{http_code}' \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    "http://localhost${path}")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL: $path returned HTTP $code (expected 200)"
    head -c 400 /tmp/ac-smoke-ocs.json 2>/dev/null || true
    echo
    exit 1
  fi
  local ocs_code
  ocs_code="$(exec_in_app php -r '$d=json_decode(file_get_contents("/tmp/ac-smoke-ocs.json"), true); echo (int)($d["ocs"]["meta"]["statuscode"] ?? 0);')"
  if [[ "$ocs_code" != "100" && "$ocs_code" != "200" ]]; then
    echo "FAIL: $path OCS statuscode=$ocs_code (expected 100 or 200)"
    head -c 400 /tmp/ac-smoke-ocs.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: $path -> HTTP $code, OCS statuscode=$ocs_code"
}

echo "==> Checking authenticated API routes"
bash "$(dirname "$0")/seed-smoke-library.sh"
check_ocs_user_route
check_json_route "/index.php/apps/audiocheck/api/prefs"
check_json_route "/index.php/apps/audiocheck/api/library/sync-state"
check_json_route "/index.php/apps/audiocheck/api/queue"
check_json_route "/index.php/apps/audiocheck/api/tracks?limit=1"
check_json_route "/index.php/apps/audiocheck/api/tracks?limit=1&hideListened=1"
check_json_route "/index.php/apps/audiocheck/api/collections?limit=1"
check_json_route "/index.php/apps/audiocheck/api/facets/artists?limit=1"
check_json_route "/index.php/apps/audiocheck/api/playlists"
check_json_route "/index.php/apps/audiocheck/api/progress"

echo "==> Checking playlist pin mutation (PUT)"
pin_body='{"isPinned":true}'
pin_code="$(exec_in_app curl -s -o /tmp/ac-smoke-pin.json -w '%{http_code}' \
  -X PUT \
  -H "Authorization: Basic ${auth_header}" \
  -H 'OCS-APIRequest: true' \
  -H 'Content-Type: application/json' \
  -d "$pin_body" \
  "http://localhost/index.php/apps/audiocheck/api/playlists/1")"
if [[ "$pin_code" != "200" && "$pin_code" != "404" ]]; then
  echo "FAIL: playlist pin returned HTTP $pin_code (expected 200 or 404 when no playlist)"
  head -c 400 /tmp/ac-smoke-pin.json 2>/dev/null || true
  echo
  exit 1
fi
echo "PASS: playlist pin -> $pin_code"

echo "==> Checking queue save (PUT)"
queue_code="$(exec_in_app curl -s -o /tmp/ac-smoke-queue.json -w '%{http_code}' \
  -X PUT \
  -H "Authorization: Basic ${auth_header}" \
  -H 'OCS-APIRequest: true' \
  -H 'Content-Type: application/json' \
  -d '{"fileIds":[],"currentIndex":0,"playbackSpeed":100,"shuffle":false,"repeatMode":"off"}' \
  "http://localhost/index.php/apps/audiocheck/api/queue")"
if [[ "$queue_code" != "200" ]]; then
  echo "FAIL: queue save returned HTTP $queue_code"
  head -c 400 /tmp/ac-smoke-queue.json 2>/dev/null || true
  echo
  exit 1
fi
echo "PASS: queue save -> $queue_code"

echo "==> Checking progress save (PUT) when library has tracks"
FILE_ID="$(exec_in_app curl -s \
  -H "Authorization: Basic ${auth_header}" \
  -H 'OCS-APIRequest: true' \
  "http://localhost/index.php/apps/audiocheck/api/tracks?limit=1" \
  | php -r '$d=json_decode(stream_get_contents(STDIN), true); echo (int)($d["items"][0]["fileId"] ?? 0);')"
if [[ "$FILE_ID" -gt 0 ]]; then
  progress_code="$(exec_in_app curl -s -o /tmp/ac-smoke-progress.json -w '%{http_code}' \
    -X PUT \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    -H 'Content-Type: application/json' \
    -d "{\"positionMs\":1000,\"durationMs\":60000,\"playbackSpeed\":100,\"finished\":false}" \
    "http://localhost/index.php/apps/audiocheck/api/progress/${FILE_ID}")"
  if [[ "$progress_code" != "200" ]]; then
    echo "FAIL: progress save returned HTTP $progress_code"
    head -c 400 /tmp/ac-smoke-progress.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: progress save fileId=${FILE_ID} -> $progress_code"

  listened_code="$(exec_in_app curl -s -o /tmp/ac-smoke-listened.json -w '%{http_code}' \
    -X PUT \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    -H 'Content-Type: application/json' \
    -d '{"listened":true}' \
    "http://localhost/index.php/apps/audiocheck/api/tracks/${FILE_ID}/listened")"
  if [[ "$listened_code" != "200" ]]; then
    echo "FAIL: listened save returned HTTP $listened_code"
    head -c 400 /tmp/ac-smoke-listened.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: listened save fileId=${FILE_ID} -> $listened_code"

  favorite_code="$(exec_in_app curl -s -o /tmp/ac-smoke-favorite.json -w '%{http_code}' \
    -X PUT \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    -H 'Content-Type: application/json' \
    -d '{"favorite":true}' \
    "http://localhost/index.php/apps/audiocheck/api/tracks/${FILE_ID}/favorite")"
  if [[ "$favorite_code" != "200" ]]; then
    echo "FAIL: favorite save returned HTTP $favorite_code"
    head -c 400 /tmp/ac-smoke-favorite.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: favorite save fileId=${FILE_ID} -> $favorite_code"

  listened_query_code="$(exec_in_app curl -s -o /tmp/ac-smoke-listened-query.json -w '%{http_code}' \
    -X POST \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    -H 'Content-Type: application/json' \
    -d "{\"fileIds\":[${FILE_ID}]}" \
    "http://localhost/index.php/apps/audiocheck/api/listened/query")"
  if [[ "$listened_query_code" != "200" ]]; then
    echo "FAIL: listened query returned HTTP $listened_query_code"
    head -c 400 /tmp/ac-smoke-listened-query.json 2>/dev/null || true
    echo
    exit 1
  fi
  echo "PASS: listened query fileId=${FILE_ID} -> $listened_query_code"

  SIZE_BYTES="$(exec_in_app php -r '$d=json_decode(file_get_contents("/tmp/ac-smoke.json"), true); echo (int)($d["items"][0]["sizeBytes"] ?? -1);' 2>/dev/null || echo -1)"
  if [[ "$SIZE_BYTES" -lt 0 ]]; then
    TRACK_JSON="$(exec_in_app curl -s \
      -H "Authorization: Basic ${auth_header}" \
      -H 'OCS-APIRequest: true' \
      "http://localhost/index.php/apps/audiocheck/api/tracks?limit=1")"
    SIZE_BYTES="$(printf '%s' "$TRACK_JSON" | php -r '$d=json_decode(stream_get_contents(STDIN), true); echo (int)($d["items"][0]["sizeBytes"] ?? -1);')"
  fi
  if [[ "$SIZE_BYTES" -lt 0 ]]; then
    echo "FAIL: tracks response missing sizeBytes"
    exit 1
  fi
  echo "PASS: tracks include sizeBytes=${SIZE_BYTES}"

  MOBILE_MIN="$(exec_in_app curl -s \
    -H "Authorization: Basic ${auth_header}" \
    -H 'OCS-APIRequest: true' \
    "http://localhost/index.php/apps/audiocheck/api/prefs" \
    | php -r '$d=json_decode(stream_get_contents(STDIN), true); echo (int)($d["prefs"]["mobile"]["minApiVersion"] ?? 0);')"
  if [[ "$MOBILE_MIN" -lt 1 ]]; then
    echo "FAIL: prefs.mobile.minApiVersion missing"
    exit 1
  fi
  echo "PASS: prefs.mobile.minApiVersion=${MOBILE_MIN}"

  stream_code="$(exec_in_app curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Basic ${auth_header}" \
    -H 'Range: bytes=0-0' \
    "http://localhost/index.php/apps/audiocheck/api/stream/${FILE_ID}")"
  if [[ "$stream_code" != "200" && "$stream_code" != "206" ]]; then
    echo "FAIL: stream route for fileId=${FILE_ID} returned HTTP $stream_code"
    exit 1
  fi
  echo "PASS: stream route (authenticated) -> $stream_code"
else
  echo "FAIL: no tracks in library after seed (expected at least one)"
  exit 1
fi

echo "Authenticated server API smoke test passed."
