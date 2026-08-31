# SeaCheck QA Findings — Momos Re-Audit

**Product:** SeaCheck Mobile (`seacheck-mobile` 0.1.3)  
**Audit date:** 2026-08-31 (UTC) — second Momos pass after Maestro CI green  
**Auditor:** Momos (hostile QA / red-team)  
**Environment:** Native Jest on developer host — **no** Docker Compose for this app  
**Code tip:** `main` @ Momos pass 2 (Wi‑Fi store gate + Overpass NetInfo timeout + boolean hydrate)

---

## Executive Summary

**Not banana software for the invariants we attack — but not “perfect forever” either.**  
This pass found **new High** honesty bugs the prior “0 open High” claim missed: Wi‑Fi policy only in the UI, Overpass skip-gate fail-**open** on NetInfo timeout, and corrupt settings booleans that could silence alarms or skip onboarding. Those are **fixed with red→green proof** below.

| Severity | Open after this engagement | Fixed this engagement (pass 2) |
|----------|----------------------------|--------------------------------|
| Critical | **0** | — (prior Critical remains fixed) |
| High | **0** | Wi‑Fi store/hydrate gate; Overpass NetInfo timeout; alarm/onboarding boolean hydrate |
| Medium | **0** | storageCheck zero-estimate fail-closed |
| Low | Native WMS pixels not on-device E2E; CDN flakes retried once; ConfirmSheet queue drain not fully tested | — |

**Fit for client/auditor today?**  
**Yes** for store/functional review of download integrity + local fail-closed gates — **with** the caveat that full-app UX and native WMS pixels are not Maestro-covered.  
**No** if the auditor demands ECDIS certification or zero residual Low gaps.

**Proof (executed this pass):** Jest **133 suites / 641 tests** EXIT 0 (no `--forceExit`); mutate **16/16**; a11y contrast+touch PASS; i18n 898×11 PASS. Prior Maestro CI cancel+kill still green on tip lineage.

**Not** a certified ECDIS / SOLAS chart plotter — product truth, not a bug.

---

## Critical

*None open.* Prior Critical (Wi‑Fi-only silent allow when NetInfo throws) remains fixed — see `__tests__/downloadPolicy.test.ts` and mutate mutants `download-wifi-netinfo-fail-open`, `download-wifi-offline-as-cellular`.

---

## High

### [HIGH] [FIXED] Wi‑Fi-only policy enforced only in UI — store + hydrate reattach bypassed it

**What is wrong (in plain words):**  
The “download only on Wi‑Fi” setting was checked in download buttons, but `startDownload` / `startCustomDownload` and hydrate **reattach** after a kill never called that check. A future caller — or a resume on cellular after process death — could burn mobile data without the confirm dialog.

