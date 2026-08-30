/**
 * Pure app/build.gradle helpers for R8 *optimization* (not just minify/obfuscate).
 *
 * Expo / RN templates ship:
 *   getDefaultProguardFile("proguard-android.txt")
 * which includes `-dontoptimize`. Play Console then reports "Optimization isn't enabled"
 * even when minifyEnabled=true. Switch to proguard-android-optimize.txt.
 */

function hasProguardOptimize(text) {
  return /getDefaultProguardFile\(\s*["']proguard-android-optimize\.txt["']\s*\)/.test(String(text));
}

function enableProguardOptimize(text) {
  const source = String(text);
  if (hasProguardOptimize(source)) return source;
  return source.replace(
    /getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/g,
    'getDefaultProguardFile("proguard-android-optimize.txt")',
  );
}

module.exports = {
  enableProguardOptimize,
  hasProguardOptimize,
};
