#!/usr/bin/env bash
# Smoke-test AudioCheck server APIs from the Docker Nextcloud container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NC_ROOT="$(cd "$ROOT/../nextcloud" && pwd)"

if ! docker compose -f "$NC_ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q nextcloud-app; then
  echo "FAIL: nextcloud container is not running. Start with: cd nextcloud && ./dev-setup.sh start"
  exit 1
fi

exec_in_app() {
  docker compose -f "$NC_ROOT/docker-compose.yml" exec -T nextcloud "$@"
}

echo "==> Checking audiocheck app is enabled"
exec_in_app php occ app:list | grep -E '^\s+-\s+audiocheck:' >/dev/null || {
  echo "FAIL: audiocheck app not enabled"
  exit 1
}

echo "==> Checking API routes respond (unauthenticated should be 401, not 404)"
for path in \
  "/index.php/apps/audiocheck/api/queue" \
  "/index.php/apps/audiocheck/api/tracks" \
  "/index.php/apps/audiocheck/api/collections" \
  "/index.php/apps/audiocheck/api/facets/artists"; do
  code="$(exec_in_app curl -s -o /dev/null -w '%{http_code}' "http://localhost${path}")"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "FAIL: $path returned HTTP $code (expected 401/403)"
    exit 1
  fi
  echo "PASS: $path -> $code"
done

echo "==> Checking stream route exists (HEAD not supported; GET without auth -> 401)"
stream_code="$(exec_in_app curl -s -o /dev/null -w '%{http_code}' "http://localhost/index.php/apps/audiocheck/api/stream/1")"
if [[ "$stream_code" != "401" && "$stream_code" != "403" && "$stream_code" != "404" ]]; then
  echo "FAIL: stream route returned HTTP $stream_code"
  exit 1
fi
echo "PASS: stream route -> $stream_code"

if [[ "${SKIP_AUTH_SMOKE:-}" != "1" ]]; then
  bash "$(dirname "$0")/server-auth-smoke.sh"
fi

echo "Server API smoke test passed."
