#!/usr/bin/env bash
# Capture live Play Store phone screenshots for SeaCheck (all supported store locales).
#   source ../../scripts/emulator-acquire.sh && emulator_acquire SeaCheck_Atlas_API_33 --boot-if-needed
#   SEACHECK_RELEASE_APK=... bash scripts/capture-play-screenshots.sh
# Optional: STORE_LOCALE=fr to capture one locale only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERIAL="${SEACHECK_MAESTRO_DEVICE:-${ANDROID_SERIAL:-}}"
APK="${SEACHECK_RELEASE_APK:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
if [[ -z "$SERIAL" ]]; then
  echo "Set SEACHECK_MAESTRO_DEVICE / ANDROID_SERIAL after emulator_acquire" >&2
  exit 1
fi
if [[ ! -f "$APK" ]]; then
  echo "Missing APK: $APK" >&2
  exit 1
fi

_PLAY_LOCALE_SH="$(cd "$ROOT/.." && pwd)/scripts/play-store-locale.sh"
# shellcheck source=../../scripts/play-store-locale.sh
source "$_PLAY_LOCALE_SH"
PLAY_STORE_APP_ROOT="$ROOT"
play_store_ensure_locale_heroes "$ROOT"

map_bcp() {
  case "$1" in
    en) echo en-US ;;
    de) echo de-DE ;;
    fr) echo fr-FR ;;
    es) echo es-ES ;;
    da) echo da-DK ;;
    nl) echo nl-NL ;;
    it) echo it-IT ;;
    pl) echo pl-PL ;;
    sv) echo sv-SE ;;
    nb) echo nb-NO ;;
    pt) echo pt-BR ;;
    *) echo "$1" ;;
  esac
}

LOCALES=(en de fr es da nl it pl sv nb pt)
if [[ -n "${STORE_LOCALE:-}" ]]; then
  play_store_resolve_locale "$STORE_LOCALE"
  LOCALES=("$PLAY_STORE_LOCALE")
fi

for loc in "${LOCALES[@]}"; do
  bcp="$(map_bcp "$loc")"
  if [[ "$loc" == "en" ]]; then
    docs_out="$ROOT/docs/play-store/assets/screenshots"
  else
    docs_out="$ROOT/docs/play-store/assets/screenshots-$loc"
  fi
  mkdir -p "$docs_out"
  echo "==> SeaCheck capture $bcp → $docs_out"
  # Prefer extended python if it accepts the locale; fall back to en/de-only script with note.
  if python3 "$ROOT/scripts/capture-play-locale.py" --help 2>&1 | grep -q "$bcp\|choices"; then
    python3 "$ROOT/scripts/capture-play-locale.py"       --locale "$bcp"       --serial "$SERIAL"       --apk "$APK"       --docs-out "$docs_out"       --fastlane-dir "$ROOT/fastlane/metadata/android/$bcp/images/phoneScreenshots"       || echo "WARN: capture failed for $bcp"
  else
    echo "WARN: capture-play-locale.py does not list $bcp yet — extend choices"
  fi
done

echo "DONE SeaCheck locales: ${LOCALES[*]}"
