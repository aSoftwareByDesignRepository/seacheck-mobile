# F-Droid build notes (SeaCheck)

SeaCheck is an **Expo SDK 56 / React Native** app. F-Droid builds from source on their servers — no Android Studio required upstream.

## Upstream release build (verify locally)

```bash
cd mobile/seacheck
npm ci
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

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
