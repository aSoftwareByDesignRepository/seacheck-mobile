# SeaCheck — Risk & Coverage Inventory (Momos re-attack 2026-09-06)

**App:** `nextcloud-dev/mobile/seacheck` · `0.1.5`  
**Environment:** Native Jest (no Docker). Emulator AVD `SeaCheck_Maestro_API_33`.

---

## Step 0 invariants (test against these)

| ID | Invariant | Severity if broken | Coverage status |
|----|-----------|--------------------|-----------------|
| I1 | Not ECDIS / aid only | Product | Docs + onboarding |
| I2 | Offline packs usable when Ready | Critical | **Device BROKEN** (cannot reach Ready) |
| I3 | One exclusive download session | Critical | Jest + mutate download-parallel |
| I4 | Wi‑Fi gate; NetInfo throw → confirm | High | Jest + mutate |
| I5 | Ready only after durable seal | Critical | Jest state machine only; OfflineManager mocked |
| I6 | Cancel mid-seal no false Ready | Critical | Maestro cancel **red** |
| I7 | Kill mid-download honest resume/fail | High | Maestro kill blocked by I2 |
| I8 | Index mutations serialized; stale sessions ignored | High | Jest + mutate |
| I9 | Depth WMS opt-in, online, allowlisted | High | Jest allowlist |
| I10 | Anchor accuracy / gap rules | Critical | Jest + mutate |
| I11 | MOB under screen lock | High | Sparse E2E |
| I12 | Basemap migration invalidates packs | High | Jest |
| I13 | One active passage | Medium | Partial |
| I14 | Tile UA before first paint | Medium | App boot |
| I15 | Tile probe not fail-open on placeholder | High | Jest |
| I16 | One Android primary GL surface | Critical | Policy + slot code; device proof weak |
| I17 | Safety bool hydrate strict | Critical | Jest + mutate |
| I18 | Mayday no invented fix; MMSI rules | Critical | Jest + mutate |
| I19 | Confirm queue fail-close on crash recovery | High | Jest + mutate |
| I20 | i18n key parity 11 locales | Medium | i18n:parity PASS |
| I21 | No sweep progress on dead controller | Critical | Jest unit; device unproven |
| I22 | Map sticky visible download host only | Critical | Jest slot; device NOT_READY |
| I23 | Crash Retry drains download/confirm | High | Jest + mutate |
| I24 | Boot offline warning non-dismissible | High | Jest + mutate |
| I25 | Hydrate demotes ambient-only Ready | High | Jest hydrate |

---

## Network surface (no app auth)

| Host / path | Risk |
|-------------|------|
| tile.openstreetmap.org | Fetch failure → blank charts |
| tiles.openseamap.org | Seamark gaps |
| geoserver.openseamap.org / depth.openseamap.org WMS | SSRF mitigated by allowlist; online-only |
| overpass-api.de / overpass.kumi.systems | Seamark index |
| nextcloud.software-by-design.de legal HTML | Ops drift |

---

## Workflow map (downloads)

```
startDownload / startCustomDownload
  → Wi‑Fi + storage + tile probe
  → beginDownloadSession (exclusive)
  → resetDownloadMapSession + beginDownloadMapMapOwnership + navigate Map
  → ensureChartStyle + warmup
  → wait DownloadMapReady (DEVICE FAILS HERE)
  → runTileCacheSweep (per-tile showTile)
  → sealDurableOfflinePack
  → markReady @99% teardown → state ready @100%
```

Illegal / attacked transitions: Ready without seal; progress after generation bump; cancel inventing Ready; ambient-only Ready after hydrate.

---

## Concurrent hot spots

| Resource | Actors | Risk |
|----------|--------|------|
| downloadCoordinator session | UI cancel, sweep, seal, hydrate | Stale callbacks |
| downloadMapHost generation | Engine remount, sweep | Dead camera progress |
| offline pack index | withIndexMutation | RMW corruption |
| navigationStore + alarmCoordinator | GPS + alarms | Dual writers |
| confirmStore | Crash recovery | Stuck dialogs |

---

## API/Auth checklist (adapted)

| Check | Result |
|-------|--------|
| BOLA / multi-user | N/A |
| Broken auth / JWT | N/A |
| Mass assignment settings | Covered (prior High fixed) |
| Resource consumption | Pack size validation; tile budget mutate |
| SSRF | Depth allowlist |
| Injection | Local stores; Overpass query builder — review residual |
| Inventory / debug routes | No REST API in app |
| Session cookies | N/A |

---

## UI / a11y inventory

| Area | Gate |
|------|------|
| Contrast | `npm run a11y:contrast` PASS |
| Touch targets (sampled screens) | `npm run a11y:touch` PASS |
| Onboarding CTA below fold | Fixed sticky CTA (evening) |
| Download TextureView under overlay | Partially fixed; device still NOT_READY |

---

## Existing suite honesty

| Claim | Reality |
|-------|---------|
| “Downloads tested” | Jest mocks MapLibre/OfflineManager |
| Prior “Maestro cancel green” | Red on evening WIP APK |
| Coverage ~64% | Real; UI/native gap |
| mutate:core 22/22 | Real; does not cover sticky GL paint |

---

## Severity-tagged work queue

1. **Critical:** Fix `DOWNLOAD_MAP_NOT_READY` on emulator; Maestro cancel green.  
2. **High:** Native/E2E seal proof; restore Maestro kill.  
3. **Medium:** Cancel UX during Map auto-navigate.  
4. **Low:** Coverage / pixel asserts / legal ops.
