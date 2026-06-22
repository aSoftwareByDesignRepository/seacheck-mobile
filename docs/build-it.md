# SeaCheck Mobile — build it

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm install
cd android && ./gradlew assembleRelease
```

APK:

```
mobile/seacheck/android/app/build/outputs/apk/release/app-release.apk
```

Copy that file to your phone and open it to install.

For development builds, prefer `npm run android` from the project root (Metro port **8092**).
