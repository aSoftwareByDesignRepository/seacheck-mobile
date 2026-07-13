# Build SeaCheck

Metro uses **port 8092** so it does not collide with other local services.

---

## Production release APK (sideload / device testing)

Copy-paste whenever you need a release APK. Do **not** skip steps.

```bash
cd mobile/seacheck

# 1. Dependencies pinned to Expo SDK 56
npm install

# 2. Quality gate (typecheck, Jest, WCAG contrast/touch, i18n parity)
npm run preflight

# 3. Launcher icons from SVG sources
npm run icons

# 4. Regenerate android/ — production variant excludes expo-dev-client
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --clean

# 5. Node path + Gradle patches (required after every prebuild --clean)
bash scripts/ensure-android-local-properties.sh

# 6. Clean native build → release APK
npm run android:clean
npm run android:release

# 7. Copy to a stable sideload path
VERSION=$(grep -E "^\s*version:" app.config.ts | head -1 | sed "s/.*'\([^']*\)'.*/\1/")
mkdir -p ~/Downloads/apk-releases
cp android/app/build/outputs/apk/release/app-release.apk \
  ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
ls -lh ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
```

### Install on the phone

1. **Uninstall** any existing SeaCheck build first (dev client and release share the same package id).
2. Copy the APK to the device and install.
3. Complete onboarding and run the smoke path in [`test-it.md`](test-it.md).

### What each step guarantees

| Step | Why it matters |
|------|----------------|
| `npm run preflight` | JS/chart/alarm logic verified; `expo install --check` pins native modules |
| `npm run icons` | Correct SeaCheck launcher assets |
| `SEACHECK_APP_VARIANT=production` + `prebuild --clean` | Release APK without dev client; MapLibre/native plugins regenerated |
| `ensure-android-local-properties.sh` | Writes `android/local.properties` (`sdk.dir`, `node.dir`) and patches Gradle node invocations |
| `android:clean` + `android:release` | No stale Gradle/CMake artifacts |

### If the build fails

| Symptom | Fix |
|---------|-----|
| `Android SDK not found` | `export ANDROID_HOME=$HOME/Android/Sdk` and re-run from step 4 |
| `preflight` / `expo install --check` fails | Accept reported version fixes, then `npm install` and start again |
| Gradle sync: `command 'node'` | Run `bash scripts/ensure-android-local-properties.sh` after every `prebuild --clean` |
| Gradle sync: `IBM_SEMERU` / `JvmVendorSpec` | Run `bash scripts/patch-gradle-foojay.sh` (also runs via `ensure-android-local-properties.sh`) |
| APK install rejected | Uninstall old SeaCheck, then install again |
| Map/location broken after pull | Native or plugin change — run the **full** production block again |

`android/local.properties` is local-only and not in git. Re-run `ensure-android-local-properties.sh` after every `prebuild --clean`.

**Note:** `npm run android` / `npm run android:rebuild` install a **dev** client, not a release APK.

---

## Play Store AAB

Store signing and upload steps: [`play-store/README.md`](play-store/README.md) and [`play-store/RELEASE-CHECKLIST.md`](play-store/RELEASE-CHECKLIST.md).

After the production prebuild block above:

```bash
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Dev client (emulator or USB + Metro)

For day-to-day JS/UI work. **Not** for sideloading to crew.

```bash
cd mobile/seacheck
npm install
npx expo prebuild --platform android    # first time, or after native/plugin changes
bash scripts/ensure-android-local-properties.sh
npm start                               # terminal 1 — Metro on 8092
npm run android                         # terminal 2 — dev client install
```

One-shot dev (starts emulator + Metro if needed):

```bash
npm run dev
```

**After native or plugin changes**, rebuild the dev client — Metro reload alone is not enough.

---

## Preflight (CI-quality gate)

```bash
npm run preflight
```

Runs `expo install --check`, typecheck, Jest, WCAG contrast, touch-target audit, EN/DE i18n parity, and required docs checks.

Play Store–specific gate:

```bash
npm run play:preflight
```

---

## Region data sync (optional)

Refresh bundled corridor GeoJSON fixtures and, in the monorepo, `planning/app-ideas/seacheck/regions/`:

```bash
npm run sync:regions
```

Fixtures live in `fixtures/region-geojson/` and are required for CI on the standalone GitHub repo.

Re-run the production block if you ship a release with updated regions.

---

## F-Droid

Build recipe and submission notes: [`fdroid/BUILD-FDROID.md`](fdroid/BUILD-FDROID.md).

---

## Physical / emulator testing

See [`test-it.md`](test-it.md). SeaCheck needs **location** permission for chart, anchor watch, and tracks; a physical device is recommended for GPS validation.