**Where exactly:**  
- File: `src/store/offlinePackStore.ts` — `startDownload`, `startCustomDownload`, hydrate reattach loop  
- File: `src/hooks/usePackDownloadActions.ts` (UI-only gate, previously the sole caller)  
- Workflow: Downloads → kill mid-pack → reopen on LTE with Wi‑Fi-only ON  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
# Before fix — gate never called from store:
npx jest __tests__/offlinePackStore.wifiGate.test.ts --ci
# Observed: ensureDownloadAllowed call count 0 / downloading still possible
```

**What should happen instead:**  
Every store entry that starts or resumes tile transfer must run `ensureDownloadAllowed`. Cancel/offline → throw / leave error, no sweep.

**Why this matters:**  
Wi‑Fi-only is a money/roaming safety promise. UI-only enforcement is not an invariant — it is hope.

**Exact fix instructions:**  
1. Add `assertDownloadWifiPolicy()` wrapping `ensureDownloadAllowed` in `offlinePackStore.ts`.  
2. Call it from `startDownload`, `startCustomDownload`, and before hydrate `reattachCacheDownload` / `reattachNativeDownload`.  
3. Default Jest NetInfo mock must include `type: 'wifi'` so honest paths still pass.

**Proof this is fixed:**  
- `__tests__/offlinePackStore.wifiGate.test.ts` › cellular cancel refuses `startDownload`  
- Red before (gate not called), green after (logged 2026-08-31)

---

### [HIGH] [FIXED] NetInfo timeout treated Overpass as online (privacy fail-open)

**What is wrong (in plain words):**  
When NetInfo hung past 4s, the code logged “treating as offline” but `fetchIsEffectivelyOffline()` returned **false** (“not offline”). Chart-object lookup then POSTed exact lat/lon to Overpass.

**Where exactly:**  
- File: `src/lib/network/connectivity.ts` — `fetchIsEffectivelyOffline`  
- Callers: `src/lib/seamarks/querySeamark.ts`  

**How to reproduce it (copy-paste steps):**  
```bash
npx jest __tests__/connectivity.test.ts -t 'NetInfo timeout as offline' --ci
# Before: Expected true, Received false
```

**What should happen instead:**  
Timeout → offline for skip-gates (`true`). Online gate already returned `false` on null — keep that.

**Why this matters:**  
Privacy and “no network when we do not know” — the log lied; the behavior burned coordinates.

**Exact fix instructions:**  
In `fetchIsEffectivelyOffline`, `if (!state) return true`.

**Proof this is fixed:**  
- `__tests__/connectivity.test.ts` › treats NetInfo timeout as offline…  
- Red → green 2026-08-31

---

### [HIGH] [FIXED] Corrupt settings hydrate could silence alarms or skip onboarding

**What is wrong (in plain words):**  
Only `downloadWifiOnly` / depth / XTE used strict boolean parsing. `alarmSoundEnabled: 0` became falsy → alarms silent. `onboardingCompleted: "false"` via `Boolean()` became **true** → disclaimer skipped.

**Where exactly:**  
- File: `src/store/settingsStore.ts` hydrate  

**How to reproduce it (copy-paste steps):**  
```bash
npx jest __tests__/settingsStore.booleanHydrate.test.ts --ci
# Before: alarmSoundEnabled false / onboardingCompleted true for corrupt values
```

**What should happen instead:**  
Only real JSON booleans restore; anything else uses safe defaults (alarms ON, onboarding not completed).

**Why this matters:**  
Silent alarms and skipped navigation disclaimer are safety defects, not cosmetics.

**Exact fix instructions:**  
Route alarm/onboarding/dismiss/map toggles through `parsePersistedBoolean(...)`.

**Proof this is fixed:**  
- `__tests__/settingsStore.booleanHydrate.test.ts` (all cases)  
- Red → green 2026-08-31

---

### [HIGH] [FIXED] Corrupt `downloadWifiOnly` hydrate could disable Wi‑Fi-only policy

**What is wrong (in plain words):**  
Settings restore used `parsed.downloadWifiOnly ?? true`. A corrupted store value of `0` or the string `"false"` is not `null`/`undefined`, so it was kept. Those values are falsy in JS, so Wi‑Fi-only checks treated the setting as **off** and skipped the cellular confirm.

**Where exactly:**  
- File: `src/store/settingsStore.ts` (hydrate)  
- Workflow: boot → Downloads on cellular with Wi‑Fi-only intended ON  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
# Before fix — failing:
npx jest __tests__/settingsStore.downloadWifiOnly.test.ts --forceExit
# Observed: Expected true, Received 0 / "false"
```

**What should happen instead:**  
Only a real boolean `false` may turn Wi‑Fi-only off. Anything else falls back to `true` (safe default).

**Why this matters:**  
A bit-rot or bad write in AsyncStorage could burn roaming data or skip the user-facing cellular warning — the exact class of bug the prior Critical engagement fixed for NetInfo throws.

**Exact fix instructions:**  
1. Open `src/store/settingsStore.ts`.  
2. Hydrate with `parsePersistedBoolean(parsed.downloadWifiOnly, true)` (literal `true` fallback — it is not on `CRUISE_PASSAGE_DEFAULTS`).  
3. Re-run `__tests__/settingsStore.downloadWifiOnly.test.ts`.

