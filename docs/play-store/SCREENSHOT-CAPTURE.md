# Play Store screenshots — capture guide

Target: **2–8 phone screenshots** (9:16), plus **512×512 icon** and **1024×500 feature graphic** ([GRAPHICS.md](./GRAPHICS.md)).

## Prerequisites

- **Production** build (no Expo dev client overlay): release APK/AAB  
- English UI for default listing; capture German set for **de-DE** when possible  
- Emulator/device with enough free space for the APK  

## Recommended shots (matches [GRAPHICS.md](./GRAPHICS.md) / `phone-0N-*.png`)

| # | File | Screen | What to show |
|---|------|--------|----------------|
| 1 | `phone-01-map.png` | Map | Coastal area, instruments, controls |
| 2 | `phone-02-disclaimer.png` | Onboarding disclaimer | Navigation notice + OpenSeaMap/OSM links |
| 3 | `phone-03-passage.png` | Passage | Active passage or empty-state with New passage |
| 4 | `phone-04-downloads.png` | Downloads | Region packs + Download / Ready |
| 5 | `phone-05-offline.png` | Map (offline) | Offline banner or airplane mode |
| 6 | `phone-06-about.png` | Settings → About | Disclaimer, attribution, privacy link |

## Automated live capture (preferred)

Installs the production APK, drives onboarding via uiautomator, writes 1080×1920 finals, and syncs fastlane `phoneScreenshots` for **en-US** and **de-DE**:

```bash
cd mobile/seacheck
export SEACHECK_MAESTRO_DEVICE=emulator-5562   # your AVD serial
export SEACHECK_RELEASE_APK=~/Downloads/apk-releases/seacheck-0.1.5-release.apk
bash scripts/capture-play-screenshots.sh
npm run appstore:screenshots   # framed iPhone 6.5″ / 6.9″ + iPad 13″
```

Outputs:

- `docs/play-store/assets/screenshots/phone-0N-*.png` (store-ready)
- `docs/play-store/assets/screenshots/_raw-live/` (device resolution; gitignored)
- `fastlane/metadata/android/{en-US,de-DE}/images/phoneScreenshots/1.png`…`6.png`

## Manual emulator capture

```bash
adb -s "$SEACHECK_MAESTRO_DEVICE" exec-out screencap -p > docs/play-store/assets/screenshots/_raw.png
```

Crop/normalize to 1080×1920 (9:16). Remove debug banners.

## Placeholder generator (fallback only)

```bash
npm run play:screenshots
```

Illustrative PNGs only — **prefer live capture before production submit**.

## Before upload

- [ ] Live UI (not placeholders), no Metro / debug overlay  
- [ ] Disclaimer visible in at least one shot  
- [ ] Privacy URL in About matches live `privacy-seacheck-mobile.html`  
- [ ] Do not reuse AZC / DutyCheck / BudgetCheck art ([GRAPHICS.md](./GRAPHICS.md))
