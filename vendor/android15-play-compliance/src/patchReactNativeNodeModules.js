/**
 * Apply React Native Android 15 edge-to-edge source patches under an app's node_modules.
 */
const fs = require('fs');
const path = require('path');
const {
  patchWindowUtilKt,
  patchStatusBarModuleKt,
  isReactNativeEdgeToEdgeClean,
} = require('./reactNativeEdgeToEdgePatch');

function rnAndroidPaths(appRoot) {
  const rnRoot = path.join(appRoot, 'node_modules', 'react-native');
  return {
    rnRoot,
    windowUtil: path.join(
      rnRoot,
      'ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt',
    ),
    statusBarModule: path.join(
      rnRoot,
      'ReactAndroid/src/main/java/com/facebook/react/modules/statusbar/StatusBarModule.kt',
    ),
  };
}

/**
 * @param {string} appRoot
 * @returns {{ skipped?: boolean, reason?: string, changes: string[], clean: boolean }}
 */
function patchReactNativeNodeModules(appRoot) {
  const paths = rnAndroidPaths(appRoot);
  if (!fs.existsSync(paths.rnRoot)) {
    return { skipped: true, reason: 'no-react-native', changes: [], clean: false };
  }
  if (!fs.existsSync(paths.windowUtil) || !fs.existsSync(paths.statusBarModule)) {
    return { skipped: true, reason: 'rn-sources-missing', changes: [], clean: false };
  }

  const changes = [];
  const windowBefore = fs.readFileSync(paths.windowUtil, 'utf8');
  const statusBefore = fs.readFileSync(paths.statusBarModule, 'utf8');

  const windowPatched = patchWindowUtilKt(windowBefore);
  if (windowPatched.changed) {
    fs.writeFileSync(paths.windowUtil, windowPatched.text);
    changes.push('WindowUtil.kt');
  }

  const statusPatched = patchStatusBarModuleKt(statusBefore);
  if (statusPatched.changed) {
    fs.writeFileSync(paths.statusBarModule, statusPatched.text);
    changes.push('StatusBarModule.kt');
  }

  const clean = isReactNativeEdgeToEdgeClean({
    windowUtil: fs.readFileSync(paths.windowUtil, 'utf8'),
    statusBarModule: fs.readFileSync(paths.statusBarModule, 'utf8'),
  });

  return { skipped: false, changes, clean };
}

/**
 * Verify without writing.
 * @param {string} appRoot
 */
function verifyReactNativeNodeModules(appRoot) {
  const paths = rnAndroidPaths(appRoot);
  if (!fs.existsSync(paths.windowUtil) || !fs.existsSync(paths.statusBarModule)) {
    return { present: false, clean: false };
  }
  return {
    present: true,
    clean: isReactNativeEdgeToEdgeClean({
      windowUtil: fs.readFileSync(paths.windowUtil, 'utf8'),
      statusBarModule: fs.readFileSync(paths.statusBarModule, 'utf8'),
    }),
  };
}

module.exports = {
  rnAndroidPaths,
  patchReactNativeNodeModules,
  verifyReactNativeNodeModules,
};
