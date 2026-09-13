# Play screenshots — pt

Locale: `pt` (device / `STORE_LOCALE=pt`).

Target files: `phone-01.png` … `phone-06.png` (1080×1920). Tablet kits may also use `tablet-01.png` ….

Capture when EN+DE are green and a store capture script exists:

```bash
cd mobile/seacheck
export STORE_LOCALE=pt
# acquire this app's AVD first — see emulator-iron-law
bash scripts/capture-play-screenshots.sh
```

Until captured, Play Console can reuse EN screenshots for this locale (metadata still benefits from a translated listing).
