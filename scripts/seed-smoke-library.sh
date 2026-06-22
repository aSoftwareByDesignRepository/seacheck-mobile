#!/usr/bin/env bash
# Ensure Docker Nextcloud has at least one indexed track for mobile API smoke tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NC_ROOT="$(cd "$ROOT/../nextcloud" && pwd)"
SMOKE_USER="${AUDIOCHECK_SMOKE_USER:-admin}"
SEED_PHP="$(cd "$(dirname "$0")" && pwd)/seed-smoke-library.php"

if ! docker compose -f "$NC_ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q nextcloud-app; then
  echo "SKIP: nextcloud container is not running"
  exit 0
fi

echo "==> Seeding smoke library for ${SMOKE_USER}"
docker compose -f "$NC_ROOT/docker-compose.yml" exec -T \
  -e "AUDIOCHECK_SMOKE_USER=${SMOKE_USER}" \
  nextcloud php < "$SEED_PHP"
echo "Smoke library seed complete."
