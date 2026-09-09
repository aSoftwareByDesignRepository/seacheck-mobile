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

Capture on **phone** emulator or physical device, **light theme**, **production build** (no dev client overlay). Filenames match `docs/play-store/assets/screenshots/`. Capture **en-US and de-DE separately** (never clone locales). Authoritative store-farm list: `.cursor/store-farm/seacheck-play-shot-list.md`.

| # | File | Screen | What to show |
|---|------|--------|----------------|
| 1 | `phone-01-map.png` | Map hero | Live GPS (SOG/COG/±m), coastal chart; dismiss non-essential banners |
| 2 | `phone-02-passage-map.png` | Map + active passage | Route/waypoints on chart |
| 3 | `phone-03-passage.png` | Passage | **Active** passage (≥2 waypoints) — not empty-state |
| 4 | `phone-04-downloads.png` | Downloads | Region packs + download CTA |
| 5 | `phone-05-offline.png` | Map offline or Tracks | Offline banner **or** tracks with content |
| 6 | `phone-06-disclaimer.png` | Safety notice (≤1) | Full disclaimer from start of sentence; no mid-crop |

**Drop from primary set:** empty Passage, About/legal, duplicate awaiting-GPS maps.

Tablet 7″/10″: full-bleed landscape only — no grey voids, truncated nav labels, Löschen crops, or phone collages. en-US = English UI; de-DE = German UI.

**Automated:** `bash scripts/capture-play-screenshots.sh` (see [SCREENSHOT-CAPTURE.md](./SCREENSHOT-CAPTURE.md)) — update script order when re-running.

---

## Promo video (optional)

30s screen recording: download pack → map with GPS → set anchor alarm.

---

## Icon check

```bash
file assets/icon.png
# Should be 1024×1024 or scalable source; resize to 512×512 for Play upload if needed
```
