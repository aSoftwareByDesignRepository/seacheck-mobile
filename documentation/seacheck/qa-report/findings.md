# SeaCheck QA Findings

**Product:** SeaCheck Mobile (`seacheck-mobile` 0.1.3)  
**Audit date:** 2026-08-30 (UTC)  
**Auditor:** Momos (hostile QA / red-team)  
**Environment:** Native Jest on developer host — **no** Docker Compose for this app  

---

## Executive Summary

**Not fully production-ready for a hostile external audit without caveats** — but Critical Wi‑Fi fail-open, durable Ready packs, kill-mid-download resume proofs (Jest process-death simulation), and AGPL terms alignment from this engagement are **fixed and regression-tested**. Core maritime safety + download exclusivity mutation suite killed **all** targeted mutants after the Wi‑Fi fix (see execution log).

| Severity | Count (open) | Count (fixed this engagement) |
|----------|--------------|-------------------------------|
| Critical | 0 open | 1 fixed |
| High | 0 open | 3 fixed |
| Medium | 1 open | 2 fixed (README + AGPL terms) |
| Low | 3 open | 2 fixed (docs/comments) |

**Fit for client/auditor today?**  
**Yes for functional store review** on download integrity: “Ready for offline use” now requires a durable `OfflineManager` pack (ambient sweep alone is not enough). Kill-mid-download resume is covered by Jest process-death simulations (sweep + seal). Residual gap: no Maestro/Detox on a physical/emulator farm in CI — tracked as Low/process, not High product risk.

There is **no multi-user API** — classic BOLA/IDOR does not apply. Residual security is local data integrity, download policy honesty, alarm fail-closed behavior, and legal/attribution accuracy.

Safety/offline mutation score after Wi‑Fi fixes: **16 killed / 0 survived / 16 total**.

---

## Critical

### [CRITICAL] [FIXED] Wi‑Fi-only downloads silently allowed when NetInfo throws

**What is wrong (in plain words):**  
The setting “download charts on Wi‑Fi only” was supposed to stop large downloads on mobile data unless the user said yes. If the phone’s network status check crashed, the app **quietly allowed the download anyway** — no warning dialog.

**Where exactly:**  
- File: `src/lib/network/downloadPolicy.ts` (previous `catch { return true; }`)  
- Workflow: Downloads → any pack / custom area download while `downloadWifiOnly === true`

**How to reproduce it (copy-paste steps):**  
1. Before the fix, unit reproduction:
   ```bash
   cd nextcloud-dev/mobile/seacheck
   # Temporarily restore old behavior or use git history; with the new tests:
   npm test -- --testPathPattern='downloadPolicy' --no-coverage
   ```
2. The new test `does not silently allow downloads when NetInfo throws — asks the user` **failed** against the old implementation (received `true` instead of `{ ok: false, reason: 'cancelled' }`).

**What should happen instead:**  
If connectivity type cannot be determined, the app must **ask** (same cellular confirmation) or block — never silent allow under Wi‑Fi-only.

**Why this matters:**  
Skippers enable Wi‑Fi-only to avoid blowing prepaid data / roaming. A silent bypass violates that promise and can cost real money offshore.

**Exact fix instructions:**  
1. Open `src/lib/network/downloadPolicy.ts`.  
2. Change `ensureDownloadAllowed` to return `DownloadPermission` (`{ ok: true }` | `{ ok: false, reason }`).  
3. On `NetInfo.fetch()` throw → call cellular confirm; never `return true`.  
4. Update callers in `usePackDownloadActions.ts`, `CustomDownloadSection.tsx`, `CustomDownloadMapPanel.tsx` to branch on `allowed.ok` / `allowed.reason`.  
5. Run `npm test -- --testPathPattern='downloadPolicy'`.

**Proof this is fixed:**  
- Test: `__tests__/downloadPolicy.test.ts` › `does not silently allow downloads when NetInfo throws — asks the user`  
- Red before fix, green after (logged in `test-execution-log.md`)  
- Mutation `download-wifi-netinfo-fail-open` added to `scripts/run-safety-core-mutations.cjs`

---

### [CRITICAL] [FIXED] Offline device shown cellular warning (and could “proceed”)

**What is wrong (in plain words):**  
With Wi‑Fi-only on, airplane mode / `isConnected: false` still opened the **“you are on cellular”** dialog. That is the wrong message and the wrong control flow.

**Where exactly:**  
- File: `src/lib/network/downloadPolicy.ts`  
- Callers showed `downloads.cellularCancelledBody` for any `false` return

**How to reproduce it:**  
1. Mock NetInfo `{ isConnected: false, type: 'none' }` (see unit test).  
2. Old code: fell through to `requestConfirm` cellular dialog.  
3. New test expects `{ ok: false, reason: 'offline' }` and **no** confirm call.

**What should happen instead:**  
Disconnected → block as offline with `downloads.errorOffline`, no cellular dialog.

