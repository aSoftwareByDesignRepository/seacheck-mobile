## Release APK (no dev menu)

Regenerate native project without `expo-dev-client`, then build:

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npx expo install --check   # must pass — pins native modules (async-storage 2.2.0, expo-* ~56.x, safe-area-context ~5.7.0)
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --no-install
bash scripts/ensure-android-local-properties.sh
cd android && ./gradlew assembleRelease
cd ..
mkdir -p ~/Downloads/apk-releases
mv /home/alex/Development/nextcloud-dev/mobile/seacheck/android/app/build/outputs/apk/release/app-release.apk \
  ~/Downloads/apk-releases/seacheck-0.1.0-release.apk
```

`ensure-android-local-properties.sh` writes `android/local.properties` (SDK path). Re-run it after every `expo prebuild --clean` — that file is local-only and not in git.

Sideload from `~/Downloads/apk-releases/seacheck-0.1.0-release.apk` (bump version in the `mv` line when `app.config.ts` changes).

If the launcher icon still shows AudioCheck (headphones), regenerate SeaCheck icons and rebuild:

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm run icons
npm run android:rebuild
```
