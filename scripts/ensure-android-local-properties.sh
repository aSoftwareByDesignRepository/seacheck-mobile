#!/usr/bin/env bash
# Writes android/local.properties (sdk.dir, node.dir) for Gradle / Android Studio.
# Safe to re-run after expo prebuild --clean.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
bash "$ROOT/scripts/patch-gradle-foojay.sh"
bash "$ROOT/scripts/patch-expo-node.sh"
bash "$ROOT/scripts/patch-expo-kotlin.sh"
bash "$ROOT/scripts/patch-node-gradle.sh"
bash "$ROOT/scripts/patch-expo-constants-env.sh"

# Expose node path to all Gradle projects before evaluation (Kotlin plugins read this)
SETTINGS="$ANDROID_DIR/settings.gradle"
if [[ -f "$SETTINGS" ]] && ! grep -q 'seacheckNodeGlobal' "$SETTINGS"; then
  sed -i '/^plugins {/,/^}$/{
    /^}$/a\
\
// SEACHECK_NODE_PATCH — global node path for all subprojects / Kotlin plugins\
gradle.beforeProject { p ->\
  if (!p.rootProject.ext.has("seacheckNodeExecutable")) {\
    def nodeBinary = System.getenv("NODE_BINARY")\
    if (nodeBinary != null && !nodeBinary.isEmpty()) {\
      p.rootProject.ext.seacheckNodeExecutable = nodeBinary\
      return\
    }\
    def localProps = new Properties()\
    def localPropsFile = new File(p.rootProject.projectDir, "local.properties")\
    if (localPropsFile.exists()) {\
      localPropsFile.withInputStream { localProps.load(it) }\
      def nb = localProps.getProperty("node.binary")\
      if (nb != null && !nb.isEmpty()) {\
        p.rootProject.ext.seacheckNodeExecutable = nb\
        return\
      }\
      def nd = localProps.getProperty("node.dir")\
      if (nd != null && !nd.isEmpty()) {\
        p.rootProject.ext.seacheckNodeExecutable = new File(nd, "node").absolutePath\
        return\
      }\
    }\
    p.rootProject.ext.seacheckNodeExecutable = "node"\
  }\
}\
// seacheckNodeGlobal
  }' "$SETTINGS"
  echo "Patched $SETTINGS with global seacheckNodeExecutable"
fi
PROPS="$ANDROID_DIR/local.properties"

resolve_sdk() {
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    printf '%s' "$ANDROID_HOME"
    return 0
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    printf '%s' "$ANDROID_SDK_ROOT"
    return 0
  fi
  local default="$HOME/Android/Sdk"
  if [[ -d "$default" ]]; then
    printf '%s' "$default"
    return 0
  fi
  return 1
}

# RN 0.85 / package.json engines: ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25
node_meets_engines() {
  local bin="$1"
  [[ -n "$bin" && -x "$bin" ]] || return 1
  # Ephemeral AppImage helpers (e.g. Cursor) vanish outside that session — never pin them.
  case "$bin" in
    /tmp/.mount_*) return 1 ;;
  esac
  "$bin" -e '
    const [maj, min, patch] = process.versions.node.split(".").map(Number);
    const ok =
      (maj === 20 && (min > 19 || (min === 19 && patch >= 4))) ||
      (maj === 22 && min >= 13) ||
      (maj === 24 && (min > 3 || (min === 3 && patch >= 0))) ||
      maj >= 25;
    process.exit(ok ? 0 : 1);
  ' 2>/dev/null
}

resolve_node_dir() {
  local candidate dir

  if [[ -n "${NODE_BINARY:-}" ]]; then
    if node_meets_engines "$NODE_BINARY"; then
      dirname "$NODE_BINARY"
      return 0
    fi
    echo "WARN: NODE_BINARY=$NODE_BINARY does not meet engines (^20.19.4 || ^22.13.0 || ^24.3.0 || >=25) — ignoring" >&2
  fi

  # Walk PATH in order; skip AppImage mounts and unsupported engines (e.g. nvm default 22.12).
  local old_ifs="$IFS"
  IFS=':'
  # shellcheck disable=SC2086
  for dir in $PATH; do
    IFS="$old_ifs"
    [[ -n "$dir" ]] || continue
    candidate="$dir/node"
    if node_meets_engines "$candidate"; then
      printf '%s' "$dir"
      return 0
    fi
  done
  IFS="$old_ifs"

  # Newest nvm install that meets engines (do not trust lagging "default" alias alone).
  if [[ -d "$HOME/.nvm/versions/node" ]]; then
    local ver
    while IFS= read -r ver; do
      [[ -z "$ver" ]] && continue
      candidate="$HOME/.nvm/versions/node/${ver}/bin/node"
      if node_meets_engines "$candidate"; then
        printf '%s' "$HOME/.nvm/versions/node/${ver}/bin"
        return 0
      fi
    done < <(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -Vr)
  fi

  return 1
}

SDK="$(resolve_sdk || true)"
if [[ -z "$SDK" ]]; then
  echo "ERROR: Android SDK not found." >&2
  echo "Set ANDROID_HOME to your SDK path, e.g. export ANDROID_HOME=\$HOME/Android/Sdk" >&2
  exit 1
fi

[[ -d "$ANDROID_DIR" ]] || {
  echo "ERROR: $ANDROID_DIR missing — run: npx expo prebuild --platform android" >&2
  exit 1
}

# expo prebuild writes gradle.properties without a trailing newline; appends would
# corrupt the last property (e.g. watchedDirectories=[]reactNativeArchitectures=…).
GRADLE_PROPS="$ANDROID_DIR/gradle.properties"
if [[ -f "$GRADLE_PROPS" ]] && [[ -n "$(tail -c1 "$GRADLE_PROPS" 2>/dev/null || true)" ]]; then
  printf '\n' >>"$GRADLE_PROPS"
fi

NODE_DIR="$(resolve_node_dir || true)"
if [[ -z "$NODE_DIR" ]]; then
  echo "ERROR: no Node binary meets engines (^20.19.4 || ^22.13.0 || ^24.3.0 || >=25)." >&2
  echo "       nvm install 22.22.0 && nvm alias default 22.22.0 && nvm use 22.22.0" >&2
  echo "       Or: export NODE_BINARY=\$HOME/.nvm/versions/node/v22.22.0/bin/node" >&2
  exit 1
fi

{
  printf 'sdk.dir=%s\n' "$SDK"
  printf 'node.dir=%s\n' "$NODE_DIR"
  printf 'node.binary=%s/node\n' "$NODE_DIR"
  NODE_SCRIPT="$ANDROID_DIR/node"
  printf '#!/bin/sh\nexec "%s/node" "$@"\n' "$NODE_DIR" >"$NODE_SCRIPT"
  chmod +x "$NODE_SCRIPT"
} >"$PROPS"

echo "Wrote $PROPS (sdk.dir=$SDK, node.dir=$NODE_DIR, node=$("$NODE_DIR/node" -v 2>/dev/null || echo '?'))"

if [[ "${SEACHECK_APP_VARIANT:-}" == "production" ]]; then
  bash "$ROOT/scripts/write-android-build-env.sh" --production
fi
