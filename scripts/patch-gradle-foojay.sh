#!/usr/bin/env bash
# Gradle 9 removed JvmVendorSpec.IBM_SEMERU; @react-native/gradle-plugin still pins
# foojay-resolver-convention 0.5.0 which references it. Bump to 1.0.0+.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/node_modules/@react-native/gradle-plugin/settings.gradle.kts"

[[ -f "$TARGET" ]] || {
  echo "patch-gradle-foojay: skip (no @react-native/gradle-plugin yet — run npm install)" >&2
  exit 0
}

if grep -q 'foojay-resolver-convention").version("0\.' "$TARGET"; then
  sed -i 's/foojay-resolver-convention").version("0\.[0-9.]*")/foojay-resolver-convention").version("1.0.0")/' "$TARGET"
  echo "patch-gradle-foojay: updated foojay-resolver-convention to 1.0.0 in @react-native/gradle-plugin"
elif grep -q 'foojay-resolver-convention").version("1\.' "$TARGET"; then
  echo "patch-gradle-foojay: already on foojay-resolver-convention 1.x"
else
  echo "patch-gradle-foojay: WARN — unexpected settings.gradle.kts layout in $TARGET" >&2
  exit 1
fi
