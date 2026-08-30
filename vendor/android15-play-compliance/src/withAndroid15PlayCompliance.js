/**
 * Expo config plugin — requires expo/config-plugins at prebuild time only.
 */
const fs = require('fs');
const path = require('path');
const { resolveProps } = require('./policy');
const { loadExpoConfigPlugins } = require('./loadExpoConfigPlugins');
const {
  forceRemovePermission,
  stripBootActionsFromNotificationsReceiver,
  applyPlayComplianceToManifestObject,
} = require('./manifestObject');
const { enableR8GradleProperties } = require('./gradleProps');
const { enableProguardOptimize } = require('./appBuildGradle');
const { findStylesXmlPaths, stripStylesFile } = require('./stylesFiles');

const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
  withFinalizedMod,
} = loadExpoConfigPlugins();

const DEPRECATED_STYLE_ATTRS = Object.freeze([
  'android:statusBarColor',
  'android:navigationBarColor',
  'android:windowOptOutEdgeToEdgeEnforcement',
]);

function withPlayComplianceManifest(config, props) {
  return withAndroidManifest(config, (cfg) => {
    applyPlayComplianceToManifestObject(
      cfg.modResults,
      props,
      (manifest) => AndroidConfig.Manifest.getMainApplicationOrThrow(manifest),
    );
    return cfg;
  });
}

/**
 * Expo's built-in SystemBars plugin (withAndroidStyles) *adds* transparent
 * statusBarColor / navigationBarColor. Dangerous mods run *before* intentional
 * mods, so a dangerous strip is overwritten. We:
 * 1) remove the attrs in the styles AST (wins if we run after SystemBars), and
 * 2) re-strip the written styles.xml in a finalized mod (always last).
 */
function withEdgeToEdgeStyles(config) {
  config = withAndroidStyles(config, (cfg) => {
    const parent = AndroidConfig.Styles.getAppThemeGroup();
    for (const name of DEPRECATED_STYLE_ATTRS) {
      cfg.modResults = AndroidConfig.Styles.removeStylesItem({
        name,
        xml: cfg.modResults,
        parent,
      });
    }
    return cfg;
  });

  return withFinalizedMod(config, [
    'android',
    async (cfg) => {
      const resRoot = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      for (const stylesPath of findStylesXmlPaths(resRoot)) {
        stripStylesFile(stylesPath);
      }
      return cfg;
    },
  ]);
}

function withR8GradleProperties(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const propsPath = path.join(cfg.modRequest.platformProjectRoot, 'gradle.properties');
      if (!fs.existsSync(propsPath)) return cfg;
      let text = fs.readFileSync(propsPath, 'utf8');
      const next = enableR8GradleProperties(text);
      if (next !== text) fs.writeFileSync(propsPath, next);
      return cfg;
    },
  ]);
}

function withProguardOptimize(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const buildGradlePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/build.gradle',
      );
      if (!fs.existsSync(buildGradlePath)) return cfg;
      let text = fs.readFileSync(buildGradlePath, 'utf8');
      const next = enableProguardOptimize(text);
      if (next !== text) fs.writeFileSync(buildGradlePath, next);
      return cfg;
    },
  ]);
}

function withAndroid15PlayCompliance(config, props = {}) {
  const resolved = resolveProps(props);
  config = withPlayComplianceManifest(config, resolved);
  if (resolved.fixEdgeToEdgeStyles !== false) {
    config = withEdgeToEdgeStyles(config);
  }
  if (resolved.enableR8 !== false) {
    config = withR8GradleProperties(config);
    config = withProguardOptimize(config);
  }
  return config;
}

module.exports = withAndroid15PlayCompliance;
module.exports.withAndroid15PlayCompliance = withAndroid15PlayCompliance;
module.exports.POLICY = require('./policy').POLICY;
module.exports.resolveProps = resolveProps;
module.exports.forceRemovePermission = forceRemovePermission;
module.exports.stripBootActionsFromNotificationsReceiver = stripBootActionsFromNotificationsReceiver;
module.exports.loadExpoConfigPlugins = loadExpoConfigPlugins;
module.exports.DEPRECATED_STYLE_ATTRS = DEPRECATED_STYLE_ATTRS;
