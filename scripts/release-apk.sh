#!/usr/bin/env bash
# Production release APK (sideload). Matches docs/build-it.md — do not skip steps.
# Set SKIP_GRADLE=1 to stop after prebuild + local.properties (CI / agent hosts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# npm sets INIT_CWD to the directory where `npm run` was invoked. Catch the common
# footgun of running SeaCheck scripts while cwd is another app (e.g. kiosk).
CALLER="${INIT_CWD:-${PWD}}"
caller_pkg=""
if [[ -f "$CALLER/package.json" ]]; then
  caller_pkg="$(node -p 'require(process.argv[1]).name' "$CALLER/package.json" 2>/dev/null || true)"
fi
root_pkg="$(node -p 'require(process.argv[1]).name' "$ROOT/package.json" 2>/dev/null || true)"

if [[ "$root_pkg" != "seacheck-mobile" ]]; then
  echo "ERROR: release-apk.sh must live under SeaCheck (seacheck-mobile)." >&2
  echo "       Found package: ${root_pkg:-<unreadable>} at $ROOT" >&2
  exit 1
fi

if [[ -n "$caller_pkg" && "$caller_pkg" != "seacheck-mobile" ]]; then
  echo "ERROR: release:apk was invoked from another app directory." >&2
  echo "       Caller: $CALLER (package: $caller_pkg)" >&2
  echo "       SeaCheck: cd $ROOT && npm run release:apk" >&2
  if [[ "$caller_pkg" == "arbeitszeitcheck-kiosk" ]]; then
    echo "       Terminal/kiosk builds: see mobile/arbeitszeitcheck-kiosk/docs/build-it.md" >&2
  fi
  exit 1
fi

# Also require realpath match when INIT_CWD is set (npm run) so a copied script
# cannot be executed from a foreign tree without noticing.
if [[ -n "${INIT_CWD:-}" ]]; then
  caller_real="$(realpath "$INIT_CWD")"
  root_real="$(realpath "$ROOT")"
  if [[ "$caller_real" != "$root_real" ]]; then
    echo "ERROR: npm run release:apk must be started from $ROOT" >&2
    echo "       Current INIT_CWD=$INIT_CWD" >&2
    exit 1
  fi
fi

cd "$ROOT"

for req in icons android:clean android:release; do
  if ! node -e "const s=require('./package.json').scripts||{}; if(!s['$req']) process.exit(1)"; then
    echo "ERROR: missing npm script \"$req\" — wrong directory or broken package.json" >&2
    exit 1
  fi
done

# RN 0.85 rejects Node 22.12.x (EBADENGINE). Match package.json engines.
if ! node -e '
  const [maj, min, patch] = process.versions.node.split(".").map(Number);
  const ok =
    (maj === 20 && (min > 19 || (min === 19 && patch >= 4))) ||
    (maj === 22 && min >= 13) ||
    (maj === 24 && (min > 3 || (min === 3 && patch >= 0))) ||
    maj >= 25;
  if (!ok) {
    console.error("ERROR: Node " + process.versions.node + " unsupported. Need ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25");
    console.error("       nvm install 22.22.0 && nvm alias default 22.22.0 && nvm use 22.22.0");
    process.exit(1);
  }
'; then
  exit 1
fi

echo "==> Dependencies (Node $(node -v))"
npm install
npx expo install --check

echo "==> Quality gate"
npm run preflight

echo "==> Launcher icons from SVG sources"
npm run icons

echo "==> Regenerate android/ (production — no expo-dev-client)"
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean

echo "==> Node path + Gradle patches"
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh

echo "==> Clean native build caches"
npm run android:clean

if [[ "${SKIP_GRADLE:-}" == "1" ]]; then
  echo "SKIP_GRADLE=1 — stopping before assembleRelease."
  echo "Next: npm run android:release"
  exit 0
fi

echo "==> assembleRelease"
npm run android:release

VERSION="$(grep -E "^\s*version:" app.config.ts | head -1 | sed "s/.*'\([^']*\)'.*/\1/")"
APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK_SRC" ]] || {
  echo "ERROR: missing $APK_SRC" >&2
  exit 1
}

mkdir -p "${HOME}/Downloads/apk-releases"
APK_DST="${HOME}/Downloads/apk-releases/seacheck-${VERSION}-release.apk"
cp "$APK_SRC" "$APK_DST"
ls -lh "$APK_DST"
echo "Release APK ready: $APK_DST"