**Proof this is fixed:**  
- `__tests__/settingsStore.downloadWifiOnly.test.ts` › numeric `0` / string `"false"` → stays `true`; boolean `false` restores off.  
- Red before fix, green after (logged in `test-execution-log.md`).

---

### [HIGH] [FIXED] Cancel during seal could restore a just-created pack as Ready

**What is wrong (in plain words):**  
Between `createPack` (index gets native pack id) and UI catch-up (still `cache:…`), Cancel saw “indexed id ≠ UI id” and **restored** the native pack. If that pack was already complete, Cancel left the region **Ready** — cancel did not cancel.

**Where exactly:**  
- File: `src/store/offlinePackStore.ts` — `cancelDownload`  
- Workflow: Downloads → mid-seal → Cancel  

**How to reproduce it:**  
```bash
npx jest __tests__/offlinePackStore.durableDownload.test.ts -t 'cancel during seal' --forceExit
```

**What should happen instead:**  
If the in-flight UI pack id is still cache-backed, any newer native id in the index belongs to the cancelled session — **delete it**, never restore as Ready.

**Why this matters:**  
Skipper hits Cancel, UI looks idle, charts still claim Ready from a pack they meant to abort — navigation integrity lie.

**Exact fix instructions:**  
1. In `cancelDownload`, when `indexedPackId !== packId` and `packId` is `cache:*` (or not native), `removeNativePack(indexedPackId)` and fall through to idle cleanup.  
2. Only restore a differing native id when it is **complete** and the in-flight id was also native (prior ready pack case).

**Proof this is fixed:**  
- `__tests__/offlinePackStore.durableDownload.test.ts` › `cancel during seal (index native, UI still cache:*) must not leave Ready`

---

### [HIGH] [FIXED] Kill after sweep 100% / before createPack demoted instead of sealing

**What is wrong (in plain words):**  
If the app died after ambient sweep finished (`sweepCompleted >= sweepTotal`) but before `OfflineManager.createPack`, hydrate treated the row as ambient-only Ready legacy and **demoted** it. The long sweep work was thrown away; seal was never resumed.

**Where exactly:**  
- File: `src/store/offlinePackStore.ts` — hydrate + `buildRecoveredRegionsFromIndex`  
- Workflow: Downloads → sweep completes → process death → reopen  

**How to reproduce it:**  
```bash
npx jest __tests__/offlinePackStore.durableDownload.test.ts -t 'between sweep-complete and createPack' --forceExit
```

**What should happen instead:**  
Treat sweep-complete + still `cacheBacked` + bounds as **downloading / seal-pending** and reattach (sweep at 100% → `runSeal`).

**Why this matters:**  
Marina Wi‑Fi downloads are long; process death after the hard part must resume, not force a full re-download with a scary “retired” error.

**Exact fix instructions:**  
1. Add `sweepDonePendingSeal` when `sweepCompleted >= sweepTotal` and bounds exist.  
2. Mark `downloading` and reattach like mid-sweep.  
3. Do **not** run ambient-retired demotion for that case.

**Proof this is fixed:**  
- `__tests__/offlinePackStore.durableDownload.test.ts` › `resumes seal after process death between sweep-complete and createPack`

---

### [HIGH] [FIXED] Depth overlay assumed online before first NetInfo sample

**What is wrong (in plain words):**  
`useIsDeviceDisconnected` started as `false` (not disconnected). With depth enabled, the overlay could mount for a frame on airplane-mode boot and fire WMS requests before NetInfo said offline.

**Where exactly:**  
- Files: `src/lib/network/connectivity.ts`, `NavigationMap.tsx`, `MapDepthChip.tsx`, `ChartDataSettingsGroup.tsx`  
- Workflow: depth ON + cold start offline  

**What should happen instead:**  
Online-only layers use fail-closed `useOnlineLayersAllowed()` — `false` until first NetInfo sample with `isConnected === true`.

**Why this matters:**  
Unexpected WMS traffic offline; chip/settings can disagree with map briefly.

**Exact fix instructions:**  
1. Add `useOnlineLayersAllowed` in `connectivity.ts`.  
2. Gate `shouldShowDepthOverlay` with `isOffline: !onlineLayersAllowed`.  
3. Align chip + settings pause copy to the same hook.