**Why this matters:**  
Confusing safety UX; users learn to ignore dialogs. Also wasted taps before the real offline error.

**Exact fix instructions:**  
Same `DownloadPermission` change: if `state.isConnected === false` return `{ ok: false, reason: 'offline' }`; callers `showError(t('downloads.errorOffline'))`.

**Proof this is fixed:**  
- `__tests__/downloadPolicy.test.ts` › `blocks when the device reports no connection (does not show cellular dialog)`

---

## High

### [HIGH] [FIXED] Cache-backed “Ready for offline use” can lie after ambient cache eviction

**What is wrong (in plain words):**  
Downloads previously saved tiles into MapLibre’s **ambient cache** (short-term tile cache), then marked the pack **Ready**. Ambient cache has a size limit (512 MB). If the cache fills and old tiles are thrown away, the UI could still say the pack is ready while the chart is blank offline.

**Where exactly:**  
- File: `src/store/offlinePackStore.ts` — download session now sweeps then **seals** via `sealDurableOfflinePack`  
- File: `src/lib/offline/sealDurableOfflinePack.ts` — `OfflineManager.createPack`  
- File: `src/lib/offline/ambientCache.ts` — ambient cache remains for recent browsing only  

**What should happen instead:**  
Ready requires a durable OfflineManager pack whose resources are not subject to ambient LRU.

**Exact fix instructions (done):**  
1. After tile-cache sweep reaches 100%, create and wait for `OfflineManager.createPack` before Ready.  
2. Persist native pack id (clear `cacheBacked`) as soon as createPack returns so kill mid-seal can resume.  
3. On hydrate, demote legacy ambient-only Ready rows (`errorAmbientPackRetired` / redownload placeholder).  
4. Integration tests: Ready survives `clearAmbientCache`; ambient-only rows demoted.

**Proof this is fixed:**  
- `__tests__/offlinePackStore.durableDownload.test.ts` — durable Ready + ambient clear + demotion  
- `__tests__/offlinePackStore.startDownload.test.ts` — createPack required for Ready  

---

### [HIGH] [FIXED] Base tile probe failed closed when only the primary OpenSeaMap mirror was down

**What is wrong (in plain words):**  
Preflight only checked `t1.openseamap.org`. MapLibre can use `t2` as well. If `t1` was down and `t2` healthy, downloads were blocked for no good reason.

**Where exactly:**  
- File: `src/lib/network/chartTileReachability.ts`  
- Constants: `CHART_BASE_TILE_URLS` in `src/lib/settings/chartBaseStyle.ts`

**How to reproduce it:**  
```bash
npm test -- --testPathPattern='chartTileReachability' --no-coverage
```
Test: `falls back to a secondary base host when the primary is unreachable` (primary 403, secondary 200).

**What should happen instead:**  
After primary retries fail, try each fallback host once; succeed if any mirror answers.

**Why this matters:**  
False “tile server unreachable” blocks going to sea with fresh packs when a single mirror blips.

**Exact fix instructions:**  
Implemented `probeBaseTileWithFallback` in `chartTileReachability.ts`.

**Proof this is fixed:**  
- `__tests__/chartTileReachability.test.ts` › fallback test green

---

### [HIGH] [FIXED] No device E2E proof for kill-mid-download / process death resume of cache-backed sweeps

**What is wrong (in plain words):**  
Unit tests mocked MapLibre. There was no automated proof that force-stopping mid-download resumes the same region without corrupting the index.

**Where exactly:**  
- `reattachCacheDownload` / `reattachNativeDownload` in `offlinePackStore.ts`  
- `sealDurableOfflinePack` / `resumeDurableOfflinePack`

**What should happen instead:**  
Hydrate restores `downloading` and completes to durable Ready (sweep or seal phase).

**Exact fix instructions (done):**  
1. Persist sweep progress and native pack id mid-seal.  
2. On hydrate: reattach incomplete sweeps; resume incomplete native packs.  
3. Jest process-death simulations cover mid-sweep and mid-seal (no Maestro farm in this repo yet — residual CI gap only).

**Proof this is fixed:**  
- `__tests__/offlinePackStore.durableDownload.test.ts` › mid-sweep + mid-seal resume  
- `__tests__/offlinePackStore.hydrate.test.ts` › reattach seals durable pack  

---

## Medium

### [MEDIUM] [FIXED] License text conflicts with store terms (AGPL vs “proprietary”)

**What is wrong (in plain words):**  
The repo `LICENSE` and `package.json` say **AGPL-3.0-or-later**. Play Store terms markdown previously said the app software is **proprietary** © Software by Design.

**Where exactly:**  
- `LICENSE`, `package.json` `"license": "AGPL-3.0-or-later"`  
- `docs/play-store/terms-mobile-en.md` / `terms-mobile-de.md`

