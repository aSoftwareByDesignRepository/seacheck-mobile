# F-Droid build notes (SeaCheck)

SeaCheck is an **Expo SDK 56 / React Native** app. F-Droid builds from source on their servers — no Android Studio required upstream.

## Upstream release build (verify locally)

```bash
cd mobile/seacheck
npm ci --omit=dev
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh
cd android && SEACHECK_APP_VARIANT=production NODE_ENV=production ./gradlew assembleRelease
```

APK output (local release build, signed if keystore present):

```text
android/app/build/outputs/apk/release/app-release.apk
```

F-Droid metadata uses the unsigned artifact name. React Native 0.85+ no longer emits per-ABI split APK filenames; each fdroiddata build sets `reactNativeArchitectures` and Gradle writes:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Multi-arch builds use `VercodeOperation` (`versionCode` 1 / 2 / 3). Metadata patches `app.config.ts` with `versionCode: $$VERCODE$$` before `expo prebuild` so each APK matches its build block.

`postinstall` runs Gradle/Expo patches automatically (`scripts/patch-*.sh`).

## Store metadata (Triple-T)

F-Droid pulls listing text and graphics from:

```text
fastlane/metadata/android/en-US/
fastlane/metadata/android/de-DE/
```

Replace draft phone screenshots in `images/phoneScreenshots/` with real device captures before the final fdroiddata merge request (see `docs/play-store/GRAPHICS.md`).

## Versioning

| Field | Where |
|-------|--------|
| `version` | `app.config.ts`, `package.json` |
| `versionCode` | `app.config.ts` → `android.versionCode` |
| Git tag | `v0.1.0` (must match `version`) |
| Changelog | `fastlane/metadata/android/*/changelogs/<versionCode>.txt` |

Release checklist:

1. Bump `version` and `android.versionCode`
2. Add changelog files for each locale
3. Commit, tag `vX.Y.Z`, push branch + tag
4. Update `docs/fdroid/de.softwarebydesign.seacheck.yml` commit + build blocks
5. Open/update merge request on [fdroiddata](https://gitlab.com/fdroid/fdroiddata)

## Submit to F-Droid

1. Read [Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)
2. Open [Request for Packaging](https://gitlab.com/fdroid/fdroid/rfp/-/issues/new) (optional first step)
3. Fork [fdroiddata](https://gitlab.com/fdroid/fdroiddata), copy `docs/fdroid/de.softwarebydesign.seacheck.yml` → `metadata/de.softwarebydesign.seacheck.yml`
4. Set `commit:` to the release tag SHA

When editing fdroiddata metadata (e.g. AntiFeatures text), **copy the full file from `docs/fdroid/de.softwarebydesign.seacheck.yml` and re-apply fdroiddata-only tweaks** (e.g. drop surplus `WebSite` / `Translation` if reviewers asked). Do not paste an older metadata template — that can silently reintroduce `firebase-stub` and fail `check apk`.
5. Run CI on your fork (`fdroid lint`, build pipeline)
6. Open merge request

Draft metadata: [`docs/fdroid/de.softwarebydesign.seacheck.yml`](fdroid/de.softwarebydesign.seacheck.yml)

## AntiFeatures (expected)

| AntiFeature | Reason |
|-------------|--------|
| `NonFreeNet` | Optional online map tiles (OSM / CARTO) while downloading packs |
| `BackgroundLocation` | Anchor watch and track recording |

## Signing

F-Droid signs the APK with the **F-Droid key**. Play Store builds use a separate upload key in `mobile/seacheck-private/` (parent repo only). Users cannot switch between Play and F-Droid installs without reinstalling.

## Reproducible builds

Not targeted for the first submission. Expo/React Native reproducibility is difficult; revisit after the app is accepted.

## Troubleshooting

### `Cannot find module '../shared/metro-shared-packages'`

F-Droid clones **only** `seacheck-mobile`, not the parent `mobile/` monorepo. `metro.config.js` must use the standard Expo config (`expo/metro-config`) and must **not** `require('../shared/...')`. SeaCheck does not depend on `mobile/shared/*` packages.

CI runs `npm run fdroid:preflight` (with `npm ci --omit=dev`) to catch this before fdroiddata builds.

### `No apks match .../app-armeabi-v7a-release-unsigned.apk`

React Native 0.85 / Expo SDK 56 removed `enableSeparateBuildPerCPUArchitecture` from `android/app/build.gradle`. Gradle succeeds but F-Droid cannot find per-ABI APK names. Use `output: android/app/build/outputs/apk/release/app-release-unsigned.apk` and filter native libs via `reactNativeArchitectures=` in `gradle.properties` (one F-Droid build block per architecture).

### `check apk` fails with `Found com/google/android/gms/...` or `com/google/firebase/...`

F-Droid scans built APKs for proprietary Google classes. `expo-location` depends on Play Services location APIs and `expo-notifications` normally pulls in Firebase Messaging. SeaCheck uses **local notifications only** and GPS via the Android `LocationManager`.

Metadata runs `bash scripts/patch-fdroid-nonfree.sh` after `npm ci` to apply Firebase-free notification stubs and LocationManager-based `expo-location` sources. Do **not** use the `firebase-stub` srclib — those stubs still embed `com.google.firebase` classes and fail `check apk`. Do **not** list `node_modules/expo-location/android/build.gradle` in `scanignore`; after the patch removes `play-services-location`, F-Droid treats that entry as unused and fails the build.


Do **not** use `scandelete: node_modules`. F-Droid runs `scandelete` after `prebuild` and before `build`, but Expo/React Native Gradle plugins still invoke Node during configuration (`expo-constants`, `react-native-screens`, autolinking). With `node_modules` gone, those scripts exit 1.

### Scanner fails with many errors while scanning

Run `scripts/fdroid-strip-node-prebuilts.sh` in `prebuild` (after `expo prebuild`). It removes iOS/macOS/Windows prebuilts, Expo `local-maven-repo` AARs, and other artifacts that are rebuilt via `buildFromSource` during Gradle. Use `scanignore` only for false-positive Maven-repo warnings in `build.gradle` files.

### `:expo-constants:createExpoConfig` fails with `expo-dev-client` / `NODE_ENV`

F-Droid uses `npm ci --omit=dev`, so `expo-dev-client` is not installed. Gradle re-evaluates `app.config.ts` during `assembleRelease` without the env vars used at prebuild time unless they are persisted.

Fix (already in metadata):

1. `export SEACHECK_APP_VARIANT=production NODE_ENV=production` before `ensure-android-local-properties.sh`
2. `build:` line prefixes the same env vars for Gradle
3. App repo: `app.config.ts` treats missing `expo-dev-client` as production; `scripts/write-android-build-env.sh` writes `.env`; `scripts/patch-expo-constants-env.sh` passes env into the Gradle Exec task

### `Inconsistent JVM Target Compatibility` (Java 21 vs Kotlin 17)

React Native 0.85 sets Java compile to 21, but some community modules (e.g. `@react-native-community/datetimepicker`) still declare Kotlin `jvmTarget` 17. Gradle 9 fails the build when those disagree.

Fix: copy `scripts/fdroid-init.gradle` to `android/init.gradle` in prebuild and pass `--init-script init.gradle` to Gradle. That init script forces `JvmTarget.JVM_21` on all `KotlinCompile` tasks and keeps `-Xskip-metadata-version-check` for Kotlin 2.x metadata mismatches.
