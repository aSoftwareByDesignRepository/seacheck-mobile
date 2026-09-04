# SeaCheck — Risk & Coverage Inventory (Momos 2026-09-04)

**App:** `nextcloud-dev/mobile/seacheck` (SeaCheck Mobile v0.1.3)  
**Environment:** Native Node/Jest (no `docker-compose.yml` for this app)  
**Auditor:** Momos

## Purpose (verified against code)

Offline-first maritime navigation companion: OpenStreetMap base tiles + OpenSeaMap seamarks, optional online GEBCO/track depth WMS, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter. **No server accounts** — device-local SQLite + AsyncStorage only.

## Actors & stakes

| Actor | Stakes if wrong |
|-------|-----------------|
| Skipper underway | Blank “ready” charts, unofficial depths trusted, missed anchor drag, false XTE, MOB delay |
| Dockside prep | Downloads burn cellular / fail silently / corrupt packs / probe fail-open |
| Auditor / store review | License/privacy/attribution mismatches, missing i18n on safety dialogs |

## Auth / API surface

| Kind | Reality |
|------|---------|
| Multi-user auth | **None** |
| App HTTP APIs | **None** |
| External HTTPS | `tile.openstreetmap.org`, `tiles.openseamap.org` (seamark), `geoserver.openseamap.org` / `depth.openseamap.org` (WMS), Overpass mirrors, publisher legal HTTPS |
| Secrets in app | None for maps; Android keystore is build-time only |

OWASP API BOLA/IDOR: **N/A**. Residual: local integrity, download honesty, alarm fail-closed, third-party HTTPS, OSM User-Agent policy.

## Critical invariants (code-derived)

1. At most **one** chart download exclusive session (`downloadCoordinator`).  
2. Wi‑Fi-only setting enforced in store + hydrate reattach, fail-closed when NetInfo unknown/throws.  
3. Ready requires durable OfflineManager pack (sweep alone is not Ready).  
4. Cancel must not resurrect a seal-in-progress pack as Ready.  
5. Kill mid-sweep / mid-seal must resume or fail honestly.  
6. Depth overlay: opt-in, confirm-on-enable, online-only, never in pack style.  
7. Offline pack index mutations serialized; stale native callbacks ignored via session tokens.  
8. Anchor drag must not fire on untrusted accuracy / first fix after GPS gap.  
9. MOB remains reachable under screen lock.  
10. Chart style on disk matches live basemap IDs; basemap migration invalidates old caches.  
11. At most one active passage; activate clears others.  
12. **MapLibre tile User-Agent registered before first map paint** (OSM policy).  
13. **Tile reachability probe accepts only HTTP 200/206 with non-placeholder base bodies.**  
14. Android: at most one primary MapLibre GL surface (nav / download / embed / offline host).  
15. Every static `t('…')` key exists in all 11 locales.

## Workflow inventory (severity)

| Workflow | Critical risks | Coverage status |
|----------|----------------|-----------------|
| Downloads / offline packs | Lock, Wi‑Fi, probe (416/placeholder), migration, durable seal, cancel/seal race | Strong unit + mutation + Maestro cancel/kill (prior) |
| Chart tiles / basemap | Wrong URL (empty OpenSeaMap `/tile/`), missing UA, placeholder bytes | Unit + live probe history; UA boot contract **this pass** |
| Android GL exclusivity | Dual Map → blank raster; download preview vs nav | `chartMapGlPolicy` + schematic custom preview **this pass** |
| Depth overlay | Confirm, allowlist, online gate | Unit + live HTTP probe; native pixels gap |
| Settings hydrate | Boolean honesty | Covered |
| Overpass / seamarks | Offline skip, lat/lon privacy | NetInfo timeout fail-closed |
| Confirm queue | Unmount cancel | Visible dialog fail-closes |
| i18n | Missing keys on safety UI | Parity + static scan **this pass** |
| Legal / attribution | Stale CARTO in HTML terms | Fixed **this pass**; hosted redeploy open Q |
| Anchor / alarms | Accuracy fail-open | Strong unit + mutation |
| Map / MOB | Lock vs MOB | Sparse UI tests |
| Passage / tracks | Active flags | Partial |

## Shared-state / concurrency candidates

- `downloadCoordinator` + GL teardown window  
- `offlinePackStore` `withIndexMutation` vs hydrate  
- `seamarkIndexQueue` serial drain  
- FG alarm pipeline vs `trackBackgroundTask`  
- Dual writers on `seacheck.navigation.v1`  
- Map focus vs embed claim vs deferred offline host (1-frame yield by design)  
- `confirmStore` queue if host unmounts mid-dialog  

## External dependency failure modes

| Dependency | Failure mode |
|------------|--------------|
| tile.openstreetmap.org | Timeout/5xx/placeholder UA → download blocked; blank chart if UA missing |
| tiles.openseamap.org/seamark | Seamark-specific errors; empty overlay PNG OK in water with no marks |
| geoserver / depth WMS | Soft blank overlay when online gate open |
| Overpass | Soft-fail lookup / index drop after retries |
| MapLibre ambient cache | Recently viewed only — Ready sealed via OfflineManager |
| NetInfo | Wi‑Fi policy confirm on throw; depth fail-closed until sample |

## Existing suite (this audit tip)

- **Full Jest:** 144 suites / 689 tests green  
- Skipped tests: **none**  
- Mutation (`npm run mutate:core`): 16/16 killed  
- a11y contrast + touch: PASS  
- i18n parity: 899 × 11 PASS  
- Coverage (honest): statements 61.38% / branches 54.63% / lines 64.11%  