**What should happen instead:**  
One legal truth everywhere — AGPL with matching store disclosures.

**Exact fix instructions (done):**  
Aligned EN/DE Play Store terms §7 to AGPL-3.0-or-later (updated 2026-08-30).

**Proof this is fixed:**  
- Terms EN/DE state AGPL; matches `LICENSE` + `package.json`.

---

### [MEDIUM] README claimed EN/DE only and “scaffold” while app has 11 locales and full MapLibre

**What is wrong (in plain words):**  
README was stale: said only English/German and described scaffold-era MapLibre install steps.

**Where exactly:**  
- `README.md`

**How to reproduce it:**  
Compare README stack line to `src/i18n/locales/*.json` (11 files) and actual MapLibre usage.

**What should happen instead:**  
README matches shipping reality.

**Exact fix instructions:**  
Patched README locale list and offline section wording in this engagement.

**Proof this is fixed:**  
- README updated 2026-08-30; still verify Play listing copy separately.

---

### [MEDIUM] Anchor “limited mode” can look like a full watch

**What is wrong (in plain words):**  
Anchor alarm can activate without background location / notifications / battery exemption after confirmation. The map may not keep a permanent, impossible-to-miss “LIMITED WATCH” state.

**Where exactly:**  
- `src/lib/anchor/activateAnchorAlarm.ts`  
- Limited sheets in map features

**How to reproduce it:**  
Deny background location → set anchor → confirm limited → background the app → no alarms while user believes watch is on.

**What should happen instead:**  
Persistent chrome badge + Settings health row while limited; optional refuse-to-arm without Always Allow for critical use.

**Why this matters:**  
False sense of safety at anchor.

**Exact fix instructions:**  
1. Persist `anchorLimited: true` in navigation state.  
2. Force visible Map chrome chip until permissions healthy.  
3. Add unit/UI test for chip visibility.

**Proof this is fixed:**  
- Open.

---

## Low

### [LOW] [FIXED] Stale “Carto” comment in download network helper

**Where exactly:** `src/lib/network/downloadNetwork.ts` comment  
**Fix:** Comment now says OpenSeaMap base + seamark.  
**Proof:** File content after audit.

### [LOW] OfflineChartsGuide copy matches durable Ready

**What was wrong:** UX copy risked under-explaining storage when Ready was ambient-only.  
**Status:** Ready is durable OfflineManager again; Downloads “how charts work” pack body already describes device storage. Ambient cache remains documented as recently viewed only.

### [LOW] Typecheck noise from missing workspace package in some checkouts

**What is wrong:** `tsc` reports missing `@check/android15-play-compliance` if the sibling package path is broken.  
**Where:** `app.config.ts`  
**Fix:** Ensure `../shared/android15-play-compliance` exists (file: dependency). Not a runtime SeaCheck logic bug.

---

## Documentation-vs-code mismatches

| Claim | Code reality | Severity |
|-------|--------------|----------|
| README EN/DE only | 11 locales | Medium — **fixed** |
| README scaffold / add MapLibre | MapLibre integrated | Medium — **fixed** |
| Terms “proprietary” | AGPL in LICENSE + terms | Medium — **fixed** |
| “Ready” = durable offline pack | Sweep + OfflineManager seal | High — **fixed** |
| downloadNetwork “Carto” comment | OpenSeaMap only | Low — **fixed** |

---

## Test suite quality

| Metric | Result |
|--------|--------|
| Full Jest | Re-run after durable-pack fix (see execution log) |
| Skipped tests | **0** |
| Dummy assertions sampled | None found in new tests; suite is large — not every file hand-audited for tautologies |
| a11y contrast | PASS |
| a11y touch targets | PASS |
| i18n parity | PASS (874 keys × 11) |
| Mutation core | **16/16 killed** (includes `download-wifi-netinfo-fail-open`, `download-wifi-offline-as-cellular`) |

New meaningful tests added:  
- `__tests__/downloadPolicy.test.ts` (7 cases)  
- `__tests__/offlinePackStore.durableDownload.test.ts` (durable Ready, ambient clear, kill mid-sweep/seal)  
- chartTileReachability fallback case  
- Prior engagement: basemapMigration, teardown race  

---

## Concurrency notes

- `waitForDownloadMapTeardown` race (teardown cleared between check and subscribe) was fixed earlier; covered by `downloadCoordinator.teardown.test.ts`.  
- Download exclusivity mutants killed (`download-parallel-allowed`, `stale-callback-accepted`).  
- No parallel HTTP flood test against live OpenSeaMap (would be abusive); probe/retry budgets unit-tested instead.

---

## Open Questions

1. **Device lab:** Add Maestro/Detox kill-mid-download on CI emulator farm (Jest process-death sims already cover hydrate resume).  
2. **OpenSeaMap ToS:** Confirm bulk corridor downloads remain acceptable for this volume; any User-Agent requirements beyond MapLibre defaults?
