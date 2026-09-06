# SeaCheck QA Findings — Momos Audit

**Product:** SeaCheck Mobile (`seacheck-mobile` **0.1.5**, `versionCode` 5)  
**Audit date:** 2026-09-06 (UTC)  
**Auditor:** Momos (hostile QA / red-team / test architect)  
**Environment:** Native Jest on developer host — **no** Docker Compose for this app  
**Scope:** `nextcloud-dev/mobile/seacheck` only (standalone Expo client; **no** multi-user API)

Companion files: `risk-coverage-inventory.md`, `test-execution-log.md`.

---

## Executive Summary

**This system is not production-ready as a certified navigation product — and it never claimed to be ECDIS.** For a **store / functional auditor** of an offline chart companion: **conditionally yes after this pass**, with the residuals listed under Open and Low below.

What this engagement actually found and killed (not softened):

| Severity | Open after this engagement | Fixed this engagement (red → green) |
|----------|----------------------------|-------------------------------------|
| Critical | **0** | Corrupt AsyncStorage could **revive an anchor alarm** and mark it **triggered** via truthy strings (`Boolean("false") === true`) |
| High | **0** open code bugs; **1** intentional product residual called out below | `followMode` hydrate left a **truthy string** in settings state; `assertNetworkForDownload` could **hang forever** on stuck NetInfo; `patchSettings` accepted non-boolean garbage for safety toggles |
| Medium | BootGate optional offline hydrate can seal UI with empty packs (warning strip); ErrorBoundary Retry does not reset stores; Wi‑Fi NetInfo **throw** still offers cellular **confirm** (not silent allow) | `allowRouteEdits` hydrate used `!== false` (type-honest fix) |
| Low | Native MapLibre framebuffer pixels not Maestro-asserted; overall line coverage ~64%; hosted legal pages may lag repo HTML | Doc version / inventory drift corrected in these files |

**Fit for a real client or auditor today?**  
- **Store / privacy / functional:** yes, with residuals documented — Jest **151 / 708**, mutate:core **20/20**, Maestro cancel + kill **OK**, a11y + i18n green.  
- **ECDIS / SOLAS / “certified plotter”:** **no** — product truth (I1), not a missed unit test.

Lead finding before fixes: **anchor-alarm hydrate could invent a live, already-triggered alarm from corrupted storage.** That is the kind of bug that ends up on someone’s desk with the company name attached. It is fixed and mutation-locked.

---

## Step 0 — What this app is for (code-derived)

**Purpose:** Offline-first coastal navigation companion — OSM base + OpenSeaMap seamarks, GPS instruments, passage planning, tracks, anchor / XTE / arrival / MOB, Mayday clipboard. **Not** a certified chart plotter.

**Actors & stakes:**

| Actor | If wrong… |
|-------|-----------|
| Skipper underway | Blank “ready” charts, false/missed anchor alarm, camera/keep-awake wrong, delayed MOB |
| Dockside prep | Downloads hang, burn cellular, or lie Ready |
| Store / privacy auditor | Attribution lies, missing i18n on safety dialogs |

**Invariants under attack (subset — full list in inventory):**

1. Safety-relevant booleans hydrate only as real booleans (`parsePersistedBoolean` / strict typeof).  
2. Anchor alarm must not revive or false-trigger from corrupt JSON.  
3. At most one exclusive chart download; Ready only after durable seal.  
4. Download NetInfo must fail closed on disconnect **and** on hung NetInfo.  
5. Wi‑Fi-only: never silent-allow when NetInfo throws (confirm is allowed).  
6. Depth WMS allowlisted + online-gated; Mayday never invents a fresh fix.  
7. MapLibre User-Agent before first paint; tile probe not fail-open on placeholder/416.

---

## Critical

### [CRITICAL] [FIXED] Corrupt storage revived anchor alarm and set `triggered` from string `"false"`

**What is wrong (in plain words):**  
When the phone restored the “anchor watch” setting from disk, the code treated any truthy value as “alarm is on,” and used JavaScript’s `Boolean(...)` on the “already ringing” flag. The string `"false"` is truthy in JavaScript, so a corrupted save could turn the alarm **on** and mark it **already ringing**.

