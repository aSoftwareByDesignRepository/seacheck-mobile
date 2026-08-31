# Play Store screenshots — capture guide

Target: **2–8 phone screenshots** (9:16), plus **512×512 icon** and **1024×500 feature graphic** ([GRAPHICS.md](./GRAPHICS.md)).

## Prerequisites

- **Production** build (no Expo dev client overlay): `SEACHECK_APP_VARIANT=production` + release APK/AAB  
- English UI for default listing; capture German set for **de-DE** when possible  
- Grant location on emulator/device for map shots  

## Recommended shots (matches [GRAPHICS.md](./GRAPHICS.md))

| # | Screen | What to show |
|---|--------|----------------|
| 1 | Onboarding disclaimer | Navigation notice + OpenSeaMap/OSM links |
| 2 | Map | Coastal area, boat position, instruments |
| 3 | Passage | Active passage or waypoint list |
| 4 | Downloads | Kiel Bay pack + “Ready for offline use” |
| 5 | Map (offline) | Offline banner or airplane mode |
| 6 | Settings → About | Disclaimer, attribution, privacy link |

## Emulator capture (Android)

```bash
cd mobile/seacheck
# Dedicated AVD — do not fight other emulators:
export SEACHECK_MAESTRO_DEVICE=emulator-5574
bash scripts/dev-emulator.sh   # or your own SeaCheck_Maestro_API_33 instance

# Production-ish build on device:
SEACHECK_APP_VARIANT=production npx expo run:android --variant release

adb -s $SEACHECK_MAESTRO_DEVICE exec-out screencap -p > docs/play-store/assets/screenshots/phone-01.png
```

Crop to 9:16 if needed. Remove debug banners.

## Placeholders until live capture

```bash
npm run play:screenshots
```

Generates illustrative PNGs in `docs/play-store/assets/screenshots/`. **Replace before production submit** — Play reviewers and sailors expect real UI.

## Before upload

- [ ] No debug banner / Metro overlay  
- [ ] Disclaimer visible in at least one shot  
- [ ] Privacy URL in About matches live `privacy-seacheck-mobile.html`  
- [ ] Do not reuse AZC / DutyCheck / BudgetCheck art ([GRAPHICS.md](./GRAPHICS.md))

Save finals to `docs/play-store/assets/screenshots/` and pick 2–8 in Play Console.
