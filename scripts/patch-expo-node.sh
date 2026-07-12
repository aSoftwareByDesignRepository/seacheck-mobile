#!/usr/bin/env bash
# Expo's Gradle plugins call bare `node` — Android Studio (Flatpak) has no nvm on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPO_GRADLE="$ROOT/node_modules/expo-modules-autolinking/android/expo-gradle-plugin"
SETTINGS_UTILS="$EXPO_GRADLE/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/utils"
NODE_UTIL="$SETTINGS_UTILS/NodeExecutable.kt"
MARKER="SEACHECK_NODE_PATCH"

[[ -d "$EXPO_GRADLE" ]] || {
  echo "patch-expo-node: skip (expo-modules-autolinking not installed)" >&2
  exit 0
}

if [[ ! -f "$NODE_UTIL" ]]; then
  cat >"$NODE_UTIL" <<'EOF'
package expo.modules.plugin.utils

import java.io.File
import java.util.Properties

// SEACHECK_NODE_PATCH — resolve Node for Gradle when IDE PATH lacks nvm
fun resolveNodeExecutable(androidRootDir: File): String {
  Env.getProcessEnv("NODE_BINARY")?.takeIf { it.isNotEmpty() }?.let { return it }

  val localProps = Properties()
  val localPropsFile = File(androidRootDir, "local.properties")
  if (localPropsFile.exists()) {
    localPropsFile.inputStream().use { localProps.load(it) }
    localProps.getProperty("node.binary")?.takeIf { it.isNotEmpty() }?.let { return it }
    localProps.getProperty("node.dir")?.takeIf { it.isNotEmpty() }?.let {
      return File(it, "node").absolutePath
    }
  }

  return "node"
}
EOF
  echo "patch-expo-node: wrote NodeExecutable.kt"
fi

patch_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  if grep -q "$MARKER" "$file"; then
    return 0
  fi

  case "$file" in
    *ExpoAutolinkingSettingsPlugin.kt)
      sed -i '1a import expo.modules.plugin.utils.resolveNodeExecutable' "$file"
      sed -i 's/env.commandLine("node",/env.commandLine(resolveNodeExecutable(settings.rootDir), \/* SEACHECK_NODE_PATCH *\//' "$file"
      ;;
    *ExpoAutolinkingSettingsExtension.kt)
      sed -i '1a import expo.modules.plugin.utils.resolveNodeExecutable' "$file"
      sed -i 's/env.commandLine("node",/env.commandLine(resolveNodeExecutable(settings.rootDir), \/* SEACHECK_NODE_PATCH *\//' "$file"
      sed -i '/val commandBuilder = AutolinkingCommandBuilder()/a\      .nodeExecutable(resolveNodeExecutable(settings.rootDir)) \/* SEACHECK_NODE_PATCH */' "$file"
      ;;
    *SettingsManager.kt)
      sed -i '1a import expo.modules.plugin.utils.resolveNodeExecutable' "$file"
      sed -i '/\.useAutolinkingOptions(autolinkingOptions)/a\      .nodeExecutable(resolveNodeExecutable(settings.rootDir)) \/* SEACHECK_NODE_PATCH */' "$file"
      ;;
    *AutolinkingCommandBuilder.kt)
      return 0
      ;;
  esac
  echo "patch-expo-node: patched $(basename "$file")"
}

patch_file "$EXPO_GRADLE/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingSettingsPlugin.kt"
patch_file "$EXPO_GRADLE/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingSettingsExtension.kt"
patch_file "$EXPO_GRADLE/expo-autolinking-settings-plugin/src/main/kotlin/expo/modules/plugin/SettingsManager.kt"

# AutolinkingCommandBuilder: write full file (sed is too fragile for multiline kotlin)
ACB="$EXPO_GRADLE/expo-autolinking-plugin-shared/src/main/kotlin/expo/modules/plugin/AutolinkingCommandBuilder.kt"
if [[ -f "$ACB" ]] && ! grep -q "$MARKER" "$ACB"; then
  cat >"$ACB" <<'EOF'
package expo.modules.plugin

/**
 * Builder for creating command to run using `expo-modules-autolinking`.
 */
class AutolinkingCommandBuilder {
  private val baseCommandTail = listOf(
    "--no-warnings",
    "--eval",
    "require('expo/bin/autolinking')",
    "expo-modules-autolinking"
  )

  private var nodeExecutable: String = "node" /* SEACHECK_NODE_PATCH */

  fun nodeExecutable(executable: String) = apply {
    nodeExecutable = executable
  }

  private val platform = listOf(
    "--platform",
    "android"
  )

  private var autolinkingCommand = emptyList<String>()
  private var useJson = emptyList<String>()
  private val optionsMap = mutableSetOf<Pair<String, String>>()
  private var searchPaths = emptyList<String>()

  fun command(command: String) = apply {
    autolinkingCommand = listOf(command)
  }

  fun option(key: String, value: String) = apply {
    optionsMap.add(key to value)
  }

  fun option(key: String, value: List<String>) = apply {
    value.forEach { optionsMap.add(key to it) }
  }

  fun useJson() = apply {
    useJson = listOf("--json")
  }

  fun searchPaths(paths: List<String>) = apply {
    searchPaths = paths
  }

  fun useAutolinkingOptions(autolinkingOptions: AutolinkingOptions) = apply {
    autolinkingOptions.exclude?.let { option(EXCLUDE_KEY, it) }
    autolinkingOptions.searchPaths?.let { searchPaths(it) }
  }

  fun build(): List<String> {
    val command = listOf(nodeExecutable) + baseCommandTail +
      autolinkingCommand +
      platform +
      useJson +
      optionsMap.map { (key, value) -> listOf("--$key", value) }.flatMap { it } +
      searchPaths
    return Os.windowsAwareCommandLine(command)
  }

  companion object {
    const val EXCLUDE_KEY = "exclude"
  }
}
EOF
  echo "patch-expo-node: patched AutolinkingCommandBuilder.kt"
fi

echo "patch-expo-node: done"
