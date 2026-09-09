# ATLAS — SeaCheck Production-Readiness Report

**Product:** SeaCheck Mobile (`seacheck-mobile@0.1.9`, `de.softwarebydesign.seacheck`)  
**Auditor:** Atlas Fixer · **Round:** 10 · **Policy:** v2 (wow > 8.5; one-app-one-AVD; never steal; circuit 3/5)  
**Session:** 2026-09-08 · **Prior:** R9 REJECT wow 8.05 → Absolute No-Gos closed this round.

Companion artifacts: `screenshots/android/MANIFEST.md` · `artifacts/seacheck-0.1.9-atlas-r10.apk`  
Farm: `.cursor/atlas-farm/visual-ready-seacheck.json` (round 10)

---

## Scope Manifest (Step 0 — verified)

| Item | Reality |
|------|---------|
| NC app folder | **None** — mobile-only product |
| Docker Compose | **None** — host Node/Jest/Gradle/Maestro |
| Roles / AuthZ API | **None** — offline single-user marine companion |
| Android | Dedicated **`SeaCheck_Maestro_API_33` / `emulator-5602`** via `emulator-lock.sh` (booted by holder; **no steal**) |
| iOS | **NOT RUN — ENVIRONMENT GAP** (Linux host, no Xcode) |
| Web / Playwright | **None** |
| Locales | 11 (`da de en es fr it nb nl pl pt sv`) — no RTL; informal DE intentional |
| Design system | App `ThemeContext` + `BRAND` / chart colors |
| Lenses that apply | 1–6 (mobile-scoped); AAA via Android visual pack |
| Legacy-safe | Additive only (Ready hint keys + Settings chrome pad + tip copy) |

---

## Master Verdict Register — Round 10

| Lens | Must-Fix Open | Must-Fix Verified | Absolute No-Go Open | Should-Fix (backlog) | Self-Critique |
|------|---------------|-------------------|---------------------|----------------------|---------------|
| 1. Architecture | 0 | R9 carry | 0 | 2 (R8 carry) | ✅ hold |
| 2. Security | 0 | allowBackup=false | 0 | 0 | ✅ hold |
| 3. Visual/Theme | 0 | About clip + tip wrap | 0 | 1 (OSM hex) | ✅ device |
| 4. UX Simplicity | 0 | Ready BaseOnly honesty | 0 | 0 | ✅ device |
| 5. Translations | 0 | 913×11 + BaseOnly EN/DE | 0 | 0 | ✅ fresh |
| 6. E2E Proof | 0 | cancel + kill + Ready EN/DE adb | 0 | 0 | ✅ device |

| Gate | Result |
|------|--------|
| `exit_met` | **TRUE** — R9 Absolute No-Gos closed; scoped lenses proven |
| `visual_aaa` | **FALSE** — awaiting harsh critic ACCEPT (wow > 8.5) on R10 PNGs |
| AVD | **HELD** `emulator-5602` until `exit_met+visual_aaa` |
| Circuit breaker | reject #1 (R9); R10 re-armed for critic |

---

## Round 10 fixes (closes R9 REJECT)

| ID | Finding (R9 Absolute No-Go) | Fix | Proof |
|----|----------------------------|-----|-------|
| READY-HONESTY-01 | Green Ready claimed seamarks while pack not indexed | `readySummaryHintKey()` → `downloads.statusSummaryReadyHintBaseOnly` (all 11 locales) | EN/DE Ready screenshots: BaseOnly copy + Kieler pack |
| ABOUT-CLIP-01 | About subtitle trailing-comma clip under tab chrome | `SettingsMenuRow` `numberOfLines={3}` + `ellipsizeMode="tail"`; `Screen` tab-bar pad on scroll screens | `atlas-visual-r10-android-en-settings.png` full About line |
| PASSAGE-THEATRE-01 | en-passage was More-sheet twin | Activate live passage → active-leg HUD | `en-passage` md5 ≠ `en-more`; Leg 1 / BRG / ETA visible |
| MAP-TIP-01 | Offshore tip mid-crop `once…` | Shortened `map.downloadHint` | Map theatre shot without mid-crop tip |

---

## Visual pack (critic must re-read PNGs)

| Shot | Claim |
|------|-------|
| en-map | Kiel chart + SOG 6.5 kn / COG / GPS + SOS MOB |
| en-settings | About: full “Navigation disclaimer, map attribution, publisher, and app version” |
| en-downloads / seal-ready | Ready green + BaseOnly honesty + Kieler Bucht Ready for offline use |
| de-downloads-ready | Ready green + DE BaseOnly + Kieler Offline bereit |
| en-passage | Live HUD: New passage · Leg 1 of 1 · BRG/DISTANCE/ETA (not More) |
| cancel / kill | Mid-flight honesty (never Ready) |

MD5s: see `.cursor/atlas-farm/visual-ready-seacheck.json`.

---

## Per-lens evidence (this session)

### 4 — UX / Ready honesty
- EN: “Base chart tiles work offline in downloaded areas. Seamarks still need indexing on Wi‑Fi.”
- DE: “Basiskarten funktionieren offline in geladenen Gebieten. Seezeichen noch per WLAN indexieren.”

### 5 — Translations
- `i18n:parity`: **913 keys × 11 locales PASS** (new BaseOnly key).

### 6 — E2E Proof

| Flow | Result | Screenshot |
|------|--------|------------|
| release-cancel (`02a`) | 🟢 EXIT 0 | `atlas-r10-download-cancel-minimal.png` |
| release-kill (`03a`) | 🟢 EXIT 0 | `atlas-r10-download-kill-mid-release.png` |
| Ready EN BaseOnly | adb verified | `atlas-r10-download-seal-ready.png` |
| Ready DE BaseOnly | adb verified | `atlas-r10-download-seal-ready-de.png` |
| Passage activate | live HUD | `atlas-visual-r10-android-en-passage.png` |

APK: `versionName=0.1.9` / `versionCode=9` on `emulator-5602`.

---

## Open Conflicts

None.

## Blocking Questions

None for Android exit. iOS remains environment-gap (accepted).

## Residual risk

- iOS not run (environment gap).
- Visual AAA not yet critic-ACCEPTed — AVD **must stay locked**.
- Circuit: 1 reject so far; do not thrash same visual without new PNG proof.

## Exit condition

**`exit_met` = true** for Android scoped lenses + R9 Absolute No-Gos.  
**`visual_aaa` = false** until critic ACCEPT with **wow > 8.5**.  
Release AVD only after both (`release --kill-if-booted`).
