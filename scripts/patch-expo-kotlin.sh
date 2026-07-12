#!/usr/bin/env bash
# Patch Expo/RN Gradle Kotlin plugins that hardcode `node`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_MODULES="$ROOT/node_modules"
MARKER="SEACHECK_NODE_PATCH"

resolve_node_kt='package expo.modules.plugin.gradle

import org.gradle.api.Project
import java.io.File
import java.util.Properties

// SEACHECK_NODE_PATCH
fun resolveNodeExecutable(project: Project): String {
  val cached = project.rootProject.extensions.extraProperties.properties["seacheckNodeExecutable"]
  if (cached is String && cached.isNotEmpty()) {
    return cached
  }
  System.getenv("NODE_BINARY")?.takeIf { it.isNotEmpty() }?.let { return it }
  val localProps = Properties()
  val localPropsFile = File(project.rootProject.projectDir, "local.properties")
  if (localPropsFile.exists()) {
    localPropsFile.inputStream().use { localProps.load(it) }
    localProps.getProperty("node.binary")?.takeIf { it.isNotEmpty() }?.let { return it }
    localProps.getProperty("node.dir")?.takeIf { it.isNotEmpty() }?.let {
      return File(it, "node").absolutePath
    }
  }
  return "node"
}
'

resolve_node_kt_autolinking='package expo.modules.plugin

import org.gradle.api.Project
import java.io.File
import java.util.Properties

// SEACHECK_NODE_PATCH
fun resolveNodeExecutableForProject(project: Project): String {
  val cached = project.rootProject.extensions.extraProperties.properties["seacheckNodeExecutable"]
  if (cached is String && cached.isNotEmpty()) {
    return cached
  }
  System.getenv("NODE_BINARY")?.takeIf { it.isNotEmpty() }?.let { return it }
  val localProps = Properties()
  val localPropsFile = File(project.rootProject.projectDir, "local.properties")
  if (localPropsFile.exists()) {
    localPropsFile.inputStream().use { localProps.load(it) }
    localProps.getProperty("node.binary")?.takeIf { it.isNotEmpty() }?.let { return it }
    localProps.getProperty("node.dir")?.takeIf { it.isNotEmpty() }?.let {
      return File(it, "node").absolutePath
    }
  }
  return "node"
}
'

patch_kotlin_file() {
  local file="$1"
  local util_file="$2"
  local util_content="$3"
  local import_line="$4"
  local resolve_fn="$5"

  [[ -f "$file" ]] || return 0
  if grep -q "$MARKER" "$file"; then
    return 0
  fi

  if [[ ! -f "$util_file" ]]; then
    mkdir -p "$(dirname "$util_file")"
    printf '%s\n' "$util_content" >"$util_file"
    echo "patch-expo-kotlin: wrote $(basename "$util_file")"
  fi

  sed -i "1a $import_line" "$file"
  sed -i "s/commandLine(\"node\",/commandLine($resolve_fn, \/* $MARKER *\//" "$file"
  sed -i 's/"node",/'"$resolve_fn"', \/* '"$MARKER"' *\//g' "$file"
  echo "patch-expo-kotlin: patched ${file#$NODE_MODULES/}"
}

# expo-modules-core — expo-module-gradle-plugin (expo-modules-core build failure)
CORE_PLUGIN="$NODE_MODULES/expo-modules-core/expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/gradle"
patch_kotlin_file \
  "$CORE_PLUGIN/ExpoGradleHelperExtension.kt" \
  "$CORE_PLUGIN/NodeExecutable.kt" \
  "$resolve_node_kt" \
  "import expo.modules.plugin.gradle.resolveNodeExecutable" \
  "resolveNodeExecutable(project)"

# expo-autolinking project plugin
AUTO_PLUGIN="$NODE_MODULES/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin"
patch_kotlin_file \
  "$AUTO_PLUGIN/ExpoAutolinkingPlugin.kt" \
  "$AUTO_PLUGIN/NodeExecutable.kt" \
  "$resolve_node_kt_autolinking" \
  "import expo.modules.plugin.resolveNodeExecutableForProject" \
  "resolveNodeExecutableForProject(project)"

# React Native PathUtils fallback
PATH_UTILS="$NODE_MODULES/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/PathUtils.kt"
if [[ -f "$PATH_UTILS" ]] && ! grep -q "$MARKER" "$PATH_UTILS"; then
  sed -i '1a import java.io.File\nimport java.util.Properties' "$PATH_UTILS"
  sed -i '/internal fun detectedCliFile/i\
// SEACHECK_NODE_PATCH\
private fun resolveNodeFromLocalProperties(project: Project): String {\
  System.getenv("NODE_BINARY")?.takeIf { it.isNotEmpty() }?.let { return it }\
  val localProps = java.util.Properties()\
  val localPropsFile = File(project.rootProject.projectDir, "local.properties")\
  if (localPropsFile.exists()) {\
    localPropsFile.inputStream().use { localProps.load(it) }\
    localProps.getProperty("node.binary")?.takeIf { it.isNotEmpty() }?.let { return it }\
    localProps.getProperty("node.dir")?.takeIf { it.isNotEmpty() }?.let {\
      return File(it, "node").absolutePath\
    }\
  }\
  return "node"\
}\
' "$PATH_UTILS"
  sed -i 's/exec.commandLine("node",/exec.commandLine(resolveNodeFromLocalProperties(project), \/* SEACHECK_NODE_PATCH *\//' "$PATH_UTILS"
  echo "patch-expo-kotlin: patched PathUtils.kt"
fi

echo "patch-expo-kotlin: done"
