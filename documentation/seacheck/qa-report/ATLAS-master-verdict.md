# ATLAS — SeaCheck Production-Readiness Report

**Product:** SeaCheck Mobile (`seacheck-mobile@0.1.9`, `de.softwarebydesign.seacheck`)  
**Auditor:** Atlas · **Round:** 9 · **Policy:** v2 (wow > 8.5; one-app-one-AVD; never steal; circuit 3/5)  
**Session:** 2026-09-08 · **Rule:** Nothing marked VERIFIED without command output from this session.

Companion artifacts: `screenshots/android/MANIFEST.md` · `artifacts/seacheck-0.1.9-atlas-r9.apk`

---

## Scope Manifest (Step 0 — verified)

| Item | Reality |
|------|---------|
| NC app folder | **None** — mobile-only product |
| Docker Compose | **None** — host Node/Jest/Gradle/Maestro |
| Roles / AuthZ API | **None** — offline single-user marine companion |
| Android | Dedicated **`SeaCheck_Maestro_API_33` / `emulator-5600`** via `emulator-lock.sh` (booted by holder; **no steal**) |
| iOS | **NOT RUN — ENVIRONMENT GAP** (Linux host, no Xcode) |
| Web / Playwright | **None** |
| Locales | 11 (`da de en es fr it nb nl pl pt sv`) — no RTL; informal DE intentional |
| Design system | App `ThemeContext` + `BRAND` / chart colors (not Nextcloud CSS vars) |
| Lenses that apply | 1–6 (mobile-scoped); AAA via Android visual pack |
| Legacy-safe | Additive only (`allowBackup` harden + listing-contract test align) |

---

## Master Verdict Register — Round 9

| Lens | Must-Fix Open | Must-Fix Verified | Absolute No-Go Open | Should-Fix (backlog) | Self-Critique |
|------|---------------|-------------------|---------------------|----------------------|---------------|
| 1. Architecture | 0 | mutate 24/0 + unit | 0 | 2 (R8 carry) | ✅ fresh |
| 2. Security | 0 | allowBackup=false in APK + secrets/SQL | 0 | 0 | ✅ fresh |
| 3. Visual/Theme | 0 | contrast + touch | 0 | 1 (OSM hex) | ✅ fresh |
| 4. UX Simplicity | 0 | cancel/kill/seal honesty | 0 | 0 | ✅ device |
| 5. Translations | 0 | 912×11 + DE seal string | 0 | 0 | ✅ fresh |
| 6. E2E Proof | 0 | cancel + kill + seal EN + **seal DE** | 0 | 0 | ✅ fresh |

| Gate | Result |
|------|--------|
| `exit_met` | **TRUE** — all scoped lenses proven this session (iOS excepted as environment gap) |
| `visual_aaa` | **FALSE** — awaiting harsh critic ACCEPT (wow > 8.5) on visual-ready pack |
| AVD | **HELD** `emulator-5600` until `exit_met+visual_aaa` |
| Circuit breaker | Not tripped (no REJECT this round) |

---

## Round 9 fixes (this session)

| ID | Finding | Fix | Proof |
|----|---------|-----|-------|
| SEC-BACKUP-01 | Source `AndroidManifest` had `allowBackup="true"` (R8 APK claimed false — source drifted) | Set `allowBackup="false"` | `aapt dump xmltree` → `allowBackup=(type 0x12)0x0` on release APK |
| TEST-PLAY-01 | Listing contract expected obsolete screenshot names (`phone-02-disclaimer`, `phone-06-about`) | Align test to shipped store-farm names | `__tests__/playStoreListingContract.test.ts` PASS |

---

## Per-lens evidence (this session)

### 1 — Architecture
- Unit: **165 suites / 776 tests** after TEST-PLAY-01 (prior: 1 fail / 775 pass) — `/tmp/atlas-sc-r9-unit.log` + play-contract re-run.
- `mutate:core`: **24 killed / 0 survived** — `/tmp/atlas-sc-r9-mutate.log`.
- `tsc --noEmit`: clean — `/tmp/atlas-sc-r9-typecheck.log`.

**Should-Fix backlog (carry):** concurrent `waypointStore` writers; `withNativePackOp` hang timeout.

### 2 — Security
- Release APK `0.1.9` / `versionCode=9`: `allowBackup` **false** (0x0).
- Secrets grep on `src/`: none.
- SQLite: schema via static `execAsync`; runtime queries use bound params (no concat injection surface).
- No multi-user/IDOR (offline single-user).

### 3 — Visual / a11y
- `npm run a11y:contrast` PASS — `/tmp/atlas-sc-r9-contrast.log`.
- `npm run a11y:touch` PASS — `/tmp/atlas-sc-r9-touch.log`.
- Visual pack: map / more / settings / downloads / DE map / DE Ready seal (see MANIFEST).

### 4 — UX
- Download cancel mid-flight honest (no Ready) — Maestro `02a` EXIT 0.
- Kill mid-flight honest — Maestro `03a` EXIT 0.
- Seal Ready EN + DE — Maestro `04`/`05` EXIT 0.

### 5 — Translations
- `i18n:parity`: **912 keys × 11 locales PASS**.
- DE seal asserts `"1 Kartenpaket offline bereit"` visible and EN string absent.

### 6 — E2E Proof

| Flow | Result | Log | Screenshot |
|------|--------|-----|------------|
| release-cancel (`02a`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r9-cancel.log` | `atlas-r9-download-cancel-minimal.png` |
| release-kill (`03a`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r9-kill.log` | `atlas-r9-download-kill-mid-release.png` |
| release-seal EN (`04`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r9-seal.log` | `atlas-r9-download-seal-ready.png` |
| release-seal DE (`05`) | 🟢 EXIT 0 | `/tmp/atlas-sc-r9-seal-de.log` | `atlas-r9-download-seal-ready-de.png` |

APK: `versionName=0.1.9` / `versionCode=9` / installed `2026-09-08 16:57:01` on `emulator-5600`.

---

## Open Conflicts

None.

## Blocking Questions

None for Android exit. iOS remains environment-gap (accepted).

## Residual risk

- iOS not run (environment gap).
- Physical handset not re-proven this session.
- Dense tile stride remains intentional (integrity > speed).
- Visual AAA not yet critic-ACCEPTed — AVD **must stay locked**.

## Exit condition

**`exit_met` = true** for Android scoped lenses.  
**`visual_aaa` = false** until critic ACCEPT with **wow > 8.5**.  
Release AVD only after both (`release --kill-if-booted`).
