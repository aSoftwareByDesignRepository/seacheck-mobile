# Privacy policy — SeaCheck Mobile (Android / iOS)

**Last updated:** 2026-07-12  
**App:** SeaCheck Mobile  
**Publisher:** Software by Design GbR, Husumer Baum 2, 24837 Schleswig, Germany  
**Contact:** info@software-by-design.de · datenschutz@software-by-design.de  
**General privacy (website):** https://software-by-design.de/datenschutz/  
**Package:** `de.softwarebydesign.seacheck`

---

## 1. Scope

This policy describes the **mobile app** SeaCheck (Android and iOS). SeaCheck is a **standalone** maritime navigation companion. It does **not** require a Nextcloud server or any account with Software by Design.

**Software by Design does not operate a central cloud** that stores your passages, tracks, or GPS history. Your data stays on your device unless you export or share it yourself.

---

## 2. Who is responsible for your data?

| Data location | Controller |
|---------------|------------|
| App on your device (waypoints, passages, tracks, settings, offline charts) | **You** (data controller for device data) |
| Publisher of the mobile app | **Software by Design GbR** (this policy) |

For questions about **this mobile app**, contact **datenschutz@software-by-design.de**.

---

## 3. What the app stores on your device

| Data | Purpose | Storage |
|------|---------|---------|
| **GPS position** (current and recent fixes) | Chart position, instruments (COG, SOG), anchor alarms, track recording | In memory while app runs; track points saved when you record a track |
| **Waypoints, passages, route legs** | Passage planning and navigation | SQLite database on device |
| **Tracks and track points** | Passage logging | SQLite database on device |
| **Vessel details** (name, call sign, MMSI, home port — optional) | Mayday text, default passage names | App storage (AsyncStorage) |
| **Settings** (units, theme, alarms, layout, etc.) | App preferences | App storage |
| **Offline chart packs** (map tiles) | Use charts without mobile signal | Device filesystem (MapLibre offline cache) |
| **Seamark index** (subset of OpenSeaMap data) | Offline seamark lookup | SQLite on device |
| **Cached seamark tiles** | Chart display | Device filesystem |

The app does **not** create an account and does **not** upload your passages, tracks, or continuous location history to Software by Design servers.

---

## 4. What is sent over the internet

When you are **online**, the app may contact **third-party services** (not Software by Design):

| Service | Data sent | Purpose |
|---------|-----------|---------|
| **CARTO** (basemaps.cartocdn.com) | Map tile requests (area/zoom; no account) | Base map tiles |
| **OpenSeaMap** (tiles.openseamap.org) | Map tile requests | Seamark overlay tiles |
| **OpenStreetMap Overpass API** (e.g. overpass-api.de) | Bounding-box queries for seamarks | Online seamark lookup when local index has no match |

These requests reveal **which map areas** you view or query, not your identity. No account is required.

**Offline:** After you download a region pack on Wi‑Fi, chart tiles and seamark data for that area are stored on your device. The app can work without sending your GPS to any server.

---

## 5. What we do **not** do

- No sale of personal data  
- No third-party **advertising** or **analytics** SDKs (e.g. no Firebase Analytics)  
- No transfer of your passages, tracks, or location history to Software by Design servers  
- No profiling or marketing based on your navigation data  
- No social features or public sharing of your position  

---

## 6. Permissions (Android / iOS)

| Permission | Why |
|------------|-----|
| **Location** (while in use) | Show your position on the chart; COG, SOG, bearing |
| **Location** (background / always) | Anchor drag alarms and track recording when the screen is off (optional; you can skip at onboarding) |
| **Internet** | Download chart tiles and online seamark queries |
| **Notifications** | Anchor drag, arrival, and off-course alarms |
| **Wake lock / foreground service** (Android) | Reliable GPS and alarms underway |

---

## 7. Export, sharing, and deletion

| Action | How |
|--------|-----|
| **Export** passages or tracks | In-app GPX export → you choose where to save or share (system share sheet) |
| **Copy coordinates** | Clipboard (user-initiated) |
| **Delete app data** | Uninstall the app, or delete individual passages, tracks, waypoints, and offline packs in the app |

There is no remote account to delete. Uninstalling removes local app data from your device (subject to OS backup behaviour).

---

## 8. Your rights (GDPR)

If you are in the EU/EEA, you may have rights to access, rectify, erase, restrict, or object to processing, and to data portability where applicable.

Because data is stored **locally on your device**, you control it directly (export GPX, delete in app, uninstall). Contact **datenschutz@software-by-design.de** for questions about this app or to exercise rights relating to data processed by Software by Design as publisher.

Supervisory authority (Germany): the data protection authority for your place of residence or work.

---

## 9. Children

SeaCheck is intended for **skippers and crew** using boats responsibly. It is **not directed at children under 16**.

---

## 10. Map data attribution

SeaCheck uses community map data from **OpenStreetMap**, **OpenSeaMap**, and **CARTO** Voyager base tiles. See in-app **Settings → About** and our [terms & navigation notice](https://nextcloud.software-by-design.de/en/terms-seacheck-mobile.html).

---

## 11. Changes

We may update this policy when the app changes. The “Last updated” date will change accordingly.
