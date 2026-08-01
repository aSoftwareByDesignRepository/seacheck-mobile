# SeaCheck — signed production / store build

Package: `de.softwarebydesign.seacheck`. Metro port **8092**.

Full multi-ABI release APK and Play AAB. Prefer this for store uploads, F-Droid prep, and sideloads that must run on emulators / older ABIs.

Default phone sideload (**arm64**, fast): [`build-it.md`](./build-it.md). Optional serialized Gradle when Cursor must stay up: [`dev-build-instructions.md`](./dev-build-instructions.md). Canonical long runbook: [`build-it.md`](./build-it.md). F-Droid: [`fdroid/BUILD-FDROID.md`](./fdroid/BUILD-FDROID.md).

Node must match `package.json` engines (`^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`). Prefer Node 22.22.0. `android:rebuild` installs a **dev** client, not a release APK.

## Release APK (all default architectures — slow)

This is the **slow** path (4 ABIs). Phone sideloads should use [`build-it.md`](./build-it.md) instead.

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
node -v
npm pkg get name   # must be "seacheck-mobile"

# One command (recommended)
npm run release:apk

# Or step-by-step — same as scripts/release-apk.sh
npm install
npx expo install --check
npm run preflight
npm run icons
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh
npm run android:clean
npm run android:release

VERSION=$(grep -E "^\s*version:" app.config.ts | head -1 | sed "s/.*'\([^']*\)'.*/\1/")
mkdir -p ~/Downloads/apk-releases
cp android/app/build/outputs/apk/release/app-release.apk \
  ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
ls -lh ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
```

## Play Store AAB

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npm run preflight
npm run icons
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh
npm run android:bundle
# → android/app/build/outputs/bundle/release/app-release.aab
```

Signing / upload: [`play-store/README.md`](./play-store/README.md) and `mobile/seacheck-private/`.
