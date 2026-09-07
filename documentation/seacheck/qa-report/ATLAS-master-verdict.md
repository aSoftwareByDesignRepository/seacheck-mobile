# Atlas — Master Production-Readiness Report

**Product:** SeaCheck Mobile (`seacheck-mobile@0.1.8`, `de.softwarebydesign.seacheck`)  
**Agent:** Atlas · **Round:** 8 (session fixes + adversarial re-proof)  
**Session date:** 2026-09-07  
**Rule:** Nothing marked VERIFIED without command output from this session.

Companion: `screenshots/android/MANIFEST.md` · artifact `artifacts/seacheck-0.1.8-atlas-r8.apk`

---

## Scope Manifest (Step 0)

| Item | Reality |
|------|---------|
| SeaCheck Docker Compose | **None** — host Node/Jest/Gradle/Maestro (no `docker compose exec`) |
| Nextcloud Docker | Adjacent only (unused by SeaCheck) |
| Roles / AuthZ API | **None** — offline single-user marine companion |
| Android | Preferred dedicated AVDs `SeaCheck_Atlas_R{3,4}` / `SeaCheck_Maestro` **crashed on boot this session** (qemu disappear). E2E used locked **`Pixel_3_API_33` / `emulator-5606`** (no ALIVE-holder theft). |
| iOS | **OUT OF SCOPE** (product owner; Linux host, no Xcode) — **NOT RUN — ENVIRONMENT GAP** |
| Web / Playwright | **None** |
| Locales | 11 (`da de en es fr it nb nl pl pt sv`) — no RTL |
| Design system | App `ThemeContext` + `BRAND` / `mapChartColors` (not Nextcloud CSS vars) |
| Lenses that apply | 1–6 (mobile-scoped) |

---

## Master Verdict Register — Round 8

| Lens | Must-Fix Open | Must-Fix Verified | Absolute No-Go Open | Should-Fix (backlog) | Self-Critique Status |
|------|---------------|-------------------|---------------------|----------------------|----------------------|
| 1. Architecture | 0 | 4 new + prior retained | 0 | 2 | ✅ verified fresh (unit/mutate) |
| 2. Security | 0 | allowBackup + SQL + secrets | 0 | 0 | ✅ verified fresh |
| 3. Visual/Theme | 0 | contrast + touch | 0 | 1 (OSM hex) | ✅ verified fresh |
| 4. UX Simplicity | 0 | zoom + busy + Fit route | 0 | 1 (2nd-pack Maestro) | ✅ host verified; device partial |
| 5. Translations | 0 | parity 912×11 + Fit route keys | 0 | 0 | ✅ verified fresh |
| 6. E2E Proof | **1** (DE seal) | 3 flows (cancel/kill/seal EN) | 0 | 0 | ❌ DE bounce — farm/AVD gap |

**Android Exit Condition: NOT fully met** — Lens 6 DE Ready Maestro was **not** verified this session.

---

## Round 8 fixes (this session)

| ID | Finding | Fix | Proof |
|----|---------|-----|-------|
| ARCH-BUSY-01 | Sticky `actionBusyId` after region pack kickoff greys all other Download buttons | `usePackDownloadActions` always clears in `finally`; `isPackActionBusy` pure helper | `__tests__/packDownloadPresentation.test.ts` PASS |
| ARCH-BUSY-02 | Same class on custom quick download (`custom_quick`) | `CustomDownloadSection` always `onActionBusyChange(null)` | code review + same busy helper |
| ARCH-CAM-01 | Waypoint add re-`fitBounds` via `planningRevision` (zoom snap) | `passagePlanningCamera` one-shot policy; Fit route control | `__tests__/passagePlanningCamera.test.ts` PASS |
| ARCH-CAM-02 | GPS follow fights planning viewport | `shouldEnableMapCameraFollow`; disable recenter while planning | `__tests__/mapCameraFollow.test.ts` PASS |
| ARCH-RESTORE-01 | `restoreActive` ignored native pack mutex | refuse while `isNativePackOpBusy()`; mutation baseline updated | `__tests__/nativePackMutex.test.ts` PASS · `mutate:core` kills restore mutation |

---

## Per-lens evidence (this session)

