# SeaCheck — low-RAM / Cursor-parallel sideload APK

Package: `de.softwarebydesign.seacheck`. Metro port **8092**.

Use this when Cursor (or other IDE work) must stay open during the native build. Builds **arm64-v8a only**, serializes Gradle workers, and optionally stops local Nextcloud Docker during Gradle (SeaCheck itself does not need it).

**Not** for Play Store / F-Droid / multi-ABI distribution — use [`signed-prod-build-instructions.md`](./signed-prod-build-instructions.md).

Signing uses the same release keystore path as the full recipe (unchanged). ABI / worker flags do not affect signing.

Node must match `package.json` engines (`^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`). Prefer Node 22.22.0. `android:rebuild` installs a **dev** client, not a release APK.

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
node -v   # must satisfy package.json engines
npm pkg get name   # must be "seacheck-mobile"

# 1. Dependencies
npm install
npx expo install --check

# 2. Quality gate (no Gradle)
npm run preflight
npm run icons

# 3. Production prebuild
SEACHECK_APP_VARIANT=production NODE_ENV=production npx expo prebuild --platform android --clean
SEACHECK_APP_VARIANT=production NODE_ENV=production bash scripts/ensure-android-local-properties.sh
npm run android:clean

# 4. Low-RAM assembleRelease (android:release does not forward Gradle flags)
cd android
SEACHECK_APP_VARIANT=production NODE_ENV=production ./gradlew assembleRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  --max-workers=1 -Dorg.gradle.parallel=false \
  -Pkotlin.daemon.jvmargs=-Xmx1024m
cd ..

# 5. Stable sideload path
VERSION=$(grep -E "^\s*version:" app.config.ts | head -1 | sed "s/.*'\([^']*\)'.*/\1/")
mkdir -p ~/Downloads/apk-releases
cp android/app/build/outputs/apk/release/app-release.apk \
  ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
ls -lh ~/Downloads/apk-releases/seacheck-${VERSION}-release.apk
```

### Dev client (no release APK)

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npx expo prebuild --platform android
bash scripts/ensure-android-local-properties.sh
npm start                 # terminal 1 — Metro :8092
npm run android           # terminal 2 — USB / emulator
```

After native plugin changes: `npm run android:rebuild` (dev client only).