**Proof this is fixed:**  
- Code path + existing `shouldShowDepthOverlay` unit matrix; connectivity suite still green. Native first-paint race closed by initial `allowed=false`.

---

## Medium

### [MEDIUM] [FIXED] “Download all” toast counted in-flight packs as ready

**What is wrong (in plain words):**  
`handleDownloadAll` incremented `ready` when state was `downloading`, so the passage toast could claim success for packs still running.

**Where exactly:**  
- File: `src/hooks/usePackDownloadActions.ts`  
- UI: `PassageCoverageCard.tsx` → `passage.downloadAllProgress`  

**What should happen instead:**  
Count `ready` only when `state === 'ready'`.

**Proof this is fixed:**  
- Code change in `usePackDownloadActions.ts` (sequential `handleDownload` already awaits completion for Ready on success path).

---

### [MEDIUM] [FIXED] Anchor “limited mode” can look like a full watch

**What is wrong (in plain words):**  
Anchor alarm can activate without background location / notifications / battery exemption after confirmation. There was no durable, impossible-to-miss “LIMITED WATCH” chrome after restart.

**Where exactly:**  
- `src/lib/anchor/activateAnchorAlarm.ts`  
- `src/store/navigationStore.ts` (`armedLimited`)  
- `src/features/map/AnchorLimitedBanner.tsx`  

**What should happen instead:**  
Persist limited flag + permanent map chrome until permissions are complete.

**Proof this is fixed:**  
- Persist `anchorAlarm.armedLimited`; hydrate restores it.  
- Non-dismissible `map.anchorLimitedBanner`; warning FAB/instrument/settings chrome.  
- `__tests__/anchorLimitedWatch.durable.test.ts` — activate → persist → hydrate still limited; refresh clears when full.

---

### [MEDIUM] [FIXED] Privacy copy understates Overpass precision

**What is wrong (in plain words):**  
Privacy text emphasized “map areas”; seamark long-press lookup posts near-exact lat/lon to Overpass.

**Where exactly:**  
- `docs/play-store/privacy-mobile-en.md` / DE  
- `docs/play-store/DATA-SAFETY.md`  
- `src/lib/seamarks/querySeamark.ts`  

**What should happen instead:**  
State that chart-object lookup may send the tapped coordinates to Overpass mirrors when online.

**Proof this is fixed:**  
- Privacy EN/DE + Data Safety now name Overpass tap lat/lon and kumi.systems failover.

---

## Low

### [LOW] [FIXED] README publisher link used `http://` for nextcloud.software-by-design.de

Now `https://nextcloud.software-by-design.de/`.

### [LOW] [FIXED] Maestro device E2E for cancel-mid + kill-mid download honesty

Flows under `.maestro/` + `scripts/maestro-e2e.sh` (`npm run e2e:maestro:cancel` / `:kill`).

**Proof (2026-08-30 local):**
- `02-download-cancel-mid` → **PASS** on `emulator-5556` (SeaCheck_Maestro_API_33); cancel mid-flight → no Ready banner.
- `03-download-kill-mid` → **PASS** on `emulator-5554` (Pixel_3_API_33); killApp mid-flight → relaunch → no Ready banner.
- Script disables other `softwarebydesign.*` packages for the run (DutyCheck FG steal) and re-enables on EXIT.

**CI:** `.github/workflows/e2e-maestro.yml` builds a debug APK, boots **one** API-33 emulator, runs `npm run ci:maestro` (cancel then kill as **separate** clear+run invocations; one retry each for CDN flakes). Also on `workflow_dispatch` / weekly schedule / download-path PRs.

**CI honesty fix (2026-08-30):** Prior `ci-maestro.sh` read `$?` after `if`, which is always 0 in bash — a failed Maestro could still print `ci-maestro passed` (false green on run 33327634960). Exit codes are now captured with `set +e` / explicit `flow_rc`. Onboarding helper accepts warm start (`tab.map` already visible).

