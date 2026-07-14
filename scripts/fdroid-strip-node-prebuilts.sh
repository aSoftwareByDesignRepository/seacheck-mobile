#!/usr/bin/env bash
# Strip non-Android prebuilt artifacts before F-Droid source scan.
# package.json is patched with expo autolinking buildFromSource; Gradle compiles natives.
set -euo pipefail

cd "${1:-.}"

find node_modules -type d -name local-maven-repo -prune -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name prebuilds -prune -exec rm -rf {} + 2>/dev/null || true
find node_modules/react-native/React/I18n -name fbt_language_pack.bin -delete 2>/dev/null || true

rm -rf \
  ios \
  node_modules/hermes-compiler/hermesc/osx-bin \
  node_modules/hermes-compiler/hermesc/win64-bin \
  node_modules/fb-dotslash \
  node_modules/expo/template.tgz \
  node_modules/@expo/expo-modules-macros-plugin/apple \
  node_modules/expo-sqlite/ios \
  node_modules/expo-sqlite/web \
  node_modules/expo-sqlite/android/vec \
  node_modules/expo-sqlite/android/libsql
