# SeaCheck QA Findings — Momos Re-Audit

**Product:** SeaCheck Mobile (`seacheck-mobile` 0.1.3)  
**Audit date:** 2026-08-30 (UTC)  
**Auditor:** Momos (hostile QA / red-team)  
**Environment:** Native Jest on developer host — **no** Docker Compose for this app  
**Code tip:** `main` @ post-depth-harden + this engagement’s honesty fixes  

---

## Executive Summary

**Not fully production-clean for a hostile external auditor who demands zero High residual risk** — but **fit for a careful store/functional review** after this engagement’s fixes. Previously closed Critical Wi‑Fi fail-open and ambient-Ready lies remain closed. This pass found and fixed new honesty bugs in settings hydrate, cancel-vs-seal, sweep→seal resume, download-all counting, and depth NetInfo fail-open.

| Severity | Open after this engagement | Fixed this engagement |
|----------|----------------------------|------------------------|
| Critical | **0** | 0 new Critical (prior Wi‑Fi Critical stays fixed) |
| High | **0** (device Maestro E2E still absent — tracked as process/Low) | 4 High honesty bugs fixed |
| Medium | **2** (limited anchor watch; Overpass privacy framing) | 1 Medium UI lie fixed |
| Low | several docs/process | README http link, inventory lag |

**Fit for client/auditor today?**  
**Conditional yes** for functional + download integrity + depth opt-in. **No** if they require on-device Maestro kill-mid-download or a persisted “LIMITED WATCH” chrome invariant for anchor.

**Auth / BOLA:** N/A — no multi-user server. Residual risk is local integrity + third-party HTTPS.

Safety/offline mutation: **16 killed / 0 survived / 16**.  
Full Jest after fixes: **128 suites / 613 tests** green.

---

## Critical

*None open.* Prior Critical (Wi‑Fi-only silent allow when NetInfo throws) remains fixed — see `__tests__/downloadPolicy.test.ts` and mutate mutants `download-wifi-netinfo-fail-open`, `download-wifi-offline-as-cellular`.

---

## High

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

### [MEDIUM] Anchor “limited mode” can look like a full watch

**What is wrong (in plain words):**  
Anchor alarm can activate without background location / notifications / battery exemption after confirmation. There is no durable, impossible-to-miss “LIMITED WATCH” chrome after restart.

**Where exactly:**  
- `src/lib/anchor/activateAnchorAlarm.ts`  
- Limited sheets in map features  

**How to reproduce it:**  
Deny background location → set anchor → confirm limited → background app → no alarms while UI may still look “armed.”

**What should happen instead:**  
Persist limited flag + permanent map chrome until permissions are complete, or refuse to arm.

**Why this matters:**  
False sense of safety for drag alarms — maritime safety.

**Exact fix instructions:**  
1. Persist `anchorLimited` with the alarm record.  
2. Show non-dismissible map banner while limited.  
3. Add unit test: hydrate limited → banner visible.

**Proof this is fixed:**  
- **Open** — not fixed in this engagement.

---

### [MEDIUM] Privacy copy understates Overpass precision

**What is wrong (in plain words):**  
Privacy text emphasizes “map areas”; seamark long-press lookup posts near-exact lat/lon to Overpass.

**Where exactly:**  
- `docs/play-store/privacy-mobile-en.md` / DE  
- `src/lib/seamarks/querySeamark.ts`  

**What should happen instead:**  
State that chart-object lookup may send the tapped coordinates to Overpass mirrors when online.

**Proof this is fixed:**  
- **Open** — docs only.

---

## Low

### [LOW] README publisher link still uses `http://` for nextcloud.software-by-design.de

Legal/privacy URLs are HTTPS. Mixed-content / clarity issue for store review.

### [LOW] No Maestro/Detox device E2E for kill-mid-download

Jest process-death sims cover sweep / seal / cancel. Physical emulator farm still absent.

### [LOW] Jest worker timer leaks after offlinePackStore tests

Suites pass; RN Jest preset still warns about timeouts after teardown. Does not fail CI with `--forceExit`. Worth cleaning; not a product Ready-lie.

### [LOW] `storageCheck` fail-opens when free-space API missing

Download may proceed without a size check if the native free-space call throws. Conservative UX would confirm / block.

### [LOW] qa-report inventory lagged WMS hosts (fixed in this write-up)

---

## Documentation-vs-code mismatches

| Claim | Code reality | Severity |
|-------|--------------|----------|
| Terms proprietary | AGPL in LICENSE + terms | Fixed prior |
| Ready = ambient cache | Sweep + OfflineManager seal | Fixed prior |
| Privacy “map areas” only | Overpass gets tap lat/lon | Medium — open |
| README http publisher | HTTPS elsewhere | Low — open |
| Prior qa-report “0 High” | New Highs found & fixed this pass | Updated herein |

---

## Test suite quality

| Metric | Result |
|--------|--------|
| Full Jest | **128 passed / 613 tests** (2026-08-30) |
| Skipped tests | **0** |
| a11y contrast | PASS |
| a11y touch targets | PASS |
| i18n parity | PASS (891 keys × 11) |
| Mutation core | **16/16 killed** |

New / extended adversarial tests this engagement:  
- `__tests__/settingsStore.downloadWifiOnly.test.ts`  
- durableDownload: seal-pending resume + cancel-not-Ready  

---

## Auth / API checklist (OWASP-shaped)

| Check | Result |
|-------|--------|
| BOLA/IDOR | N/A — no multi-user API |
| Broken auth | N/A — no accounts |
| Mass assignment | Local settings Zod-ish parsers; Wi‑Fi boolean now strict |
| Resource consumption | Pack size validation + storage check (fail-open residual Low) |
| SSRF | Depth WMS allowlisted endpoints only; Overpass fixed hosts |
| Injection | SQLite parameterized; WMS layer regex allowlist |
| Sensitive flows | Download exclusivity + confirm on cellular / depth enable |

---

## Open Questions

1. Should limited anchor watch refuse to arm without Always Allow + notifications, or is confirm + banner enough for product?  
2. Can CI host a Maestro kill-mid-download on emulator?  
3. Should Overpass be disabled when depth/privacy “minimal network” mode is desired?
