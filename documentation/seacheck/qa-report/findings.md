# SeaCheck QA Findings — Momos Audit

**Product:** SeaCheck Mobile (`seacheck-mobile` 0.1.3)  
**Audit date:** 2026-09-04 (UTC) — Momos pass (basemap / GL / i18n / tile probe honesty)  
**Auditor:** Momos (hostile QA / red-team)  
**Environment:** Native Jest on developer host — **no** Docker Compose for this app  
**Scope:** `nextcloud-dev/mobile/seacheck` only (standalone Expo client; no multi-user API)

---

## Executive Summary

**Fit for a store / functional auditor today: yes — with residual Low gaps below.**  
**Fit for ECDIS / SOLAS / “certified plotter” claims: no** — product truth, not a bug.

This pass did **not** dig up a Critical BOLA or auth hole (there is still **no** multi-user auth surface). It **did** find and kill honesty bugs that would have embarrassed you in front of a mean auditor:

| Severity | Open after this engagement | Fixed this engagement |
|----------|----------------------------|------------------------|
| Critical | **0** | — |
| High | **0** | OSM User-Agent registered only after first paint; tile probe treated HTTP **416** as success (seamark fail-open) |
| Medium | **0** | Stale CARTO claims in published terms HTML; `common.cancel` missing from all locales |
| Low | Native MapLibre framebuffer pixels not Maestro-covered; overall line coverage ~64% (UI-heavy); multi-emulator adb fleet still needs serial isolation | GL policy + schematic download previews; i18n static-key contract |

**Proof (executed this pass):** Jest **144 suites / 689 tests** EXIT 0; typecheck EXIT 0; i18n **899 × 11** PASS; a11y contrast + touch PASS; mutate:core **16/16 killed**; coverage statements **61.38%** / lines **64.11%** (honest, not gamed). Raw output: `test-execution-log.md`.

---

## Step 0 — What this app is for (code-derived)

**Purpose:** Offline-first coastal navigation companion — OSM base + OpenSeaMap seamarks, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter.

**Actors & stakes:**

| Actor | If wrong… |
|-------|-----------|
| Skipper underway | Blank “ready” charts, missed anchor drag, delayed MOB, unofficial depths trusted as truth |
| Dockside prep | Downloads burn cellular / lie Ready / wipe packs without notice |
| Store / privacy auditor | Attribution lies, privacy hosts wrong, missing translation keys in confirm dialogs |

**Invariants attacked this pass (subset of full inventory):**

1. Chart tiles that reach MapLibre must identify SeaCheck (OSM User-Agent) **before** the first map paint.  
2. Download preflight must not green-light tile CDNs on empty / Range-failure responses.  
3. At most one exclusive Android MapLibre GL owner (nav / download / embed / offline host).  
4. Every static `t('…')` key exists in all 11 locales; confirm cancel uses a real string.  
5. Public legal HTML must not attribute map data to providers the app no longer uses.

---

## Critical

*None open. No multi-user API → OWASP BOLA/IDOR N/A for this package.*

---

## High

### [HIGH] [FIXED] OSM User-Agent registered only inside `useEffect` — cold-start tile race

**What is wrong (in plain words):**  
The app told OpenStreetMap who it is only *after* React finished the first paint. MapLibre can request tiles in that first frame with a generic OkHttp User-Agent. OSM then returns a solid `#aad3df` placeholder that looks exactly like “map broken.”

