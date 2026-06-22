#!/usr/bin/env bash
# Remove Android build outputs without ./gradlew clean (RN CMake codegen paths break clean).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Removing Android build caches (safe clean)"
rm -rf \
  android/app/build \
  android/app/.cxx \
  android/build \
  android/.gradle

# expo-audio and other Expo modules compile from node_modules — drop their build dirs too.
find node_modules -path '*/android/build' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find node_modules -path '*/android/.cxx' -type d -prune -exec rm -rf {} + 2>/dev/null || true

echo "==> Done. Run npm run android to rebuild."
