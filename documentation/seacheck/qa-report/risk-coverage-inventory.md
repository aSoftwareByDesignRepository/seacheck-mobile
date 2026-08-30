# SeaCheck — Risk & Coverage Inventory

**App:** `nextcloud-dev/mobile/seacheck` (SeaCheck Mobile v0.1.3)  
**Date:** 2026-08-30  
**Environment:** Native Node/Jest (no `docker-compose.yml` for this app)  
**Auditor persona:** Momos (hostile QA)

## Purpose (verified against code)

Offline-first maritime navigation companion: OpenSeaMap charts + seamarks, GPS instruments, passage planning, tracks, anchor watch / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter. **No server accounts** — device-local SQLite + AsyncStorage only.

## Actors & stakes

| Actor | Stakes if wrong |
|-------|-----------------|
| Skipper underway | Blank “ready” charts, missed anchor drag, false XTE, MOB delay |
| Dockside prep | Downloads burn cellular / fail silently / corrupt packs |
| Auditor / store review | License/privacy mismatches, attribution lies |

## Auth / API surface

| Kind | Reality |
|------|---------|
| Multi-user auth | **None** — no login, JWT, sessions, or tenancy |
| App HTTP APIs | **None** — no SeaCheck backend |
| External HTTPS | OpenSeaMap tiles (base + seamarks), Overpass mirrors |
| Secrets in app | None for maps; Android keystore is build-time only |

OWASP API BOLA/IDOR checklist: **N/A for in-app multi-user**. Residual: SSRF via Overpass/user-driven URLs (none found), injection into SQLite (parameterized), tile CDN abuse.

## Critical invariants (code-derived)

1. At most **one** chart download exclusive session (`downloadCoordinator`).
2. Wi‑Fi-only setting must not silently allow metered downloads when connectivity is unknown or offline.
3. Offline pack index mutations are serialized; stale native callbacks ignored via session tokens.
4. Anchor drag must not fire on untrusted accuracy / first fix after GPS gap.
5. MOB remains reachable under screen lock.
6. Chart style on disk matches live basemap IDs; basemap migration invalidates old CARTO caches.
7. At most one active passage; activate clears others.

## Workflow inventory (severity)

| Workflow | Critical risks | Coverage status |
|----------|----------------|-----------------|
| Downloads / offline packs | Exclusive lock, Wi‑Fi policy, probe, migration, durable OfflineManager Ready | Strong unit + mutation + process-death hydrate sims; **gap:** live MapLibre device E2E |
| Basemap migration | Wipe packs without notice; mid-download migrate | Unit covered; mid-download not concurrent-tested |
| Anchor / alarms | Accuracy fail-open, FG/BG ownership flaps, limited mode | Strong unit + mutation; **gap:** OEM battery kill E2E |
| Map / MOB | Lock vs MOB, long-press | Sparse UI tests |
| Passage | Active flag, leg advance prompts bg vs fg | Partial |
| Tracks | Single open recording | Partial |
| Seamark index | Overpass failover, 25k cap | Partial |
| Settings / onboarding | Boot-critical hydrate | Partial |

## Shared-state / concurrency candidates

- `downloadCoordinator` + GL teardown window  
- `offlinePackStore` `withIndexMutation` vs hydrate  
- `seamarkIndexQueue` serial drain  
- FG alarm pipeline vs `trackBackgroundTask`  
- Dual writers on `seacheck.navigation.v1`

## External dependency failure modes

| Dependency | Failure |
|------------|---------|
| t1/t2.openseamap.org | Timeout/5xx → download blocked (probe now falls back once) |
| tiles.openseamap.org/seamark | Seamark-specific errors |
| Overpass | Soft-fail lookup / index drop after retries |
| MapLibre ambient cache | Recently viewed only — Ready packs sealed via OfflineManager (**fixed**) |
| NetInfo | Was fail-open on Wi‑Fi-only (**fixed**) |

## Existing suite (pre/post audit)

- **Before fixes:** 123 suites / 590 tests green  
- **After Wi‑Fi + probe fixes:** 124 suites / 597 tests green  
- **After durable Ready + kill-resume:** 125 suites / 602 tests green  
- Skipped tests: **none** found  
- Mutation (`npm run mutate:core`): see execution log
