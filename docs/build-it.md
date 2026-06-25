# SeaCheck Mobile — build it

## Development build (Metro + dev client)

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npm run android
```

## Release APK (no dev menu)

Regenerate native project without `expo-dev-client`, then build:

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
npx expo install --check   # must pass — pins native modules (async-storage 2.2.0, expo-* ~56.x, safe-area-context ~5.7.0)
SEACHECK_APP_VARIANT=production npx expo prebuild --platform android --no-install
bash scripts/ensure-android-local-properties.sh
cd android && ./gradlew assembleRelease
```

`ensure-android-local-properties.sh` writes `android/local.properties` (SDK path). Re-run it after every `expo prebuild --clean` — that file is local-only and not in git.

APK:

```
/home/alex/Development/nextcloud-dev/mobile/seacheck/android/app/build/outputs/apk/release
```

Copy that file to your phone and open it to install.

If the launcher icon still shows AudioCheck (headphones), regenerate SeaCheck icons and rebuild:

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm run icons
npm run android:rebuild
```
