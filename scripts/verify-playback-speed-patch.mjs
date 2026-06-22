#!/usr/bin/env node
/**
 * Fail CI/dev preflight when expo-audio is still capped at 2× (patch not applied).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kt = path.join(root, 'node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioPlayer.kt');
const swift = path.join(root, 'node_modules/expo-audio/ios/AudioModule.swift');
const pkgPath = path.join(root, 'package.json');

function fail(msg) {
  console.error(`playback-speed patch: ${msg}`);
  process.exit(1);
}

// CRITICAL: expo-audio ships a precompiled Android AAR (local-maven-repo). Expo autolinking
// links that prebuilt binary unless `expo.autolinking.buildFromSource` opts the module out.
// Without this, the patched Kotlin is never compiled and playback stays capped at 2× — even
// after a full rebuild. This guard fails loudly so the regression can't ship silently.
const prebuiltAar = path.join(
  root,
  'node_modules/expo-audio/local-maven-repo/expo/modules/audio/expo.modules.audio/56.0.12/expo.modules.audio-56.0.12.aar',
);
if (fs.existsSync(prebuiltAar)) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    fail('cannot read package.json to verify buildFromSource opt-out');
  }
  const buildFromSource = pkg?.expo?.autolinking?.buildFromSource ?? [];
  const optedOut = Array.isArray(buildFromSource)
    && buildFromSource.some((pattern) => {
      try {
        return new RegExp(`^(?:${pattern})$`).test('expo-audio');
      } catch {
        return false;
      }
    });
  if (!optedOut) {
    fail(
      'expo-audio has a precompiled AAR but is NOT in expo.autolinking.buildFromSource — '
      + 'the Kotlin patch will be ignored and playback stays at 2×. '
      + 'Add "expo-audio" to expo.autolinking.buildFromSource in package.json.',
    );
  }
}

if (!fs.existsSync(kt)) fail('expo-audio Android sources missing — run npm install');
const ktSrc = fs.readFileSync(kt, 'utf8');
if (!ktSrc.includes('coerceIn(0.1f, 4.0f)')) fail('Android rate still capped at 2× — run npm install (postinstall applies patch-package)');
if (!ktSrc.includes('playAtDesiredRate')) fail('Android playAtDesiredRate missing — patch incomplete');
if (!ktSrc.includes('setEnableAudioOutputPlaybackParameters(true)')) {
  fail('Android ExoPlayer missing audio output playback params — patch incomplete');
}
if (ktSrc.includes('mainQueue.launch') && ktSrc.includes('setPlaybackRate(rate)')) {
  fail('setPlaybackRate still async — rate can lose to play(); patch incomplete');
}

if (!fs.existsSync(swift)) fail('expo-audio iOS sources missing');
const swiftSrc = fs.readFileSync(swift, 'utf8');
if (!swiftSrc.includes('min(rate, 4.0)')) fail('iOS rate still capped at 2×');

console.log('OK: expo-audio patched for up to 4× playback (native rebuild still required after patch changes)');
