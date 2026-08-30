/**
 * AGP / R8 upgrade policy for Expo SDK 56 / React Native 0.85 fleet apps.
 *
 * Play Console may recommend "Upgrade AGP to 9.0+" for R8 memory/perf.
 * React Native 0.85 pins AGP 8.12.0 in `gradle/libs.versions.toml`. Forcing
 * AGP 9 outside that pin breaks Expo/RN Gradle plugins and is unsafe until Expo
 * ships AGP 9 in a supported SDK release.
 *
 * Foolproof mitigation until then:
 * - Keep the RN-pinned AGP (do not force 9.x)
 * - Enable the full AGP 8.12 R8 stack Play cares about (minify, shrink,
 *   optimized resource shrinking, proguard-android-optimize.txt)
 */

/** Expo SDK 56 / RN 0.85 catalog pin (see react-native/gradle/libs.versions.toml). */
const EXPO_SDK56_PINNED_AGP = '8.12.0';

/** Play Console advisory floor — not forced while Expo pins 8.12. */
const PLAY_RECOMMENDED_MIN_AGP_MAJOR = 9;

const AGP_R8_POLICY = Object.freeze({
  /** Never override RN's AGP catalog to 9.x on Expo SDK 56. */
  forceAgp9OutsideExpoPin: false,
  /** Release minify (R8). */
  enableMinifyInReleaseBuilds: true,
  /** Remove unused resources. */
  enableShrinkResourcesInReleaseBuilds: true,
  /**
   * AGP 8.12 opt-in; AGP 9 enables automatically with shrinkResources.
   * Required to silence Play's "optimized resource shrinking" finding on 8.12.
   */
  optimizedResourceShrinking: true,
  /** Use the optimizing ProGuard defaults (not the non-optimize template). */
  useProguardAndroidOptimize: true,
});

/** Parse `agp = "x.y.z"` from a Gradle version catalog TOML. */
function parseAgpVersionFromLibsToml(toml) {
  const match = String(toml).match(/^\s*agp\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? null;
}

/** Major component of a semver-ish AGP string (e.g. "8.12.0" → 8). */
function agpMajorVersion(version) {
  if (version == null || typeof version !== 'string') return null;
  const major = Number.parseInt(version.trim().split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : null;
}

/**
 * True when the pinned catalog AGP is still on the Expo SDK 56 line (8.x)
 * and we must not force Play's AGP 9 advisory.
 */
function mustStayOnExpoPinnedAgp(pinnedAgp) {
  if (pinnedAgp == null) return true;
  const major = agpMajorVersion(pinnedAgp);
  return major === 8;
}

function assertAgpR8Policy(policy = AGP_R8_POLICY) {
  const failures = [];
  if (policy.forceAgp9OutsideExpoPin) failures.push('forceAgp9OutsideExpoPin');
  if (!policy.enableMinifyInReleaseBuilds) failures.push('enableMinifyInReleaseBuilds');
  if (!policy.enableShrinkResourcesInReleaseBuilds) {
    failures.push('enableShrinkResourcesInReleaseBuilds');
  }
  if (!policy.optimizedResourceShrinking) failures.push('optimizedResourceShrinking');
  if (!policy.useProguardAndroidOptimize) failures.push('useProguardAndroidOptimize');
  return failures;
}

function assertR8GradleProperties(text) {
  const source = String(text);
  const failures = [];
  if (!/android\.enableMinifyInReleaseBuilds\s*=\s*true/.test(source)) {
    failures.push('android.enableMinifyInReleaseBuilds');
  }
  if (!/android\.enableShrinkResourcesInReleaseBuilds\s*=\s*true/.test(source)) {
    failures.push('android.enableShrinkResourcesInReleaseBuilds');
  }
  if (!/android\.r8\.optimizedResourceShrinking\s*=\s*true/.test(source)) {
    failures.push('android.r8.optimizedResourceShrinking');
  }
  return failures;
}

function assertProguardOptimizeInAppGradle(text) {
  const source = String(text);
  const failures = [];
  if (!/proguard-android-optimize\.txt/.test(source)) {
    failures.push('proguard-android-optimize.txt');
  }
  if (/getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/.test(source)) {
    failures.push('non-optimize-proguard-android.txt');
  }
  return failures;
}

/**
 * Combined gate: policy + pinned TOML + gradle sources.
 * @param {{ policy?: typeof AGP_R8_POLICY, libsToml: string, gradleProperties: string, appBuildGradle: string }} input
 */
function assertAgpR8UpgradeGate(input) {
  const policy = input.policy ?? AGP_R8_POLICY;
  const failures = [
    ...assertAgpR8Policy(policy),
    ...assertR8GradleProperties(input.gradleProperties),
    ...assertProguardOptimizeInAppGradle(input.appBuildGradle),
  ];

  const pinned = parseAgpVersionFromLibsToml(input.libsToml);
  if (pinned == null) {
    failures.push('missing-agp-in-libs-toml');
  } else if (mustStayOnExpoPinnedAgp(pinned) && policy.forceAgp9OutsideExpoPin) {
    failures.push('forced-agp9-while-expo-pins-8');
  } else if (mustStayOnExpoPinnedAgp(pinned) && !/^8\.12\.\d+$/.test(pinned)) {
    failures.push('agp-not-expo-8-12-pin');
  }

  return failures;
}

module.exports = {
  EXPO_SDK56_PINNED_AGP,
  PLAY_RECOMMENDED_MIN_AGP_MAJOR,
  AGP_R8_POLICY,
  parseAgpVersionFromLibsToml,
  agpMajorVersion,
  mustStayOnExpoPinnedAgp,
  assertAgpR8Policy,
  assertR8GradleProperties,
  assertProguardOptimizeInAppGradle,
  assertAgpR8UpgradeGate,
};
