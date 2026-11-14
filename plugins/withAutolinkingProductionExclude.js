const { withSettingsGradle } = require('expo/config-plugins');

const MARKER = '// @seacheck-prod-autolinking-exclude';

const EXCLUDE_BLOCK = `
${MARKER} — dev tooling must never reach production APKs/AABs/F-Droid builds.
// expo-modules-autolinking only reads package.json expo.autolinking (static);
// the app.config.ts "autolinking" key is dead config at gradle time. The real
// lever is expoAutolinking.exclude on the settings extension, evaluated while
// useExpoModules() resolves — so gate it on the variant and every gradle
// invocation (assembleRelease/bundleRelease) on this tree honors it.
// Variant resolves from env first, then android/gradle.properties
// (write-android-build-env.sh persists it there for F-Droid builds).
// A release build without the flag hard-fails instead of silently shipping
// a dev-variant artifact.
def _scVariant = System.getenv('SEACHECK_APP_VARIANT')
if (!_scVariant) {
  _scVariant = providers.gradleProperty('SEACHECK_APP_VARIANT').getOrElse(null)
}
def _scProductionVariant = _scVariant == 'production'
def _scReleaseTaskRequested = gradle.startParameter.taskNames.any { taskName ->
  taskName.toLowerCase().endsWith('release')
}
if (_scProductionVariant) {
  expoAutolinking.exclude = [
    'expo-dev-client',
    'expo-dev-launcher',
    'expo-dev-menu',
    'expo-dev-menu-interface',
  ]
} else if (_scReleaseTaskRequested) {
  throw new GradleException(
    'Release builds require SEACHECK_APP_VARIANT=production ' +
    '(scripts/android-apk.sh, scripts/android-bundle.sh and the F-Droid metadata export it). ' +
    'Without it expo-dev-client/menu/launcher would be compiled into the release artifact.'
  )
}
`;

/**
 * Wires an env/property-conditional `expoAutolinking.exclude` into the
 * generated android/settings.gradle, immediately before `useExpoModules()`
 * resolves the module set. Survives `expo prebuild --clean` because the
 * injection happens at config-eval time; the generated file stays
 * variant-agnostic (dev builds leave SEACHECK_APP_VARIANT unset and keep
 * dev-client autolinked; F-Droid reads it from gradle.properties).
 */
function withAutolinkingProductionExclude(config) {
  return withSettingsGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const start = contents.indexOf(MARKER);
    if (start !== -1) {
      // Upgrade in place — drop the previously injected block (everything from
      // the marker to the closing brace + newline of its if/else-if chain).
      const end = contents.indexOf('}\n', start);
      if (end === -1) {
        throw new Error('withAutolinkingProductionExclude: malformed injected block in settings.gradle');
      }
      contents = contents.slice(0, contents.lastIndexOf('\n', start)) + contents.slice(end + 2);
    }
    const anchor = 'expoAutolinking.useExpoModules()';
    const idx = contents.indexOf(anchor);
    if (idx === -1) {
      throw new Error(
        'withAutolinkingProductionExclude: expoAutolinking.useExpoModules() not found in android/settings.gradle',
      );
    }
    cfg.modResults.contents =
      contents.slice(0, idx) + EXCLUDE_BLOCK + '\n' + contents.slice(idx);
    return cfg;
  });
}

module.exports = withAutolinkingProductionExclude;