**CI false-red (2026-08-30 run [33329507994](https://github.com/aSoftwareByDesignRepository/seacheck-mobile/actions/runs/33329507994)):** Maestro cancel printed `==> OK` twice, then EXIT trap crashed on `${#DISABLED_RIVALS[@]:-0}` (`bad substitution`) → exit 1. Fixed: valid `${#DISABLED_RIVALS[@]}` + trap `|| true`.

**Proof:** GitHub Actions run [33330890339](https://github.com/aSoftwareByDesignRepository/seacheck-mobile/actions/runs/33330890339) (`77db70d`): **cancel + kill both PASS on attempt 1** on a single API-33 emulator; `ci-maestro passed`. Earlier false-green (33327634960) and EXIT-trap false-red (33329507994) are closed.

### [LOW] [FIXED] Jest worker timer leaks after offlinePackStore tests

Download map linger / post-teardown delays are **zero under `NODE_ENV=test`** (`downloadMapConstants`). Full suite exits cleanly without `--forceExit` (`forceExit: false` in `jest.config.js`). CI unit job runs `npm run ci:unit` with no forceExit.

### [LOW] [FIXED] `storageCheck` fail-opens when free-space API missing

`ensureStorageForDownload` returns `{ ok: false, reason: 'unavailable' }` on throw / missing API / NaN free bytes **and** on non-positive / non-finite `estimatedKb` (no silent skip). `assertStorageForBounds` blocks the download with `downloads.errorStorageUnavailable`.

### [LOW] qa-report inventory lagged WMS hosts (fixed in this write-up)

---

## Documentation-vs-code mismatches

| Claim | Code reality | Severity |
|-------|--------------|----------|
| Terms proprietary | AGPL in LICENSE + terms | Fixed prior |
| Ready = ambient cache | Sweep + OfflineManager seal | Fixed prior |
| Privacy “map areas” only | Overpass gets tap lat/lon | Fixed — privacy + Data Safety |
| README http publisher | HTTPS elsewhere | Fixed |
| Prior qa-report “0 High” | New Highs found & fixed this pass | Updated herein |

---

## Test suite quality

| Metric | Result |
|--------|--------|
| Full Jest | **133 passed / 641 tests** (exits without `--forceExit`, 2026-08-31 Momos pass 2) |
| Skipped tests | **0** |
| a11y contrast | PASS |
| a11y touch targets | PASS |
| i18n parity | PASS (898 keys × 11) |
| Mutation core | **16/16 killed** |

New / extended adversarial tests this engagement:  
- `__tests__/settingsStore.downloadWifiOnly.test.ts`  
- durableDownload: seal-pending resume + cancel-not-Ready  
- `__tests__/anchorLimitedWatch.durable.test.ts`  
- `storageCheck` fail-closed (throw + missing API)  
- download honesty: style-only Ready rejected; frozen-tile stall; cancel settles seal; cancel-after-seal keeps Ready; completing UI @ 99% before Ready  

---

## Auth / API checklist (OWASP-shaped)

| Check | Result |
|-------|--------|
| BOLA/IDOR | N/A — no multi-user API |
| Broken auth | N/A — no accounts |
| Mass assignment | Local settings Zod-ish parsers; Wi‑Fi boolean now strict |
| Resource consumption | Pack size validation + storage check (fail-closed on API miss) |
| SSRF | Depth WMS allowlisted endpoints only; Overpass fixed hosts |
| Injection | SQLite parameterized; WMS layer regex allowlist |
| Sensitive flows | Download exclusivity + confirm on cellular / depth enable |

---

## Open Questions

1. Product choice: limited watch still arms after explicit confirm; chrome stays LIMITED until background + notifications + battery exemption + BG task are healthy.  
2. Native MapLibre WMS visual render on device (pixels) — still not automated.  
3. ConfirmSheet unmount with a **queued** second confirm — current code cancels the visible dialog only; add RTL coverage if product requires full queue drain.  
4. Should `useOnlineLayersAllowed` also require `isInternetReachable === true` (captive-portal WMS)? Trade-off vs Android false negatives.
