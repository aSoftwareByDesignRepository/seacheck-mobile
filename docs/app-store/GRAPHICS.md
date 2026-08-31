# App Store — graphics

Reuse Play assets where sizes match:

| Asset | Size | Source |
|-------|------|--------|
| App icon | 1024×1024 | `assets/icon.png` (upload to App Store Connect) |
| iPhone 6.5″ screenshots | 1284×2778 or 1242×2688 | `docs/play-store/assets/screenshots/` after live capture |
| iPad 13″ screenshots | 2048×2732 | Optional (`supportsTablet: true`) |

Generate Play placeholders: `npm run play:screenshots`  
Generate feature graphic (Play only): `npm run play:graphics`

**Do not:** reuse AZC / DutyCheck / BudgetCheck screenshots.  
**Do:** show navigation disclaimer, map with GPS, downloads ready state, Settings → About with privacy link.

See [../play-store/GRAPHICS.md](../play-store/GRAPHICS.md) and [../play-store/SCREENSHOT-CAPTURE.md](../play-store/SCREENSHOT-CAPTURE.md).
