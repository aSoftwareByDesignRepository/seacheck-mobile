# SeaCheck QA Findings — Momos Audit (Aristoteles closure)

**Product:** SeaCheck Mobile (`seacheck-mobile` **0.1.5**, package `de.softwarebydesign.seacheck`)  
**Audit date:** 2026-09-06 (Momos evening re-attack) · **Closure:** 2026-09-07 (Aristoteles) · **Residual re-proof:** 2026-09-07 late morning  
**Auditor:** Momos (hostile QA) → Aristoteles (fix + re-proof)  
**Environment:** Native Node/Jest on host — **no** Docker Compose for SeaCheck; Android emulator `SeaCheck_Maestro_API_33` (`emulator-5588`, swiftshader) for device proof  
**Scope:** `nextcloud-dev/mobile/seacheck` only

Companion files: `risk-coverage-inventory.md`, `test-execution-log.md`.

---

## Executive Summary

**Download start, cancel, kill-mid, and durable Ready seal are proven on a real release APK** (including post-residual hardening). The OfflineManager seal stall (Android rejecting `file://` / `asset://` style URLs via the HTTP stack) is fixed with a loopback chart-style HTTP server + cleartext allowlist for `127.0.0.1`. Residual high findings (recreate GL style URI mixup, missing style-server health-check, coordinator starts during teardown, completing chrome looking “done”) are closed.

| Severity | Open now | Notes |
|----------|----------|-------|
| Critical | **0** | Exclusive GL + kickoff + OfflineManager style fetch fixed |
| High | **0** | I5 durable Ready proven; recreate primes documents `file://`; style health-check before createPack |
| Medium | **1** | Map auto-nav during download remains intentional |
| Low | **1** | App-wide line coverage ~65%; core safety mutants 23/23 |

**Proof (Aristoteles residual re-proof 2026-09-07):** Jest **160 / 745** EXIT 0 · mutate:core **23/23 killed** · tsc 0 · i18n **908×11** · a11y contrast+touch PASS (incl. completing primary wash) · Maestro multi-ABI release APK on `emulator-5588`: `02a` cancel **EXIT 0**, `03a` kill-mid **EXIT 0**, `04` seal Ready **EXIT 0** (`downloads.pack.kiel-bay.durable` + Ready + Delete).

---

## Step 0 — What this app is for (code-derived)

**Purpose:** Offline-first coastal navigation companion — OSM base + OpenSeaMap seamarks, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter / ECDIS. **No** Nextcloud login.

**Invariants under attack (selected):**

1. **I5** Ready only after durable OfflineManager seal (not ambient LRU).  
2. **I16/I21/I22** One Android GL surface; Map tab sticky visible host; no progress on dead camera.  
3. **I3** At most one exclusive download session.  
4. **I4** Wi‑Fi gate: NetInfo throw → confirm (not silent allow).  
5. **I9** Depth WMS online-only + allowlisted hosts.

---

## Critical — CLOSED

### [CRITICAL] Exclusive download MapLibre host never becomes ready (`DOWNLOAD_MAP_NOT_READY`) — FIXED

**Fixes:** coordinator epoch subscribe; DownloadMapEngine cleanup no longer invalidates generation; early `tryBegin` + skip duplicate Wi‑Fi when preflight held; preflight warmup `requireStyleLoaded: false`; Maestro waits for `confirm.proceed`.

**Proof:** Maestro `02a` / `03a` / `04` on release APK.

### [CRITICAL] OfflineManager seal stalls at 0% (`Unable to parse resourceUrl`) — FIXED

**What was wrong:** Android OfflineManager feeds `mapStyle` through the HTTP stack. Both `file://` (documents) and `asset://` (APK assets) are rejected → pack never enumerates tiles → stall after initializing timeout → false “stopped making progress”.

**Fix:** `ChartStyleLocalServer` serves bundled `assets/map/chart-style.json` on `http://127.0.0.1:18765/chart-style.json`; `offlinePackMapStyleUri()` uses that URL on Android for `createPack` / recreate; network-security-config allows cleartext **only** for localhost. MapView still uses documents `file://`. **Residual:** `ensureOfflinePackStyleReachable()` fail-fast health-check before createPack; `recreateOfflinePack(..., engineStyleUri)` primes GL with documents URI while createPack keeps loopback HTTP.

**Proof:** Maestro `04-download-seal-ready` EXIT 0 — `downloads.pack.kiel-bay.durable` + Ready banner + Delete (re-proven after residual).

---

## High — CLOSED

### [HIGH] Jest OfflineManager mock cannot prove tile honesty — CLOSED for device gate

Unit/mutation gates remain necessary but insufficient alone. **I5 device proof:** Maestro `04` durable Ready on release APK (see log). Jest still documents mock limits in the durable suite header.

### [HIGH] Maestro cancel / kill honesty — FIXED

- `02a-download-cancel-minimal` EXIT 0 — cancel via `downloads.globalSessionChrome.cancel`, no Ready.  
- `03a-download-kill-mid-release` EXIT 0 — kill mid-flight, relaunch, no Ready / no durable lie (Downloads under More; exclusive Map chrome may resume native pack).

---

## Medium

### [MEDIUM] Auto-navigation to Map during download

**Status:** Accepted by design for Android TextureView. Cancel remains on Map session chrome + global top chrome.

### [MEDIUM] Maestro OR-`notVisible` gap

**Status:** Fixed in `04` — wait specifically for `map.downloadSession` visible then notVisible (never OR with Downloads chrome).

---

## Low

- Line coverage ~65% app-wide — not “100% meaningful” everywhere; **mutate:core 23/23**.  
- Hosted legal redeploy ops out of app scope.

---

## Red-team notes (Aristoteles)

| Break mode | Mitigation |
|------------|------------|
| `tryBegin` before exclusive React subscribe → blank GL | Coordinator epoch + immediate store sync |
| Effect cleanup invalidate → stale generation marks | Removed cleanup invalidate |
| Second Wi‑Fi confirm after kickoff | Skip wifi re-assert when preflight held |
| Maestro `notVisible A\|B` passes in Downloads→Map gap | Wait on `map.downloadSession` only |
| OfflineManager `file://`/`asset://` style → 0% seal | Loopback HTTP style server + localhost cleartext allowlist |
| Recreate primes GL with loopback HTTP (engine keyed to file://) | `engineStyleUri` = documents URI; createPack keeps HTTP |
| Style server bind failure → silent 0% stall | `ensureOfflinePackStyleReachable` before createPack |
| `tryBegin` during GL teardown → dual TextureView | Coordinator blocks while `teardownRegionId` set |
| Completing chrome success-green before Ready | Primary wash + “completing” copy until teardown clears |
| Downloads not on primary tab after kill | Navigate via More / `map.downloadSession.openDownloads` |

---

## Ship call

**Yes for download honesty on the Map-hosted exclusive path**, including durable Ready seal on emulator release APK, given the executed Jest / mutate / Maestro proof above (residual re-proof included). Physical phone TextureView/OEM quirks remain recommended smoke before store push — not a blocker for the honesty invariants proven here.

**APKs:**  
- Phone sideload (arm64): `~/Downloads/apk-releases/seacheck-0.1.5-release.apk`  
- Emulator multi-ABI: `~/Downloads/apk-releases/seacheck-0.1.5-release-arm64-x86_64.apk`
