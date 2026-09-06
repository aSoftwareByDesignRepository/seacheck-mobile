# App Store screenshots (SeaCheck)

App Store Connect’s **iPhone 6,5" Display** slot accepts **1284 × 2778**
(or 1242 × 2688). The **iPad 13" Display** slot accepts **2064 × 2752** (portrait).

| Device | Size (portrait) | File |
|--------|-----------------|------|
| **Upload** — iPhone 6.5" | **1284 × 2778 px** | `assets/iphone-65-01.png` … `iphone-65-06.png` |
| Design master — 6.9" | 1320 × 2868 px | `assets/iphone-69-01.png` … `iphone-69-06.png` |
| **Upload** — iPad 13" | **2064 × 2752 px** | `assets/ipad-13-01.png` … `ipad-13-06.png` |

PNG, RGB, no alpha. Up to 10 screenshots per locale. Order: **01 first** (map).

## Stage

One shared maritime frame so a carousel swipe does not jump:

- Same deep-sea gradient on every shot (SeaCheck palette — **not** AZC Nextcloud blue / clock)
- Same device position and crop
- Same type slots (kicker + two-line title + two-line subtitle)
- Device content from Play placeholders or live captures under `assets/captures/`

**Do not:** emoji, price badges, Play Store marks, AZC/DutyCheck screenshots, debug banners, “certified plotter” claims.

## Shots

| # | Screen | EN title idea |
|---|--------|---------------|
| 01 | Map + GPS | GPS on chart |
| 02 | Navigation disclaimer | Aid only · not ECDIS |
| 03 | Passage list | Sketch the passage |
| 04 | Downloads / pack Ready | Download on Wi‑Fi |
| 05 | Offline chart use | Charts without signal |
| 06 | Settings → About | No ads · no account |

## Generate

```bash
cd mobile/seacheck
npm run play:screenshots          # ensure Play phone placeholders exist
npm run appstore:screenshots      # frame → docs/app-store/assets/
```

Optional live captures (replace placeholders):

```bash
# Save Simulator/device PNGs into docs/app-store/assets/captures/
# named iphone-69-01.png … then re-run npm run appstore:screenshots
```

Also see [../play-store/SCREENSHOT-CAPTURE.md](../play-store/SCREENSHOT-CAPTURE.md) and [../play-store/GRAPHICS.md](../play-store/GRAPHICS.md).

**App icon 1024×1024:** `assets/icon.png` → App Store Connect.
