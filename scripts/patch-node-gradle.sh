#!/usr/bin/env bash
# Patches ALL node_modules Gradle files that call bare `node`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="SEACHECK_NODE_PATCH"
NODE_MODULES="$ROOT/node_modules"

RESOLVER_SNIPPET='// SEACHECK_NODE_PATCH — Node path for Gradle when IDE PATH lacks nvm (see android/local.properties)
def seacheckResolveNodeExecutable = {
  def nodeBinary = System.getenv("NODE_BINARY")
  if (nodeBinary != null && !nodeBinary.isEmpty()) {
    return nodeBinary
  }
  def localProps = new Properties()
  def localPropsFile = rootProject.file("local.properties")
  if (localPropsFile.exists()) {
    localPropsFile.withInputStream { localProps.load(it) }
    def nodeBinaryProp = localProps.getProperty("node.binary")
    if (nodeBinaryProp != null && !nodeBinaryProp.isEmpty()) {
      return nodeBinaryProp
    }
    def nodeDir = localProps.getProperty("node.dir")
    if (nodeDir != null && !nodeDir.isEmpty()) {
      return new File(nodeDir, "node").absolutePath
    }
  }
  return "node"
}()
rootProject.ext.seacheckNodeExecutable = seacheckResolveNodeExecutable
'

insert_resolver() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"

  if head -20 "$file" | grep -q '^plugins {'; then
    # Gradle requires plugins {} first — insert resolver after that block
    awk -v snippet="$RESOLVER_SNIPPET" '
      /^plugins \{/ { in_plugins=1 }
      in_plugins && /^\}$/ && !done {
        print $0
        print ""
        print snippet
        done=1
        next
      }
      { print }
    ' "$file" >"$tmp"
  else
    printf '%s\n' "$RESOLVER_SNIPPET" >"$tmp"
    cat "$file" >>"$tmp"
  fi
  mv "$tmp" "$file"
}

patch_gradle_node() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  grep -qE 'commandLine\("node"|\["node"|commandLine\('\''node'\''' "$file" || return 0

  if ! grep -q "$MARKER" "$file"; then
    insert_resolver "$file"
    echo "patch-node-gradle: patched ${file#$NODE_MODULES/}"
  elif ! grep -q 'rootProject.ext.seacheckNodeExecutable = seacheckResolveNodeExecutable' "$file"; then
    sed -i '0,/^}()$/s/^}()$/}()\nrootProject.ext.seacheckNodeExecutable = seacheckResolveNodeExecutable/' "$file"
    echo "patch-node-gradle: added rootProject.ext ${file#$NODE_MODULES/}"
  fi

  sed -i \
    -e 's/commandLine("node",/commandLine(rootProject.ext.seacheckNodeExecutable,/' \
    -e 's/commandLine('\''node'\'',/commandLine(rootProject.ext.seacheckNodeExecutable,/' \
    -e 's/\[seacheckResolveNodeExecutable\]/[rootProject.ext.seacheckNodeExecutable]/' \
    -e 's/\[seacheckResolveNodeExecutable,/[rootProject.ext.seacheckNodeExecutable,/' \
    -e 's/\["node"\]/[rootProject.ext.seacheckNodeExecutable]/' \
    -e 's/\["node",/[rootProject.ext.seacheckNodeExecutable,/' \
    "$file"
}

while IFS= read -r -d '' file; do
  patch_gradle_node "$file"
done < <(find "$NODE_MODULES" -name '*.gradle' -print0 2>/dev/null)

echo "patch-node-gradle: done"
