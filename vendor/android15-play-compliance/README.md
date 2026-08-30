# `@check/android15-play-compliance`

Shared Expo config plugin + fleet verifier for Android 15 / Google Play Console findings across Check companion apps.

## What it fixes

| Finding | Mitigation |
|---------|------------|
| Unused `SYSTEM_ALERT_WINDOW` | `tools:node="remove"` (Android 15 restricts background FGS when SAW is held without an overlay) |
| Deprecated edge-to-edge bar colors | Strip `statusBarColor` / `navigationBarColor` from `styles.xml` |
| R8 not enabled / optimization off | `android.enableMinifyInReleaseBuilds=true` + resource shrinking + `android.r8.optimizedResourceShrinking=true` + `proguard-android-optimize.txt` |
| Play asks to upgrade AGP to 9.0+ | **Do not force AGP 9** on Expo SDK 56 (RN pins **8.12**). Use full R8 stack via `@check/android15-play-compliance/agp-r8` gate instead — see `assertAgpR8UpgradeGate()` |
| Restricted FGS + `BOOT_COMPLETED` | Optional profile strips notifications boot (AudioCheck only) |

**AGP 9 note:** Expo SDK 56 / React Native 0.85 pin Android Gradle Plugin **8.12**. Play may still suggest upgrading to AGP 9; forcing 9.0 outside the Expo/RN pin is unsafe. Optimized resource shrinking is enabled via the AGP 8.12 opt-in flag until the fleet moves to an SDK that ships AGP 9.

**Edge-to-edge / StatusBar note:** Stripping `statusBarColor` / `navigationBarColor` from `styles.xml` is required for *app* theme compliance. Expo’s built-in `SystemBars` plugin re-adds transparent bar colors via `withAndroidStyles` *after* `withDangerousMod` runs — this package therefore removes them in the styles AST **and** re-strips the written file in a `withFinalizedMod` (runs last).

Play Console may still list `com.facebook.react.modules.statusbar.StatusBarModule` and `WindowUtilKt.enableEdgeToEdge` because React Native’s own Kotlin sources call deprecated `Window` bar-color / cutout APIs. Every fleet app wires:

```bash
npm run patch:rn-edge   # postinstall + preflight + android:bundle
```

which runs `mobile/shared/android15-play-compliance/scripts/patch-rn-edge-to-edge.cjs` (also exported as `@check/android15-play-compliance/patch-cli`). To (re)wire the whole fleet:

```bash
cd mobile/shared/android15-play-compliance
npm run apply-fleet-rn-edge
```

Do **not** set `windowOptOutEdgeToEdgeEnforcement` or disable `edgeToEdgeEnabled` to silence the finding. Material bottomsheet call sites may remain until Google / androidx migrate.

**Orientation note:** This package does **not** unlock `screenOrientation`. Apps that must support tablets/foldables set Expo `orientation: 'default'` (manifest `unspecified`) themselves — ProjectCheck / BudgetCheck do; phone-first companions may remain portrait by product choice until they adopt the same unlock.

## Profiles

- `standard` — SAW + edge + R8 (keep notification boot for reminders/timers)
- `stripNotificationBoot` — also strip notifications boot + `RECEIVE_BOOT_COMPLETED` (AudioCheck / dataSync FGS)
- `keepBoot` — SAW + edge + R8 only (SeaCheck TaskManager location, DeskCheck Room Display activity boot)

`location` is **not** a BOOT_COMPLETED-restricted FGS type on Android 15 — SeaCheck may restore monitoring after reboot.

## Commands

```bash
cd mobile/shared/android15-play-compliance
npm test
npm run mutate
npm run apply-fleet   # idempotent tree + app.config wiring
npm run apply-fleet-rn-edge   # wire patch:rn-edge into every app package.json + release scripts
npm run verify-fleet
npm run gauntlet      # test + mutate + verify-fleet
```

## Architecture notes

- `file:` installs symlink this package; Node resolves from the realpath under
  `mobile/shared/`, so the plugin loads `expo/config-plugins` via
  `loadExpoConfigPlugins()` from the consumer app cwd.
- Pure helpers (`policy`, `stylesXml`, `gradleProps`, `manifestXml`,
  `manifestObject`) are shared by the Expo config plugin and `patchAndroidTree`
  so checked-in `android/` trees and prebuild stay consistent.
- `verify-fleet` matches real `<item name="android:statusBarColor">` tags only
  (educational comments that mention the attr names are allowed).
