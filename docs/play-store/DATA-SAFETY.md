# Google Play — Data safety form (cheat sheet)

Use **Play Console → App content → Data safety**. Answers match the **production** app (`de.softwarebydesign.seacheck`) as implemented in this repository.

**Framing:** SeaCheck is **standalone**. Navigation data stays **on the device**. The app contacts **third-party map services** when online (CARTO, OpenSeaMap, Overpass). **No** Software by Design backend receives your passages or GPS history.

---

## Summary for users (Play’s public Data safety section)

Suggested short summary:

> SeaCheck stores waypoints, passages, and tracks on your device. Location is used for the chart, alarms, and track recording. Chart downloads contact CARTO and OpenSeaMap. No ads or analytics. No account required.

---

## Step 1 — Does your app collect or share data?

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |

---

## Data types — what to declare

### Location

| Data type | Collected? | Shared? | Required? | Purpose | Notes |
|-----------|------------|---------|-----------|---------|-------|
| **Approximate location** | Yes | No | Yes (core feature) | App functionality | GPS for chart & instruments |
| **Precise location** | Yes | No | Yes (core feature) | App functionality | Same; background optional for anchor/tracks |

**Ephemeral:** Live GPS fixes are processed in the app; not uploaded to Software by Design servers.

**Shared with third parties:** **No** for location coordinates. (Map tile requests reveal map area, not GPS — declare under “other” only if Play forces tile CDN as “sharing”; typically **not** shared for location type.)

### Personal info

| Data type | Collected? | Shared? | Required? | Purpose |
|-----------|------------|---------|-----------|---------|
| **Name** | Optional | No | No | App functionality | Vessel name you enter (Settings → Vessel) |
| **Other info** | Optional | No | No | App functionality | Call sign, MMSI, home port — user-entered |

### Financial, health, messages, photos, contacts, etc.

| | Answer |
|---|--------|
| All standard categories not listed above | **No** |

### App activity

| Data type | Collected? | Shared? | Purpose |
|-----------|------------|---------|---------|
| **App interactions** | **No** | No | No analytics SDK |

### Web browsing

| | Answer |
|---|--------|
| Web browsing history | **No** |

### App info and performance

| | Answer |
|---|--------|
| Crash logs / Diagnostics | **No** third-party crash SDK in app |

### Device or other IDs

| | Answer |
|---|--------|
| Device IDs for ads/tracking | **No** |

---

## Files on device (explain in policy; Play may not ask separately)

| Data | On device | Sent to SBD servers |
|------|-----------|---------------------|
| Waypoints, passages, tracks | Yes (SQLite) | No |
| Offline map tiles | Yes | No |
| Settings | Yes | No |

---

## Step 2 — Is all data encrypted in transit?

| Question | Answer |
|----------|--------|
| Is all user data encrypted in transit? | **Yes** |

HTTPS for CARTO, OpenSeaMap, and Overpass tile/API requests.

---

## Step 3 — Can users request data deletion?

| Question | Answer |
|----------|--------|
| Do you provide a way for users to request that their data is deleted? | **Yes** |

**How:** Delete passages/tracks/waypoints and offline packs in-app; uninstall removes local data. Document in privacy policy §7.

---

## Step 4 — Account creation

| Question | Answer |
|----------|--------|
| Do users create an account in your app? | **No** |
| Can users use the app without an account? | **Yes** |

---

## Data handling commitments

| | Answer |
|---|--------|
| Data is **not sold** | **Yes** |
| Data is **not used for advertising** | **Yes** |
| Data collection is **required** for core features | Location yes (chart/GPS); vessel fields optional |

---

## Security practices (if asked)

| Practice | Answer |
|----------|--------|
| Data encrypted in transit | Yes (HTTPS to tile servers) |
| Users can request deletion | Yes (in-app + uninstall) |

---

## Apple App Store Privacy Nutrition Labels (iOS)

When you publish to App Store Connect, align labels with this table:

| Category | Detail |
|----------|--------|
| Data linked to you | **None** (no account) |
| Location | **Precise location** — App functionality, not linked, not used for tracking |
| Other data | Optional vessel name/details — user-provided, on device |
| Tracking | **No** |

---

Align public Data safety text with [privacy-mobile-en.md](./privacy-mobile-en.md) before submitting.
