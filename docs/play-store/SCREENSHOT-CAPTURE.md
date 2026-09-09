# Play Store screenshots — capture guide

Target: **2–8 phone screenshots** (9:16), plus **512×512 icon** and **1024×500 feature graphic** ([GRAPHICS.md](./GRAPHICS.md)).

## Prerequisites

- **Production** build (no Expo dev client overlay): release APK/AAB  
- English UI for default listing; capture German set for **de-DE** when possible  
- Emulator/device with enough free space for the APK  

## Recommended shots (matches [GRAPHICS.md](./GRAPHICS.md); store-farm detail in `.cursor/store-farm/seacheck-play-shot-list.md`)

| # | File | Screen | What to show |
|---|------|--------|----------------|
| 1 | `phone-01-map.png` | Map hero | Live GPS + instruments; dismiss download toast |
| 2 | `phone-02-passage-map.png` | Map + active passage | Route on chart |
| 3 | `phone-03-passage.png` | Passage | Active passage (≥2 WPs), not empty |
| 4 | `phone-04-downloads.png` | Downloads | Region packs + Download / Ready |
| 5 | `phone-05-offline.png` | Map offline or Tracks | Offline banner or tracks with content |
| 6 | `phone-06-disclaimer.png` | Safety (≤1) | Full disclaimer, no mid-sentence crop |

Capture **de-DE** as a separate device locale pass. Do not copy en-US PNGs into `de-DE`.

## Automated live capture (preferred)

Installs the production APK, drives onboarding via uiautomator, writes 1080×1920 finals. **Run once per locale** (`system_locales en-US` then `de-DE`); do not copy the same PNGs into both folders. Current script still clones both — update before Play resubmit.

```bash
cd mobile/seacheck
# After emulator_acquire only — never steal a locked serial
export SEACHECK_MAESTRO_DEVICE="$ANDROID_SERIAL"
export SEACHECK_RELEASE_APK=android/app/build/outputs/apk/release/app-release.apk  # 0.1.9
bash scripts/capture-play-screenshots.sh
```

Outputs:

- `docs/play-store/assets/screenshots/phone-0N-*.png` (store-ready)
- `docs/play-store/assets/screenshots/_raw-live/` (device resolution; gitignored)
- `fastlane/metadata/android/{locale}/images/phoneScreenshots/1.png`…`6.png`

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