### 1 — Architecture
- Unit: **13 suites / 77 tests PASS** (`/tmp/atlas-sc-r8-unit.log`) — planning camera, pack busy, mutex+restoreActive, coordinator concurrent, GPS queue, tileGrid, teardown sync, localeParity.
- `mutate:core`: **24 killed / 0 survived** (`/tmp/atlas-sc-r8-mutate.log`).
- `tsc --noEmit`: clean (`/tmp/atlas-sc-r8-typecheck.log`).

**Should-Fix backlog (owner: Atlas next round):**
1. Concurrent `waypointStore` writers vs map planning lock (serialise or document single-writer).
2. `withNativePackOp` hang has no timeout (fail-closed sticky exclusive downloads).

### 2 — Security
- `allowBackup="false"` in APK manifest: `aapt … allowBackup … (type 0x12)0x0`.
- Secrets grep on `src/`: no live API keys / PEM / `sk_live` (only comment “no secrets”).
- SQLite stores use bound `?` parameters; no concat SQL injection hits in scan.
- No multi-user/IDOR surface (offline single-user).

### 3 — Visual / a11y
- `npm run a11y:contrast` PASS (light/dark/high-contrast/red-night) — `/tmp/atlas-sc-r8-contrast2.log`.
- `npm run a11y:touch` PASS — `/tmp/atlas-sc-r8-touch2.log`.
- **Should-Fix:** OSM water `#aad3df` and custom-download overlay hex remain outside theme tokens (chart legibility / OSM convention).

### 4 — UX
- Zoom no longer resets on waypoint add (ARCH-CAM-01).
- Download buttons no longer sticky-grey after first pack (ARCH-BUSY-01/02).
- Explicit **Fit route** on planning panel (11 locales).
- Destructive delete still confirms — no Open Conflict with Lens 2.
- **Should-Fix proof gap:** no Maestro asserting “after Kiel Ready, Laboe Download is enabled” on device this session (unit covers policy).

### 5 — Translations
- `i18n:parity`: **912 keys × 11 locales PASS** (`/tmp/atlas-sc-r8-i18n2.log`).
- New keys `mapPlanningFitRoute` / `mapPlanningFitRouteHint` present in all locales.

### 6 — E2E Proof
| Flow | Result | Log / screenshot |
|------|--------|------------------|
| release-cancel (`02a`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r8-cancel.log` · `atlas-r8-download-cancel-minimal.png` |
| release-kill (`03a`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r8-kill.log` · `atlas-r8-download-kill-mid-release.png` |
| release-seal EN (`04`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r8-seal.log` · `atlas-r8-download-seal-ready.png` |
| release-seal DE (`05`) | 🔴 **NOT VERIFIED** | Attempt 1: Maestro targeted crashing `SeaCheck_Maestro` on `emulator-5602` (`/tmp/atlas-sc-r8-seal-de.log`). Attempt 2+: **Pixel locked by `atlas-tkc-r4e`**; farm **4/4**; dedicated SeaCheck AVDs crash on boot. |

APK installed for EN flows: `versionName=0.1.8` / `versionCode=8` / `lastUpdateTime=2026-09-07 20:02:33` on `emulator-5606`.

---

## Open Conflicts

None.

## Blocking Questions

1. **DE seal Maestro** — farm contention + SeaCheck AVD crash loop blocked device DE Ready proof this round. Prefer: free a slot / stabilize SeaCheck AVD, then re-run `SEACHECK_MAESTRO_AVD=… SEACHECK_MAESTRO_DEVICE=… bash scripts/maestro-e2e.sh release-seal-de` only.

## Residual risk

- iOS out of scope (accepted).
- Dedicated SeaCheck emulators unstable on this host this session (qemu disappear ~30s).
- Physical handset not re-proven.
- Worktree has **uncommitted Round 8 fixes** — `origin/main` alone is still R7 binary until commit/push.
- Dense tile stride remains intentional (integrity > speed).
- Second-pack UI unlock is unit-proven; device Maestro for that path not run.

## Exit condition

**Not met.** Must-Fix / Absolute No-Go for Architecture–Security–UX–i18n are closed with proof; **Lens 6 DE seal remains open**. Do not call Android production-ready for Round 8 until DE Ready is executed green on a held emulator.
