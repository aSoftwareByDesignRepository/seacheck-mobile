
## Production release APK (use this every time)

Copy-paste whenever you need a sideload APK. Do **not** skip steps.

``co`bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck

# 1. Dependencies pinned to Expo SDK 56 (preflight also runs expo install --check)
npm install

# 2. Fail fast before Gradle (typecheck, Jest, a11y, i18n)
npm run preflight

# 3. Launcher icons from SVG sources
npm run icons

# 4. Regenerate android/ from scratch — production variant excludes expo-dev-client
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --clean

# 5. Clean native build → release APK
bash scripts/ensure-android-local-properties.sh
npm run android:clean
npm run android:release

# 6. Copy to a stable sideload path
VERSION=$(grep -E "^\s*version:" app.config.ts | head -1 | sed "s/.*'\([^']*\)'.*/\1/")
mkdir -p ~/Downloads/apk-releases
cp android/app/build/outputs/apk/release/app-release.apk \
  ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
ls -lh ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
```

### Install on the phone

1. **Uninstall** any existing SeaCheck build first (dev client and release share the same package id).
2. Copy `~/Downloads/apk-releases/seacheck-<version>-release.apk` to the device and install.
3. Open the app and complete onboarding (disclaimer → location → battery). See [`test-it.md`](test-it.md) for a full smoke test on emulator or device.

### What each step guarantees

| Step | Why it matters |
|------|----------------|
| `npm run preflight` | JS/chart logic verified; `expo install --check` pins native modules |
| `npm run icons` | Correct SeaCheck launcher (not a stale AudioCheck icon) |
| `SEACHECK_APP_VARIANT=production` + `prebuild --clean` | Release APK without dev client; MapLibre/native plugins regenerated |
| `android:clean` + `android:release` | No stale Gradle/CMake artifacts from an old tree |

### If the build fails

| Symptom | Fix |
|---------|-----|
| `Android SDK not found` | `export ANDROID_HOME=$HOME/Android/Sdk` and re-run from step 4 |
| `preflight` / `expo install --check` fails | Accept reported version fixes, then `npm install` and start again |
| Wrong launcher icon (headphones) | Re-run `npm run icons` then the full production block |
| APK install rejected | Uninstall old SeaCheck, then install again |
| Map/location broken after pull | Native or plugin change — run the **full** production block again |

`ensure-android-local-properties.sh` writes `android/local.properties` (SDK path). Re-run it after every `prebuild --clean` — that file is local-only and not in git.

**Note:** `npm run android:rebuild` installs a **dev** client (`expo run:android`), not a release APK. Use the production block above for sideloading.

---

## Dev client (emulator or USB + Metro hot reload)

For day-to-day JS/UI work. **Not** for sideloading to crew.

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npx expo prebuild --platform android    # first time, or after native/plugin changes
npm start                               # terminal 1 — Metro on 8092
npm run android                         # terminal 2 — dev client install
```

One-shot dev (starts emulator + Metro if needed):

```bash
npm run dev
```

Clean native rebuild for dev:

```bash
npm run android:rebuild
```

**After native or plugin changes**, rebuild the dev client — Metro reload alone is not enough.

---

## Preflight (CI-quality gate)

```bash
npm run preflight
```

Runs `expo install --check`, typecheck, Jest, WCAG contrast, touch-target audit, EN/DE i18n parity.

---

## Region data sync (optional)

Refresh bundled planning regions from `planning/`:

```bash
npm run sync:regions
```

Re-run the production block if you ship a release with updated regions.

---

## Physical / emulator testing

See [`test-it.md`](test-it.md). SeaCheck needs **location** permission for chart and anchor features; emulator works for UI, physical device recommended for GPS.
