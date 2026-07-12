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

resolve_node_dir() {
  if [[ -n "${NODE_BINARY:-}" && -x "$NODE_BINARY" ]]; then
    dirname "$NODE_BINARY"
    return 0
  fi

  local nvm_default="$HOME/.nvm/alias/default"
  if [[ -f "$nvm_default" ]]; then
    local ver
    ver="$(tr -d ' \t\r\n' <"$nvm_default")"
    [[ "$ver" != v* ]] && ver="v${ver}"
    local nvm_node="$HOME/.nvm/versions/node/${ver}/bin/node"
    if [[ -x "$nvm_node" ]]; then
      dirname "$nvm_node"
      return 0
    fi
  fi

  if [[ -d "$HOME/.nvm/versions/node" ]]; then
    local latest
    latest="$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1 || true)"
    if [[ -n "$latest" && -x "$HOME/.nvm/versions/node/${latest}/bin/node" ]]; then
      printf '%s' "$HOME/.nvm/versions/node/${latest}/bin"
      return 0
    fi
  fi

  if command -v node >/dev/null 2>&1; then
    local node_path
    node_path="$(command -v node)"
    if [[ "$node_path" != /tmp/.mount_* ]]; then
      dirname "$node_path"
      return 0
    fi
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

{
  printf 'sdk.dir=%s\n' "$SDK"
  NODE_DIR="$(resolve_node_dir || true)"
  if [[ -n "$NODE_DIR" ]]; then
    printf 'node.dir=%s\n' "$NODE_DIR"
    printf 'node.binary=%s/node\n' "$NODE_DIR"
    NODE_SCRIPT="$ANDROID_DIR/node"
    printf '#!/bin/sh\nexec "%s/node" "$@"\n' "$NODE_DIR" >"$NODE_SCRIPT"
    chmod +x "$NODE_SCRIPT"
  else
    echo "WARN: node not found — Android Studio Gradle sync may fail." >&2
    echo "      Install Node (nvm) or set NODE_BINARY before running this script." >&2
  fi
} >"$PROPS"

echo "Wrote $PROPS (sdk.dir=$SDK${NODE_DIR:+, node.dir=$NODE_DIR})"
