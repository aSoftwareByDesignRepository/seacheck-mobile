# Google Play — graphics requirements

## Required assets

| Asset | Size | Source in repo |
|-------|------|----------------|
| **App icon** | 512×512 PNG, 32-bit, max 1024 KB | `assets/icon.png` |
| **Feature graphic** | **1024×500** PNG or JPEG | **Create** — see brief below |
| **Phone screenshots** | Min **2**, max 8; 16:9 or 9:16; each side 320–3840 px | `docs/play-store/assets/screenshots/` (create when capturing) |

Optional: tablet screenshots (app supports tablet on iOS).

---

## Feature graphic brief (1024×500)

Design to match [software-by-design.de](https://software-by-design.de) and the SeaCheck icon:

- Background: maritime dark blue (`#0b1622`) or clean white with blue accent (`#0073ad`)
- Left: app icon (compass / chart motif)
- Right text (large, readable):
  - **SeaCheck**
  - Subline: **Offline coastal navigation**
- Small line (optional): *Aid to navigation — not official charts*
- WCAG: sufficient contrast

Export as `docs/play-store/assets/feature-graphic-1024x500.png` when done.

---

## Screenshot shot list (recommended 6)

Capture on **phone** emulator (1080×2400) or physical device, **light theme**, **English** UI, **production build** (no dev client overlay):

| # | Screen | What to show |
|---|--------|----------------|
| 1 | Onboarding disclaimer | Navigation notice + OpenSeaMap/OSM links |
| 2 | Map | Kiel area, boat position, instruments |
| 3 | Passage | Active passage or waypoint list |
| 4 | Downloads | Kieler Bucht pack + “Ready for offline use” |
| 5 | Map (offline) | Airplane mode banner or offline chart in use |
| 6 | Settings → About | Disclaimer, attribution, privacy link |

**Tip:** `adb exec-out screencap -p > screenshot.png` or Android Studio Device Manager.

Also capture **German** screenshots for `de-DE` listing (optional but recommended).

---

## Promo video (optional)

30s screen recording: download pack → map with GPS → set anchor alarm.

---

## Icon check

```bash
file assets/icon.png
# Should be 1024×1024 or scalable source; resize to 512×512 for Play upload if needed
```
