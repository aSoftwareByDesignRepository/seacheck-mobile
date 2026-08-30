/**
 * Pure gradle.properties upsert helpers.
 */

function upsertGradleProp(text, key, value) {
  const source = String(text);
  const re = new RegExp(`^${key.replace(/\./g, '\\.')}=.*$`, 'm');
  if (re.test(source)) return source.replace(re, `${key}=${value}`);
  return `${source.trimEnd()}\n${key}=${value}\n`;
}

/**
 * Enable R8 minify + resource shrinking + optimized resource shrinking.
 *
 * AGP 8.12+ supports `android.r8.optimizedResourceShrinking` as an opt-in;
 * AGP 9+ enables it automatically when shrinkResources is on. Expo SDK 56 /
 * RN 0.85 still pin AGP 8.12 — the property is required for Play's
 * "Optimized resource shrinking isn't enabled" finding.
 */
function enableR8GradleProperties(text) {
  let next = upsertGradleProp(text, 'android.enableMinifyInReleaseBuilds', 'true');
  next = upsertGradleProp(next, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
  next = upsertGradleProp(next, 'android.r8.optimizedResourceShrinking', 'true');
  return next;
}

function hasR8Enabled(text) {
  const source = String(text);
  return (
    /android\.enableMinifyInReleaseBuilds\s*=\s*true/.test(source) &&
    /android\.enableShrinkResourcesInReleaseBuilds\s*=\s*true/.test(source) &&
    /android\.r8\.optimizedResourceShrinking\s*=\s*true/.test(source)
  );
}

module.exports = {
  upsertGradleProp,
  enableR8GradleProperties,
  hasR8Enabled,
};
