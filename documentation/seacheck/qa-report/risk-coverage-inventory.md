# SeaCheck — Risk & Coverage Inventory (Momos 2026-09-06)

**App:** `nextcloud-dev/mobile/seacheck` (SeaCheck Mobile **v0.1.5**)  
**Environment:** Native Node/Jest (no `docker-compose.yml` for this app). Maestro on `emulator-5562`, Metro `:8092`.  
**Auditor:** Momos  
**Code is source of truth** — docs below match code verified this date.

## Purpose (verified against code)

Offline-first maritime navigation companion: OpenStreetMap base + OpenSeaMap seamarks, optional online depth WMS, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** ECDIS. **No server accounts** — device-local SQLite + AsyncStorage only.

## Actors & stakes

| Actor | Stakes if wrong |
|-------|-----------------|
| Skipper underway | Blank “ready” charts, false/missed anchor alarm, wrong follow/keep-awake, MOB delay |
| Dockside prep | Downloads hang / burn cellular / lie Ready / corrupt packs |
| Auditor / store review | License/privacy/attribution mismatches, missing i18n on safety dialogs |

## Auth / API surface

| Kind | Reality |
|------|---------|
| Multi-user auth | **None** |
| App HTTP APIs | **None** |
| Deep link handlers | `scheme: seacheck` in config; **no** `Linking` handlers in `src/` |
| External HTTPS | `tile.openstreetmap.org`, `tiles.openseamap.org`, depth WMS hosts (allowlisted), Overpass mirrors, publisher legal HTTPS |
| Local integrity | AsyncStorage + SQLite; `patchSettings` boolean-coerced (enums still `??`) |

OWASP API BOLA/IDOR: **N/A**. Residual = local integrity, download honesty, alarm fail-closed.

## Invariants (I1–I20)

| ID | Invariant | Coverage |
|----|-----------|----------|
| I1 | Not ECDIS | Product copy / legal |
| I2 | Offline packs usable when Ready | Unit + Maestro |
| I3 | One exclusive download session | Unit + mutation |
| I4 | Wi‑Fi-only: store gate; NetInfo **throw → cellular confirm** (not silent allow); cancel denies | Unit + mutation |
| I5 | Ready only after durable OfflineManager seal | Unit + Maestro |
| I6 | Cancel mid-seal must not invent Ready | Unit + Maestro cancel |
| I7 | Kill mid-download: resume or fail honestly | Maestro kill |
| I8 | Pack index mutations serialized; stale tokens ignored | Unit + mutation |
| I9 | Depth: opt-in, confirm, online, allowlisted hosts | Unit |
| I10 | Anchor drag needs trusted accuracy / no first-fix-after-gap | Unit + mutation |
| I11 | MOB reachable under screen lock | Coordinator tests (sparse E2E) |
| I12 | Chart style IDs match basemap; migration invalidates | Unit |
| I13 | At most one active passage | Partial |
| I14 | Tile User-Agent before first map paint | Unit / App module load |
| I15 | Tile probe: 200/206 + non-placeholder | Unit + mutation-adjacent |
| I16 | One primary Android MapLibre GL surface | Policy + layout tests |
| I17 | Safety booleans hydrate strictly (incl. **followMode**) | Unit + mutation **this pass** |
| I18 | Mayday: no invented fresh fix; MMSI 9 digits; newline sanitize at build | Unit + mutation |
| I19 | Confirm queue fail-closes on unmount / lock | Unit |
| I20 | Static i18n keys in all 11 locales | `i18n:parity` |

## Workflow inventory (severity)

| Workflow | Critical risks | Coverage status |
|----------|----------------|-----------------|
| Downloads / offline packs | Lock, Wi‑Fi confirm-on-throw, NetInfo **timeout**, probe, durable seal, cancel/seal | Strong unit + **20** mutations + Maestro cancel/kill **OK this pass** |
| Settings / nav hydrate | Boolean honesty, anchor alarm revive, mass patch | **Fixed + tests this pass** |
| Chart tiles / basemap | UA, placeholder bytes | Unit |
| Android GL exclusivity | Dual Map blank raster | Policy + schematic hosts |
| Depth overlay | Confirm, allowlist, online gate | Unit; native pixels gap |
| Overpass | Offline skip | NetInfo timeout fail-closed |
| Confirm queue | Unmount / lock cancel | Unit |
| BootGate | Offline warning non-dismissible + Reload charts | **Fixed** this closure |
| ErrorBoundary Retry | recoverAfterRenderCrash | **Fixed** this closure |
| i18n | Missing keys | 902 × 11 PASS |
| Anchor / alarms | Accuracy + hydrate integrity | Unit + mutation |
| Map / MOB | Lock vs MOB | Sparse UI |
| Passage / tracks | Active flags; allowRouteEdits hydrate | Partial + hydrate fix |

## Shared-state / concurrency candidates

- `downloadCoordinator` + GL teardown  
- `offlinePackStore` `withIndexMutation` vs hydrate  
- `seamarkIndexQueue` serial drain  
- FG alarm pipeline vs background track  
- Dual writers on `seacheck.navigation.v1`  
- Map focus vs embed claim vs deferred offline host  
- `confirmStore` queue on host unmount  

## External dependency failure modes

| Dependency | Failure mode (code behavior) |
|------------|------------------------------|
| tile.openstreetmap.org | Timeout/5xx/placeholder → download blocked |
| tiles.openseamap.org/seamark | Seamark-specific; empty PNG OK in open water |
| Depth WMS | Soft blank when gate closed / error |
| Overpass | Soft-fail after retries; skip when offline |
| NetInfo | Download: **4s timeout → offline**; Wi‑Fi policy throw → **confirm**; depth/online overlays fail-closed on unknown |
| MapLibre ambient cache | Not a Ready seal |

## API / Auth checklist (adapted — no server API)

| OWASP-style item | Verdict |
|------------------|---------|
| BOLA/IDOR | N/A (no objects over network) |
| Broken auth | N/A (device-local) |
| Property-level auth | Local: `patchSettings` boolean coerce; enums still soft |
| Resource consumption | Tile budget mutation; download exclusivity |
| Function-level auth | N/A |
| Business flow abuse | Download spam blocked by coordinator |
| SSRF | Depth hosts allowlisted; no user URL fetch |
| Misconfig | Production variant excludes expo-dev-client plugin |
| Injection | Mayday sanitize; Overpass numeric; SQLite parameterized |
| Inventory | Routes = local screens only; scheme unused |
| Session/CSRF | N/A |
| Schema validation | Persist sanitize helpers; residual enum looseness |

## Existing suite (executed 2026-09-06)

| Gate | Number |
|------|--------|
| Jest | **155** suites / **717** tests EXIT 0 |
| Skipped | **0** |
| mutate:core | **22/22** killed |
| Coverage | statements 61.69% / branches 54.89% / lines 64.44% |
| a11y contrast + touch | PASS |
| i18n | 902 × 11 PASS |
| Maestro cancel + kill | OK on emulator-5562 |