**Where exactly:**  
- File: `App.tsx` (was only `useEffect(() => configureChartTileHttp(), [])`)  
- File: `src/lib/map/configureChartTileHttp.ts`  
- Workflow: cold launch → Map tab → raster base tiles  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
# Contract before fix: configureChartTileHttp only inside useEffect
grep -n 'configureChartTileHttp' App.tsx
# Observed: call only inside useEffect — first paint can fetch without UA
```
Adversarial device observation (prior session): blank ocean background until reload after UA landed.

**What should happen instead:**  
`configureChartTileHttp()` must run at module load **before** `RootNavigator` mounts any Map.

**Why this matters:**  
A skipper who trusts “charts are online” gets a blank blue chart. That is a navigation honesty failure, not a cosmetic flake.

**Exact fix instructions:**  
1. Open `App.tsx`.  
2. Call `configureChartTileHttp()` at module scope (before `export default function App`).  
3. Keep the idempotent call inside `useEffect` as a safety net.  
4. Run `__tests__/configureChartTileHttp.test.ts` › `App tile User-Agent boot contract`.

**Proof this is fixed:**  
- `__tests__/configureChartTileHttp.test.ts` › registers configureChartTileHttp at module scope before export default  
- Red contract before (no module-scope call) → green after (2026-09-04 log)

---

### [HIGH] [FIXED] Tile probe treated HTTP 416 as “tiles work” (seamark fail-open)

**What is wrong (in plain words):**  
The download preflight accepted HTTP **416 Range Not Satisfiable** as success. For seamark tiles it did not even read the body. A CDN that hates `Range` headers (or returns empty 416s) could green-light a download that then fails or packs empty overlays.

**Where exactly:**  
- File: `src/lib/network/chartTileReachability.ts` — `isProbeResponseOk`  
- Workflow: Downloads → Start pack → preflight probe  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
npx jest __tests__/chartTileReachability.test.ts -t '416 on seamark' --ci
# Before fix: Received promise resolved instead of rejected
```

**What should happen instead:**  
Only **200** and **206** count as reachable. 416 is a hard failure for that URL.

**Why this matters:**  
Preflight is the last honesty gate before burning Wi‑Fi time and lying about “charts available.” Fail-open here is inexcusable.

**Exact fix instructions:**  
1. In `isProbeResponseOk`, return `status === 200 || status === 206` only.  
2. Keep placeholder-byte rejection for base tiles.  
3. Re-run the 416 tests — must reject.

**Proof this is fixed:**  
- `__tests__/chartTileReachability.test.ts` › rejects HTTP 416…  
- `__tests__/chartTileReachability.test.ts` › rejects 416 on seamark…  
- Red → green 2026-09-04

---

## Medium

### [MEDIUM] [FIXED] Published terms HTML still credited CARTO after basemap migration

**What is wrong (in plain words):**  
In-app attribution and markdown terms correctly say OpenStreetMap + OpenSeaMap. The **HTML** terms pages users open from Settings still said map data comes from CARTO and linked `carto.com/attributions`.

**Where exactly:**  
- `docs/play-store/publish/en/terms-seacheck-mobile.html`  
- `docs/play-store/publish/de/nutzungsbedingungen-seacheck-mobile.html`  
- Code truth: `src/lib/settings/chartBaseStyle.ts` → `tile.openstreetmap.org` + `tiles.openseamap.org/seamark`

**How to reproduce it:**  
```bash
grep -n CARTO docs/play-store/publish/en/terms-seacheck-mobile.html
# Before: lines claiming CARTO volunteers + carto.com link
```

**What should happen instead:**  
Legal HTML matches the live basemap providers.

**Why this matters:**  
Store / privacy auditors compare Settings → Terms to the network hosts. A dead provider in the terms is a documentation lie.

**Exact fix instructions:**  
Remove CARTO from the notice paragraph and attribution list in EN + DE HTML (done this pass). Re-deploy publish copies if the hosted Nextcloud pages mirror these files.

**Proof this is fixed:**  
```bash
grep -R CARTO docs/play-store/publish/*/terms*.html docs/play-store/publish/*/nutzungsbedingungen*.html || echo 'clean'
```

---

### [MEDIUM] [FIXED] Missing `common.cancel` in all 11 locales

**What is wrong (in plain words):**  
Depth-overlay confirm used `t('common.cancel')` but catalogs only had `common.dismiss`. Users saw a raw key / missing translation on a safety dialog.

**Where exactly:**  
- `src/lib/settings/depthOverlayEnableConfirm.ts`  
- `src/i18n/locales/*.json` `common` block  

**How to reproduce it:**  
```bash
node -e "const e=require('./src/i18n/locales/en.json'); console.log(e.common.cancel)"
# Before: undefined
```

**What should happen instead:**  
`common.cancel` present and non-empty in every supported locale.

