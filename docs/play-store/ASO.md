# Discoverability (ASO) — SeaCheck Mobile

Google Play has **no separate keyword field**. Ranking signals you control:

1. **App name** (30) — highest weight  
2. **Short description** (80) — second highest  
3. **Full description** (4000) — natural keyword coverage  
4. **Category + up to 5 tags** — browse / Explore  
5. **Conversion** — screenshots, icon, feature graphic  

Paste [LISTING-en.txt](./LISTING-en.txt) / [LISTING-de.txt](./LISTING-de.txt) exactly. Do **not** keyword-spam.

---

## Play Console checklist

| Step | Where | What to set |
|------|--------|-------------|
| Default language | Store presence | **English (United States)** from LISTING-en |
| German listing | Add translation **de-DE** | LISTING-de — critical for DACH coastal sailors |
| Category | Store settings | **Maps & Navigation** (primary) |
| Tags | Manage tags (max **5**) | See below |
| Website | Store listing contact | https://software-by-design.de |
| Visibility | First share | **Unlisted** (see [SHARE.md](./SHARE.md)) or **Listed** when ready |

---

## Tags (closest official names)

1. Maps & Navigation  
2. Sports  
3. Tools  
4. Travel  
5. Boating (if offered; else skip)

---

## Target search phrases

| Locale | Phrases |
|--------|---------|
| de-DE | Küstennavigation, Segeln App, OpenSeaMap offline, Ankeralarm, GPS Karte Boot |
| en-US | coastal navigation app, sailing GPS chart, offline OpenSeaMap, anchor alarm, passage planning |

Do **not** compete on “Zeiterfassung / clock in” — that is **ArbeitszeitCheck**.  
Do **not** claim ECDIS / certified chart plotter — listing must keep the navigation disclaimer.

Honest negatives: no account, no ads, no analytics, not official charts, volunteer OSM/OSM seamark data.

---

## Conversion

- First screenshots: **Disclaimer** → **Map with GPS** → **Downloads ready**  
- Feature graphic + 512 icon: `npm run play:graphics`  
- Phone placeholders: `npm run play:screenshots` (replace with live captures before final submit — [SCREENSHOT-CAPTURE.md](./SCREENSHOT-CAPTURE.md))  
- Privacy URL must match [PUBLISH-LEGAL.md](./PUBLISH-LEGAL.md)
