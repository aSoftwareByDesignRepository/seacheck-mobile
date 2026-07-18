# SeaCheck Mobile — test it

Exact steps for your machine. Based on the project docs in `mobile/seacheck`.

**Important:** This app does **not** work in Expo Go. You need a native dev build on an Android emulator (or physical device).

SeaCheck is **standalone** — no Nextcloud server or sign-in.

---

## Manual path (if you want separate terminals)

### Terminal 1 — Android emulator

```bash
export ANDROID_HOME=/home/alex/Android/Sdk
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
/home/alex/Android/Sdk/emulator/emulator -avd Pixel_3_API_33
```

Wait for the home screen, then:

```bash
adb devices
```

Expected: `emulator-5554   device`

### Terminal 2 — Metro (leave running)

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm start
```

Metro runs on port **8092**.

### Terminal 3 — Build and install the app

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm run android
```

---

## First launch (onboarding)

1. App opens on the **Disclaimer** screen — read and accept (not a certified plotter).
2. **Step indicator** shows progress (Safety → Location → Battery → Ready).
3. Grant **location** when prompted (foreground first; background optional but needed for anchor watch).
4. On Android, follow the **battery optimization** guidance.
5. On the final step, allow **alarm notifications** (anchor drag / arrival when screen is off).
6. Tap **Open SeaCheck** — you land on **Map** with default **Cruise/passage** profile.

If the app shows **“SeaCheck could not start”**, tap **Retry**. If it persists: uninstall, then `npm run android:rebuild`.

---

## What to try once onboarded

| Tab | Try |
|-----|-----|
| **Map** | Pan/zoom Kiel area; long-press → waypoint; hold **MOB** 2 s; set **Anchor** alarm |
| **Passage** | Create passage, reorder waypoints, per-leg SOG, activate, export GPX |
| **Waypoints** | Save from map; edit name/type; copy coordinates (DDM, DD, DMS) |
| **Tracks** | Start recording → lock screen 30 s → stop → export GPX; **Show on map** |
| **Downloads** | **Kieler Bucht (test)** on Wi‑Fi → wait for **Ready for offline use** → airplane mode → map still works |
| **Settings** | Theme, units, vessel, alarms, background location, activity profile |

### Offline smoke (critical)

1. **Downloads** → **Kieler Bucht (test)** → wait for **Ready for offline use**
2. Enable airplane mode
3. **Map** → pan Kiel — base + seamarks visible from cache
4. Pan far outside the downloaded bounds — expect **No offline charts here** banner (not a silent blank map)

### Custom offline area

1. **Downloads** → **Select area on map**
2. Tap four corners of your rectangle, confirm zoom/size, download on Wi‑Fi
3. Pack appears under **Your custom packs**

### Anchor alarm (background)

1. **Settings** → allow **background location** + **alarm notifications**
2. **Map** → set **Anchor** alarm at current position
3. Lock screen or switch apps for 2+ minutes
4. Move beyond radius — expect vibration + notification

Also: **Layout** → cycle activity profiles; double-tap layout strip to cycle presets; **Screen lock** on map (hold overlay 1.5 s to unlock); download pack → airplane mode → instruments still update from GPS.

For JS-only changes (`.ts`/`.tsx`), press **`r`** in the Metro terminal — no rebuild needed.

After adding or upgrading native modules (`expo-location`, MapLibre, etc.), run **`npm run android:rebuild`**.

### Automated gates (optional)

```bash
cd /home/alex/Development/nextcloud-dev/mobile/seacheck
npm run preflight
```

Covers TypeScript, Jest, WCAG contrast, touch targets (≥48 px), EN/DE i18n parity.

---

## Physical Android device (instead of emulator)

1. USB debugging on; phone and PC on same Wi‑Fi (needed for first chart download).
2. Run `npm start`, then `npm run android` (sets `adb reverse tcp:8092 tcp:8092` automatically when a device is connected).
3. Complete onboarding on device.
4. **Downloads** → fetch **Kieler Bucht** on Wi‑Fi before going offline.

---

## Common fixes

| Problem | Fix |
|---------|-----|
| `adb devices` empty | `adb kill-server && adb start-server` |
| “Development build required” | Run `npm run android` — don’t use Expo Go |
| Port 8092 conflict | Stop all Metro processes; run only `npm start` then `npm run android` |
| `Unable to load script` / `index.android.bundle` | **Dev build:** Metro must be running (`npm start` on port **8092**, not 8081), then reopen the app or run `npm run android`. USB device: `adb reverse tcp:8092 tcp:8092`. **Release APK:** rebuild with embedded bundle (`SEACHECK_APP_VARIANT=production npx expo prebuild …` then `npm run android:release`). Do not sideload a debug/dev APK without Metro. |
| `react_codegen_AsyncStorageSpec` CMake error | Native module version drift (e.g. async-storage **3.x** vs Expo pin **2.2.0**). Run `npx expo install --check` and fix any mismatches, then `npm run android:rebuild`. Preflight now runs `--check` automatically. |
| `react_codegen_*` CMake error (other modules) | Same root cause — stale autolinking from a prior native version. `npm run android:clean` then `npm run android:rebuild` after aligning deps. |
| App keeps stopping (Android) | Uninstall SeaCheck, then `npm run android:rebuild`. Enable USB debugging and run `adb logcat -d \| grep -iE "seacheck\|AndroidRuntime\|FATAL"` if it persists. A startup crash was fixed by breaking a circular import in the background GPS task — rebuild is required. **`NoClassDefFoundError: AnyTypeProvider`** means `expo-location` is the wrong SDK version — run `npx expo install expo-location` and rebuild. |
| Offline map blank | Download a pack on Wi‑Fi first; wait for **Ready for offline use** |
| Native change not applied | `npm run android:rebuild` (Metro reload alone is not enough) |
| Red LogBox battery / optional hardware on emulator | Optional hardware — dismiss with **Dismiss**; app continues. Reload Metro with **`r`**. |
| Battery % missing in GPS strip | Emulator may not expose battery APIs — normal; works on device |
| OpenSeaMap tile timeout in Metro log | OpenSeaMap CDN can be slow; online seamarks may be missing briefly. Offline: download a pack first. Harmless after map logging filter. |
| Anchor watch limited chip | Grant background location + notifications in system settings |
| `createExpoConfig` / plugin errors | Only list real config plugins in `app.config.ts` (not bare `expo-haptics` / `expo-battery`) |

---

## Stop everything

```bash
# Metro: Ctrl+C in that terminal
adb -s emulator-5554 emu kill   # optional
```

---

## Start here

If nothing is running yet: run `npm install` once, then `npm run dev` from `mobile/seacheck`. Complete onboarding, then download **Kieler Bucht** on Wi‑Fi and run the offline smoke test above.

Full reference: [`README.md`](../README.md).