**Exact fix instructions:**  
Add `cancel` next to `dismiss` in all 11 locale files (done). Extend `localeParity.test.ts` to scan static `t('…')` keys against English (done).

**Proof this is fixed:**  
- `src/i18n/__tests__/localeParity.test.ts` › provides common.cancel…  
- › includes every static t("…") key…  
- `npm run i18n:parity` → 899 keys × 11 locales PASS

---

## Low / residual gaps

| Gap | Why still open | Severity |
|-----|----------------|----------|
| Native MapLibre framebuffer / WMS pixels not asserted in Maestro | Needs device framebuffer capture tooling | Low |
| Jest line coverage ~64% | UI shells dominate uncovered lines; core safety mutants all killed | Low (not Critical) |
| Rapid Map↔Downloads tab switch can flash ocean placeholder while GL yields | By design for Android single-GL; schematic fallback covers pack preview | Low |
| Hosted Nextcloud terms URLs may lag local `docs/play-store/publish/*` until redeploy | Ops follow-up | Low |
| No multi-emulator isolation in human adb sessions | Documented; Maestro runner isolates | Low |

---

## Auth / API checklist (mandatory)

| OWASP-style item | Result |
|------------------|--------|
| BOLA / IDOR | **N/A** — no user accounts / object APIs |
| Broken authentication | **N/A** — device-local app |
| Mass assignment / property auth | **N/A** |
| Resource consumption | Tile budget + pack size gates unit-tested; no remote API pagination |
| Function-level auth | **N/A** |
| Business-flow abuse | Download coordinator single-flight + Wi‑Fi gate covered |
| SSRF | No user-controlled fetch URLs; depth WMS allowlisted; Overpass hosts fixed |
| Security misconfiguration | Dev client only; no production debug API in app |
| Injection | SQLite parameterized; Overpass QL uses numeric lat/lon interpolation only |
| Inventory / stale endpoints | No app HTTP server |
| Session / JWT | **N/A** |
| Schema validation | Local stores + confirm gates |

Residual sensitive surface: vessel MMSI / Mayday clipboard / Overpass lat-lon privacy (documented; NetInfo timeout fail-closed for skip gate — prior pass).

---

## Documentation-vs-code mismatches

| Doc | Code | Status |
|-----|------|--------|
| QA `risk-coverage-inventory.md` still listed `t1/t2.openseamap.org` basemap | `chartBaseStyle.ts` → `tile.openstreetmap.org` | **Updated this pass** |
| HTML terms CARTO | OSM + OpenSeaMap only | **Fixed this pass** |
| Markdown terms / privacy | Already OSM-correct | OK |
| In-app `MAP_ATTRIBUTION` | OSM + OpenSeaMap | OK |

---

## Test suite quality

- Skipped / `.todo` / `expect(true)` tautologies: **none found**  
- Mutation (`npm run mutate:core`): **16/16 killed**  
- New adversarial tests this pass: 416 probe rejection, App UA boot contract, i18n static-key scan, `common.cancel` presence  
- Coverage (honest): statements 61.38%, branches 54.63%, lines 64.11% — UI-heavy residual, not “100% by stubbing”

---

## Open Questions

1. **Production upload pending (operator):** Local PHP templates + Play mirrors are fixed and packed at `/tmp/seacheck-legal-deploy/seacheck-legal-deploy.tar.gz` via `website/scripts/pack_seacheck_legal_deploy.sh`. Live `nextcloud.software-by-design.de` still served CARTO as of 2026-09-04 until FTP/SFTP upload + deletion of stale `*.html` twins. Verify with the curl gates printed by the pack script.  
2. Should OSM tile usage volume / caching policy get a written ops budget before marketing pushes mass downloads?  
3. Is Maestro on `SeaCheck_Maestro_API_33` still the required gate for download cancel/kill before any Play upload of this tip?

---

## Verdict for the mean auditor

Ship the functional/store story **after** confirming hosted terms match the fixed HTML. Do **not** claim certified navigation. Do **not** claim “perfect coverage” — claim **16/16 core mutants dead** and **689 passing honesty tests**, which is what actually matters for this product’s stakes.
