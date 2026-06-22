# SeaCheck Mobile

Proprietary maritime navigation companion (offline charts, GPS instruments, passage planning). Standalone app — no Nextcloud server required.

Plan: [`planning/app-ideas/seacheck/PLAN-MOBILE-APP.md`](../../planning/app-ideas/seacheck/PLAN-MOBILE-APP.md)

## Stack

- Expo React Native SDK 56 (development client — **not Expo Go**)
- React Navigation 7 (bottom tabs)
- Zustand + AsyncStorage
- expo-location, expo-keep-awake
- EN / DE (i18n-js)

## Run

**One command (recommended):**

```bash
cd mobile/seacheck
npm install
npm run dev
```

**Manual / interactive Metro** (reload with `r`):

```bash
cd mobile/seacheck
npm install
npm run preflight   # optional: typecheck, tests, contrast, i18n parity
npm start           # Metro on port 8092
```

In a **second terminal**, build and install the native app:

```bash
npm run android
# or
npm run ios         # macOS + Xcode only
```

After changing native dependencies or `app.config.ts` plugins, run `npm run android` or `npm run ios` again to rebuild.

## First launch

Onboarding walks through:

1. Navigation disclaimer (not a certified plotter)
2. Location permissions (foreground + background for tracks)
3. Android battery optimization guidance
4. Locked defaults: **Cruise/passage** — kn, NM, true°, DDM, course-up

Settings → **Vessel** stores name, call sign, MMSI, and home port for Mayday text and default passage names.

## Quality gates

```bash
npm run typecheck
npm test
npm run a11y:contrast
npm run a11y:touch
npm run i18n:parity
npm run preflight
```

## UAT corridors (Baltic)

On-water testing targets: **Kieler Bucht**, **Småland**, **Dänische Südsee** — see plan §6.9.

## Scope (scaffold)

This app is **offline-first**: download region packs (base + OpenSeaMap seamarks) on Wi‑Fi, then use charts without signal.

**First steps:**
1. Open **Downloads** → download **Kieler Bucht (test)** on Wi‑Fi
2. Enable airplane mode to verify offline tiles
3. Open **Map** — base + seamarks render from local cache

Live online tiles still work while downloading; once a pack is **Ready for offline use**, MapLibre serves cached tiles.

**After adding MapLibre**, rebuild the native app once:

```bash
npm run android   # or npm run ios
```
