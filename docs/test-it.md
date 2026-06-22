# SeaCheck Mobile — test it

## Automated gates

```bash
cd mobile/seacheck
npm run preflight
```

Covers: TypeScript, unit tests (geo, coords, tile math, bounds, magnetic), contrast (WCAG AA including red night), touch targets (≥48 px), EN/DE i18n parity.

## First-run smoke (emulator or device)

1. Rebuild native app after dependency changes: `npm run android`
2. Complete onboarding (disclaimer → location → battery → finish)
3. **Downloads** → **Kieler Bucht (test)** → wait for **Ready for offline use**
4. Enable airplane mode → **Map** → pan Kiel area — base + seamarks visible
5. **Downloads** → **Select area on map** → tap two corners → confirm download
6. Disable airplane mode → long-press map → save waypoint → **Waypoints** list → tap to go-to
7. **Tracks** → enable background recording in Settings → Start → lock screen 30 s → stop → Export GPX
8. **Passage** → set name/SOG/departure → reorder waypoints → per-leg SOG → verify **Offline chart coverage** + map preview → Export GPX / Copy summary → Activate
9. Map → hold **MOB** 2 s; set **Anchor** alarm — confirm sound/vibration (Settings → Alarms)
10. **Settings** → theme, units, vessel, Mayday share

## Background track recording

Requires **Settings → Background track recording** on and system **Always allow** location.

- Android shows a foreground-service notification while recording.
- Adaptive intervals: ~10 s when moving, ~60 s when speed is below ~1 kn.
- Without background permission, tracks still record every ~2 s while the app is open.

## Custom offline download

1. **Downloads** → **Select area on map**
2. Pan/zoom to your sailing area
3. Tap corner 1, then opposite corner 2
4. Pick max zoom (z12–14), confirm size estimate, **Download this area** on Wi‑Fi
5. Pack appears under **Your custom packs**

## On-water UAT corridors (plan §6.9)

| Corridor | Pack |
|----------|------|
| Kieler Bucht | `kiel-bay` |
| Småland | `baltic-south-se` |
| Dänische Südsee | `baltic-west` + `baltic-south` + custom rectangle |

Record: GPS accuracy, seamark visibility at z12–14, offline cutover, instrument readability in sunlight, background track continuity with screen off.

## Alarms

Settings → **Alarms**: toggle sound and haptic/vibration independently.

- **Anchor drag** — critical: double beep + vibration, repeats every 45 s until back inside radius
- **Arrival / XTE** — warning: single beep + haptic
- **Leg advance** — dialog at waypoint (or auto if enabled in Settings); leg timer resets

## Sailing race profile

1. Map → **Layout** → profile **Sailing race**
2. In sheet: set **Start line** (pin A + pin B from saved waypoints)
3. Activate a passage → verify **Leg time** counts, **BRG to mark**, **XTE**, leg index
4. Arrive at mark → leg advance → timer resets, go-to updates to next mark

## Barometer

Shown on instrument panel when the device has a pressure sensor. Samples every ~5 min; 3 h trend with **falling fast** warning badge (no forecast claims).

## Known v1 gaps (audit checklist)

- VMG, laylines, start countdown (racing pack v1.1)
- Magnetic grid clamped outside Baltic bounding box (52–58°N, 8–16°E)
- Background alarms when app process is killed (sound/haptic require app alive)
