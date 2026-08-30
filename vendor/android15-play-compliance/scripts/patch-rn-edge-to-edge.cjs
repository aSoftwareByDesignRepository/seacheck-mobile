#!/usr/bin/env node
/**
 * Patch React Native Android sources so Play Console stops flagging deprecated
 * Window bar-color and cutout APIs (StatusBarModule + WindowUtilKt).
 *
 * Run from an app root (npm run patch:rn-edge). Idempotent.
 */
const {
  patchReactNativeNodeModules,
  verifyReactNativeNodeModules,
} = require('../src/patchReactNativeNodeModules');

const root = process.cwd();
const result = patchReactNativeNodeModules(root);

if (result.skipped) {
  console.log(`RN edge-to-edge patch skipped: ${result.reason}`);
  process.exit(0);
}

if (result.changes.length) {
  console.log(`RN edge-to-edge patched: ${result.changes.join(', ')}`);
} else {
  console.log('RN edge-to-edge already patched');
}

const verify = verifyReactNativeNodeModules(root);
if (verify.present && !verify.clean) {
  console.error('RN edge-to-edge sources still reference deprecated Window APIs');
  process.exit(1);
}
