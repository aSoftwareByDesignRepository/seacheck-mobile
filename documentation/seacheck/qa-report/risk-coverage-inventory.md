# SeaCheck — Risk & Coverage Inventory (Momos re-audit)

**App:** `nextcloud-dev/mobile/seacheck` (SeaCheck Mobile v0.1.3)  
**Date:** 2026-08-30  
**Environment:** Native Node/Jest (no `docker-compose.yml` for this app)  
**Auditor persona:** Momos (hostile QA)

## Purpose (verified against code)

Offline-first maritime navigation companion: OpenSeaMap charts + seamarks, optional online GEBCO/track depth WMS, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter. **No server accounts** — device-local SQLite + AsyncStorage only.

## Actors & stakes

| Actor | Stakes if wrong |
|-------|-----------------|
| Skipper underway | Blank “ready” charts, unofficial depths trusted, missed anchor drag, false XTE, MOB delay |
| Dockside prep | Downloads burn cellular / fail silently / corrupt packs |
| Auditor / store review | License/privacy mismatches, attribution lies |

## Auth / API surface

| Kind | Reality |
|------|---------|
| Multi-user auth | **None** |
| App HTTP APIs | **None** |
| External HTTPS | `t1`/`t2.openseamap.org`, `tiles.openseamap.org`, `geoserver.openseamap.org` (GEBCO GWC), `depth.openseamap.org`, Overpass mirrors, publisher legal HTTPS |
| Secrets in app | None for maps; Android keystore is build-time only |

OWASP API BOLA/IDOR: **N/A**. Residual: local integrity, download honesty, alarm fail-closed, third-party HTTPS.

## Critical invariants (code-derived)

1. At most **one** chart download exclusive session (`downloadCoordinator`).
2. Wi‑Fi-only setting must not silently allow metered downloads when connectivity is unknown, offline, or NetInfo throws — and hydrate must not accept non-boolean falsy values as “off”.
3. Ready requires durable `OfflineManager` pack (sweep alone is not Ready); ambient-only demoted.
4. Cancel must not resurrect a seal-in-progress pack as Ready.
5. Kill mid-sweep / mid-seal / sweep-complete-pre-seal must resume or fail honestly — not lie Ready.
6. Depth overlay: opt-in, confirm-on-enable, online-only, never in pack style, fail-closed until NetInfo connected.
7. Offline pack index mutations serialized; stale native callbacks ignored via session tokens.
8. Anchor drag must not fire on untrusted accuracy / first fix after GPS gap.
9. MOB remains reachable under screen lock.
10. Chart style on disk matches live basemap IDs; basemap migration invalidates old caches.
11. At most one active passage; activate clears others.

## Workflow inventory (severity)

| Workflow | Critical risks | Coverage status |
|----------|----------------|-----------------|
| Downloads / offline packs | Lock, Wi‑Fi policy, probe, migration, durable seal, cancel/seal race, sweep→seal resume | Strong unit + mutation + process-death sims; **gap:** device Maestro |
| Depth overlay | Confirm, allowlist, online gate, pack exclusion | Unit + live HTTP probe; **gap:** native WMS render E2E |
| Basemap migration | Wipe without notice | Unit covered |
| Anchor / alarms | Accuracy fail-open (display), limited mode | Strong unit + mutation; **limited chrome persisted** (`armedLimited` + non-dismissible banner) |
| Map / MOB | Lock vs MOB | Sparse UI tests |
| Passage | Active flag, download-all toast honesty | Partial; download-all counting fixed |
| Tracks | Single open recording | Partial |
| Seamarks | Overpass failover, 25k cap, lat/lon privacy | Partial |
| Settings / onboarding | Boolean hydrate honesty | Covered for Wi‑Fi + depth |

## Shared-state / concurrency candidates

- `downloadCoordinator` + GL teardown window  
- `offlinePackStore` `withIndexMutation` vs hydrate (single in-flight hydrate mutex)  
- `seamarkIndexQueue` serial drain  
- FG alarm pipeline vs `trackBackgroundTask`  
- Dual writers on `seacheck.navigation.v1`  
- `confirmStore` queue if host unmounts mid-dialog — ConfirmSheet unmount fail-closes waiting promises  

## External dependency failure modes

| Dependency | Failure |
|------------|---------|
| t1/t2.openseamap.org | Timeout/5xx → download blocked (probe falls back once) |
| tiles.openseamap.org/seamark | Seamark-specific errors |
| geoserver / depth WMS | Soft blank overlay when online gate open; no tile-error UX |
| Overpass | Soft-fail lookup / index drop after retries |
| MapLibre ambient cache | Recently viewed only — Ready sealed via OfflineManager |
| NetInfo | Wi‑Fi policy confirm on throw (**fixed**); depth fail-closed until sample (**fixed**) |

## Existing suite (this audit)

- **Full Jest:** 129 suites / 618 tests green  
- Skipped tests: **none**  
- Mutation (`npm run mutate:core`): 16/16 killed  
- a11y contrast + touch: PASS  
- i18n parity: 898 × 11 PASS  
