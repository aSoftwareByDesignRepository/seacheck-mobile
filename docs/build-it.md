# Build SeaCheck

Metro uses **port 8092** so it does not collide with other local services.

**Node:** `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25` (see `package.json` `engines`). Node 22.12.x emits `EBADENGINE` warnings and is unsupported.

```bash
nvm install 22.22.0
nvm alias default 22.22.0
nvm use 22.22.0
```

`npm run release:apk` refuses the wrong app directory and refuses unsupported Node.

---

## Production release APK (sideload / device testing)

One command (recommended) — use this absolute path (do **not** paste while already inside `arbeitszeitcheck-kiosk`):

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
node -v   # must be v22.13+ (prefer v22.22.0)
npm run release:apk
```

Confirm you are in SeaCheck before continuing: `npm pkg get name` must print `"seacheck-mobile"`. If it prints `"arbeitszeitcheck-kiosk"`, you are in the wrong directory.

Or step-by-step (same as `scripts/release-apk.sh`). Do **not** skip steps.

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm pkg get name   # must be "seacheck-mobile"

# 1. Dependencies pinned to Expo SDK 56
npm install

# 2. Quality gate (typecheck, Jest, WCAG contrast/touch, i18n parity, F-Droid checks)
npm run preflight

# 3. Launcher icons from SVG sources
npm run icons

# 4. Regenerate android/ — production variant excludes expo-dev-client
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean

# 5. Node path + Gradle patches (required after every prebuild --clean)
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh

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
| `npm run preflight` | JS/chart/alarm logic verified; `expo install --check` pins native modules; F-Droid metadata sanity |
| `npm run icons` | Correct SeaCheck launcher assets |
| `SEACHECK_APP_VARIANT=production` + `prebuild --clean` | Release APK without dev client; MapLibre/native plugins regenerated |
| `ensure-android-local-properties.sh` | Writes `android/local.properties` (`sdk.dir`, `node.dir`), patches Gradle node invocations, persists production env in `gradle.properties` (not project `.env`) |
| `android:clean` + `android:release` | No stale Gradle/CMake artifacts |

### If the build fails

| Symptom | Fix |
|---------|-----|
| `Android SDK not found` | `export ANDROID_HOME=$HOME/Android/Sdk` and re-run from step 4 |
| `EBADENGINE` / unsupported Node | Upgrade Node to ≥22.13 or use 24.x (nvm install 22.14.0) |
| `preflight` / `expo install --check` fails | Accept reported version fixes, then `npm install` and start again |
| `expo-dev-client … doesn't seem to be installed` | You ran `npm ci --omit=dev` locally — restore with `npm ci`. Also delete a leftover `.env` that sets `SEACHECK_APP_VARIANT=production` |
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
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
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

Runs `expo install --check`, typecheck, Jest, WCAG contrast, touch-target audit, EN/DE i18n parity, F-Droid standalone checks, and required docs checks.

Play Store–specific gate:

```bash
npm run play:preflight
```

F-Droid-shaped install (no devDependencies), as used on GitLab/GitHub and fdroiddata:

```bash
npm ci --omit=dev
npm run fdroid:preflight
```

Restore a full local tree afterwards with `npm ci`.

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

GitLab mirrors GitHub preflight + `fdroid:preflight` (`.gitlab-ci.yml`). Packaging builds run in [fdroiddata](https://gitlab.com/fdroid/fdroiddata).

---

## Physical / emulator testing

See [`test-it.md`](test-it.md). SeaCheck needs **location** permission for chart, anchor watch, and tracks; a physical device is recommended for GPS validation.