**Where exactly:**  
- File: `src/store/navigationStore.ts`, function `sanitizeAnchorAlarm` (was ~lines 103–116)  
- Workflow: app start → `hydrate()` → anchor alarm state restored  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
# Before fix (or with mutant anchor-alarm-truthy-active):
npx jest --coverage=false __tests__/anchorAlarmHydrate.test.ts
```
Observed before fix:
- `active: "false"` → alarm object with `active: true`  
- `triggered: "false"` → `triggered: true` (false alarm)

**What should happen instead:**  
Only a real boolean `active === true` may restore an alarm. Non-boolean `triggered` / `armedLimited` must become `false`, never `Boolean("false")`.

**Why this matters:**  
A skipper can get a phantom “you are dragging” alarm after an upgrade or storage glitch — or miss the meaning of a real alarm because the state machine is already “triggered.”

**Exact fix instructions:**  
1. Open `src/store/navigationStore.ts`.  
2. In `sanitizeAnchorAlarm`, replace `if (!a.active) return null` with  
   `if (typeof a.active !== 'boolean' || a.active !== true) return null`.  
3. Replace `triggered: Boolean(a.triggered)` with  
   `triggered: typeof a.triggered === 'boolean' ? a.triggered : false` (same for `armedLimited`).  
4. Run `__tests__/anchorAlarmHydrate.test.ts` — must be green.

**Proof this is fixed:**  
- Tests: `__tests__/anchorAlarmHydrate.test.ts` › revive / triggered cases  
- Mutations killed: `anchor-alarm-truthy-active`, `anchor-triggered-Boolean-coerce`  
- Red→green logged in `test-execution-log.md` (2026-09-06)

---

## High

### [HIGH] [FIXED] `followMode` hydrate skipped `parsePersistedBoolean`

**What is wrong (in plain words):**  
Almost every important on/off setting was restored with a strict “must be a real true/false” helper. **Follow ship on map** was not. Corrupt values like the string `"false"` or the number `1` were written straight into memory. A string is “truthy,” so the map kept following and keep-awake could stay on even when the stored intent was garbage.

**Where exactly:**  
- File: `src/store/settingsStore.ts`, hydrate `set({...})` — was  
  `followMode: parsed.followMode ?? CRUISE_PASSAGE_DEFAULTS.followMode`  
- Workflow: settings hydrate → Map follow / keep-awake  

**How to reproduce it (copy-paste steps):**  
```bash
cd nextcloud-dev/mobile/seacheck
npx jest --coverage=false __tests__/followModeHydrate.test.ts
```
Before fix: `followMode` state was literally `"false"` (string) or `1` (number).

**What should happen instead:**  
`followMode: parsePersistedBoolean(parsed.followMode, CRUISE_PASSAGE_DEFAULTS.followMode)` so state is always a real boolean (corrupt → cruise default `true`).

**Why this matters:**  
Broken follow/keep-awake behavior underway burns battery and moves the camera when the skipper thinks they turned follow off (or after corrupt migration).

**Exact fix instructions:**  
1. Open `src/store/settingsStore.ts`.  
2. Change the `followMode` hydrate line to use `parsePersistedBoolean` like neighboring booleans.  
3. Run `__tests__/followModeHydrate.test.ts` and `__tests__/settingsStore.booleanHydrate.test.ts`.

**Proof this is fixed:**  
- Tests above + mutation `followMode-loose-hydrate` killed  
- Red→green in `test-execution-log.md`

---

### [HIGH] [FIXED] `patchSettings` mass-assigned non-boolean garbage into safety toggles

**What is wrong (in plain words):**  
Any caller of `patchSettings` could pass a partial settings object and it was applied as-is. TypeScript helps at compile time, but at runtime a bad call could set `alarmSoundEnabled: "false"` (string). That string is truthy in `if (alarmSoundEnabled)` checks inconsistently, and it would be persisted back to disk.

**Where exactly:**  
- File: `src/store/settingsStore.ts`, `patchSettings`  
- Endpoint / workflow: Settings toggles → `patchSettings({ ... })`

**How to reproduce it (copy-paste steps):**  
```bash
npx jest --coverage=false -t 'patchSettings rejects non-boolean' __tests__/settingsStore.booleanHydrate.test.ts
```
Before fix: `alarmSoundEnabled` became the string `"false"`.

**What should happen instead:**  
Every known boolean key in the patch must run through `parsePersistedBoolean` against the current value (garbage → keep current).

**Why this matters:**  
Alarms, Wi‑Fi-only downloads, and onboarding flags are safety / policy controls. They must not become non-booleans in memory or on disk.

**Exact fix instructions:**  
1. In `patchSettings`, loop the boolean keys and coerce with `parsePersistedBoolean(next[key], current[key])` before `set(next)`.  
2. Re-run the boolean hydrate suite.

**Proof this is fixed:**  
- `__tests__/settingsStore.booleanHydrate.test.ts` › `patchSettings rejects non-boolean alarmSoundEnabled`

---

### [HIGH] [FIXED] Download NetInfo gate could hang forever

**What is wrong (in plain words):**  
Before starting a chart download, the app asked the OS “are we online?” with no time limit. If that call never came back, the download button sat forever with no clear failure.

**Where exactly:**  
- File: `src/lib/network/downloadNetwork.ts`, `assertNetworkForDownload`  
- Workflow: Downloads → start pack / custom download  

**How to reproduce it (copy-paste steps):**  
```bash
npx jest --coverage=false -t 'NetInfo.fetch never resolves' __tests__/downloadNetwork.test.ts
```
Before fix: promise never settled. After fix: rejects with the offline download error after ~4s.

**What should happen instead:**  
Use `fetchNetInfoState()` (4s timeout). On timeout or null → treat as offline and throw `downloads.errorOffline`.

**Why this matters:**  
Dockside prep looks “stuck”; users retry, force-kill, or leave half sessions — the exact class of download honesty bugs this app already fights elsewhere.

**Exact fix instructions:**  
1. Import `fetchNetInfoState` from `connectivity.ts`.  
2. Replace raw `NetInfo.fetch()` with `fetchNetInfoState()`.  
3. `if (!state || state.isConnected === false) throw ...`.

**Proof this is fixed:**  
- `__tests__/downloadNetwork.test.ts` › timeout fail-closed  
- Mutations: `download-offline-allowed`, `download-netinfo-timeout-fail-open` killed  

---

## Medium

### [MEDIUM] [OPEN] BootGate always leaves the spinner after `finally { setReady(true) }`

**What is wrong (in plain words):**  
After boot tasks finish (or fail), the splash/spinner always ends. Offline pack hydrate is optional: the UI can appear with a dismissible warning while packs are empty or wrong.

**Where exactly:**  
- File: `src/shell/BootGate.tsx` (optional boot tasks + `finally { setReady(true) }`)  
- Workflow: cold start  

**How to reproduce it (copy-paste steps):**  
Force offline hydrate failure in a unit/integration harness (or break AsyncStorage for pack index) and launch — UI seals; warning strip appears.

**What should happen instead:**  
Product choice: either hard-block map “Ready” claims until pack hydrate succeeds, or keep current UX but never show pack Ready badges when hydrate failed (already mostly true if index empty). Document the honesty contract in UI copy if keeping dismissible warning.

**Why this matters:**  
A hurried skipper can dismiss the strip and assume charts are present.

**Exact fix instructions:**  
1. Decide product policy with owners.  
2. If hard-fail: remove offline hydrate from `OPTIONAL_BOOT_TASKS` and surface `bootError`.  
3. If soft-fail: add an explicit non-dismissible “charts not loaded” until hydrate retry succeeds.  
4. Add a unit test that asserts the chosen contract.

**Proof this is fixed:**  
- Not fixed this pass — see Open Questions.

---

### [MEDIUM] [OPEN] ErrorBoundary Retry only clears React error state

**What is wrong (in plain words):**  
After a crash screen, Retry remounts children but does not reset download sessions, confirm queues, or corrupt store flags.

**Where exactly:**  
- File: `src/shell/ErrorBoundary.tsx` (reset handler)  
- Workflow: crash → Retry  

**How to reproduce it (copy-paste steps):**  
Throw inside a map child after a half-failed download; tap Retry — UI returns without draining coordinator.

**What should happen instead:**  
Retry should call a documented recovery: cancel exclusive download session, `cancelAllPendingConfirms`, clear transient UI error flags.

**Why this matters:**  
Stuck “downloading” chrome or confirm ghosts after a crash confuse the user and can block the next download (I3).

**Exact fix instructions:**  
1. Wire Retry to `downloadCoordinator` end + confirm cancel-all.  
2. Add a test that spies those calls on reset.  

**Proof this is fixed:**  
- Not fixed this pass.

---

### [MEDIUM] [FIXED] `allowRouteEdits` hydrate used `!== false`

**What is wrong (in plain words):**  
Route-edit lock restored with “anything except the boolean false means unlocked,” which disagrees with the strict boolean helper used elsewhere.

**Where exactly:**  
- File: `src/store/passageMapPlanningStore.ts` hydrate  

**How to reproduce it:**  
`npx jest --coverage=false __tests__/allowRouteEditsHydrate.test.ts`

**What should happen instead:**  
`parsePersistedBoolean(parsed.allowRouteEdits, true)`.

**Why this matters:**  
Lower stakes than alarms, but the same class of type corruption. Consistency prevents the next boolean from being “the one we forgot.”

**Exact fix instructions:**  
Use `parsePersistedBoolean` as above.

**Proof this is fixed:**  
- `__tests__/allowRouteEditsHydrate.test.ts` green  

---

### [MEDIUM] [DOCUMENTATION] Inventory claimed Wi‑Fi NetInfo throw is “fail-closed”

**What is wrong (in plain words):**  
Old inventory text said Wi‑Fi policy fail-closes when NetInfo throws. Code offers a **cellular confirm** dialog instead (user can proceed). That is not silent allow — but it is not hard fail-closed either.

**Where exactly:**  
- Doc: prior `risk-coverage-inventory.md`  
- Code: `src/lib/network/downloadPolicy.ts` catch → `cellularConfirm()`  

**What should happen instead:**  
Docs must say: throw → confirm; only explicit cancel denies. Silent `{ ok: true }` on catch is mutated and killed.

**Why this matters:**  
Auditors reading stale docs will accuse the team of lying about fail-closed policy.

**Exact fix instructions:**  
Inventory rewritten in this engagement (`risk-coverage-inventory.md`).

**Proof this is fixed:**  
- Doc rewrite; mutation `download-wifi-netinfo-fail-open` still killed  

---

## Low

### [LOW] [OPEN] Native map pixels / WMS framebuffer not asserted in Maestro

Maestro cancel/kill prove Ready honesty and session chrome, not “pixels painted.” Residual acceptance risk for visual blank-ocean regressions.

### [LOW] [OPEN] Overall coverage ~64% lines

Honest number from Jest coverage run — UI-heavy surfaces dominate the gap. Safety core is mutation-gated, not coverage-chased.

### [LOW] [OPEN] Vessel profile fields persist raw text; Mayday sanitizes at clipboard build only

CRLF in vessel name is stripped when building Mayday (`maydayMessage.ts`) but still stored. Low injection risk on a single-user device.

### [LOW] [OPEN] Hosted legal HTML may still lag repo `docs/play-store/publish/`

Ops redeploy question — local HTML fixed in prior passes.

---

## Documentation-vs-Code Mismatches (this pass)

| Claim | Reality |
|-------|---------|
| Findings / inventory said **v0.1.3** | Code is **0.1.5** / versionCode **5** |
| “Settings hydrate boolean honesty Covered” | Was **false** for `followMode` until this pass |
| “Mass assignment N/A” | Local `patchSettings` existed; now boolean-coerced |
| Wi‑Fi NetInfo throw “fail-closed” | Confirm path, not hard deny |

---

## Test Suite Quality Itself

| Gate | Result (2026-09-06) |
|------|---------------------|
| Jest | **151 suites / 708 tests** EXIT 0 |
| Typecheck | EXIT 0 |
| mutate:core | **20 killed / 0 survived** |
| a11y contrast + touch | PASS |
| i18n parity | **901 keys × 11 locales** PASS |
| Coverage | statements **61.69%**, branches **54.89%**, lines **64.44%** |
| Maestro cancel | OK (`emulator-5562`) |
| Maestro kill | OK (`emulator-5562`) |
| Skipped tests | **none** left silent |

New adversarial suites: `anchorAlarmHydrate`, `followModeHydrate`, `allowRouteEditsHydrate`, extended `settingsStore.booleanHydrate`, `downloadNetwork` timeout.

---

## Open Questions

1. Should BootGate **hard-fail** when offline pack hydrate fails, or is a dismissible warning the accepted product contract?  
2. On ErrorBoundary Retry, which stores/sessions must reset (download coordinator only, or navigation/confirm too)?  
3. Have hosted legal URLs been redeployed so CARTO claims cannot reappear for store reviewers?  
4. Are settings enums (`sogUnit`, `coordFormat`, …) intended to gain allowlist hydrate like booleans, or is `?? default` enough forever?
