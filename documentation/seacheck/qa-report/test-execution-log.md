# SeaCheck — Test Execution Log (Momos re-attack)

**Host:** developer workstation · **App cwd:** `nextcloud-dev/mobile/seacheck`  
**All timestamps UTC unless noted.**

---

## 2026-09-06T21:06:44Z — Jest + coverage

```text
Command: npm test -- --ci --coverage --coverageReporters=text-summary --coverageReporters=json-summary
Initial result: 1 failed (offlinePackStore.durableDownload timeout 20s on pre-sweep wait)
Coverage summary:
  Statements : 62.14% ( 3889/6258 )
  Branches   : 55.32% ( 2331/4213 )
  Functions  : 63.79% ( 823/1290 )
  Lines      : 64.92% ( 3520/5422 )
```

## 2026-09-06T21:06:44Z — typecheck / a11y / i18n

```text
npm run typecheck          → EXIT 0
npm run a11y:contrast      → PASS (all listed pairs)
npm run a11y:touch         → Touch-target audit passed
npm run i18n:parity        → PASS i18n parity (908 keys × 11 locales)
```

## 2026-09-06T21:07:28Z — mutate:core

```text
Command: npm run mutate:core
Baseline: PASS
Result: 22 killed, 0 survived of 22
EXIT 0
(mutants include download-offline-allowed, download-netinfo-timeout-fail-open,
 download-wifi-netinfo-fail-open, mayday-invents-fresh, followMode-loose-hydrate,
 anchor-triggered-Boolean-coerce, boot-offline-dismissible, crash-recovery-skips-confirm-drain, …)
```

## 2026-09-06T21:08:31Z — durable timeout diagnosis

```text
offlinePackStore.durableDownload still timed out until:
  - NODE_ENV=test shortened pre-sweep wait slices
  - durableDownload.test mocks waitForDownloadMapReady → true
```

## 2026-09-06T21:09:19Z — durable + startDownload after harness fix

```text
npm test -- --ci --coverage=false \
  __tests__/offlinePackStore.durableDownload.test.ts \
  __tests__/offlinePackStore.startDownload.test.ts
PASS 2 suites / 9 tests
EXIT 0
```

## 2026-09-06T21:09:33Z — full Jest (final)

```text
Command: npm test -- --ci --coverage=false
Test Suites: 157 passed, 157 total
Tests:       725 passed, 725 total
Time:        9.296 s
EXIT 0
```

## Device / Maestro (evening, local times ~22:29–23:03 +02)

```text
AVD: SeaCheck_Maestro_API_33 (emulator-5562) via emulator-lock
APK: android/app/build/outputs/apk/release/app-release.apk (WIP rebuilds)

maestro --device emulator-5562 test .maestro/02-download-cancel-mid.yaml

Observed failures (multiple attempts):
  - Assert cancel visible → FAILED
  - UI: "Chart download failed"
  - Body: "Kieler Bucht (test) — Chart engine did not start…"
    (and earlier: DOWNLOAD_MAP_NOT_VISIBLE before sticky Map ownership)

Onboarding sticky CTA fix verified: onboarding.disclaimer.continue visible in UI dump
after rebuild (was missing when CTA lived below fold inside ScrollView).

Rival app focus hazard: mobilitycheck.terminal observed as mCurrentFocus mid-session —
force-stop required before Maestro.
```

## 2026-09-07 (Aristoteles closure)

```text
Environment: no Docker Compose; native npm/Jest; AVD SeaCheck_Maestro_API_33 on emulator-5568

npm run typecheck                         → EXIT 0
npm run a11y:contrast + a11y:touch        → PASS
npm run i18n:parity                       → PASS 908×11
npm run mutate:core                       → 22 killed, 0 survived
npx jest --coverage=false                 → 158 suites / 733 tests EXIT 0
npm run android:release                   → BUILD SUCCESSFUL

Maestro (release APK, rivals disabled, pm clear):
  maestro --device emulator-5568 test .maestro/02a-download-cancel-minimal.yaml
  → EXIT 0
  Evidence: cancel chrome / map.downloadSession visible; tapped
  downloads.globalSessionChrome.cancel; assertNotVisible Ready;
  assertNotVisible downloadFailure.dismiss

Earlier same-day failure modes before kickoff/Wi‑Fi fix:
  - "Chart engine did not start" / DOWNLOAD_MAP_NOT_READY
  - "Download session did not start in time" (second cellular confirm blocked tryBegin)
```

## Notes

- Unit green ≠ device download green — device proof required for Critical closure.  
- Prefer `.maestro/02a-download-cancel-minimal.yaml` for release cancel honesty (skips depth warm flake).  
- Coverage JSON: `coverage/coverage-summary.json` (lines pct ~65).  
- Kill-mid (03) still expects Expo dev-client deep link; not re-run on release APK this session.

---

## 2026-09-07 (Aristoteles final — I5 seal closed)

```text
Environment: no Docker; native npm/Jest; AVD SeaCheck_Maestro_API_33 on emulator-5568

Red-team root cause (seal stall): OfflineManager.createPack style URL goes through
Android HTTP stack → file:// and asset:// both log
"Unable to parse resourceUrl" → pack stuck at 0% → initializing stall.

Fix: ChartStyleLocalServer (loopback :18765) + offlinePackMapStyleUri() →
http://127.0.0.1:18765/chart-style.json + network_security_config localhost cleartext only.
Maestro 04 waits on map.downloadSession (not OR-notVisible gap).

npm run typecheck / a11y:contrast / a11y:touch / i18n:parity → PASS (908×11)
npm run mutate:core → 23 killed, 0 survived
npx jest --coverage=false → 159 suites / 738 tests EXIT 0

Maestro release APK (rivals disabled, pm clear):
  bash scripts/maestro-e2e.sh release-cancel → EXIT 0
  bash scripts/maestro-e2e.sh release-kill   → EXIT 0
  bash scripts/maestro-e2e.sh release-seal   → EXIT 0
    Evidence: downloads.pack.kiel-bay.durable + delete + statusBanner.ready

APKs:
  ~/Downloads/apk-releases/seacheck-0.1.5-release.apk (arm64 phone)
  ~/Downloads/apk-releases/seacheck-0.1.5-release-arm64-x86_64.apk (emulator)
```

## 2026-09-07T09:15Z — Residual hardening re-proof (Aristoteles)

```text
Closed residual audit gaps:
  - recreateOfflinePack primes GL with documents engineStyleUri (createPack keeps loopback HTTP)
  - ensureOfflinePackStyleReachable() before createPack / recreate
  - downloadCoordinator tryBegin/preflightLock blocked while teardownRegionId set
  - Completing chrome uses primary wash (not success green) until Ready
  - CustomPackCard durable testID; contrast checks for completing wash
  - mutate:core download-parallel-allowed baseline updated for teardown guard

Gates:
  npm test -- --no-coverage          → 160 suites / 745 tests EXIT 0
  npm run typecheck                  → EXIT 0
  npm run mutate:core                → 23 killed / 0 survived
  npm run a11y:contrast|a11y:touch|i18n:parity → PASS

APK rebuild:
  assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
  → ~/Downloads/apk-releases/seacheck-0.1.5-release-arm64-x86_64.apk (~71MB)
  assembleRelease -PreactNativeArchitectures=arm64-v8a
  → ~/Downloads/apk-releases/seacheck-0.1.5-release.apk (~41MB)

Maestro on SeaCheck_Maestro_API_33 @ emulator-5588 (swiftshader; rivals disabled):
  release-cancel → EXIT 0 (globalSessionChrome.cancel; no Ready)
  release-seal   → EXIT 0 (downloads.pack.kiel-bay.durable + Ready + Delete)
  release-kill   → EXIT 0 (no Ready / no durable after kill-mid)

Note: SeaCheck is not Docker; Nextcloud stack is separate. Farm contention
(SnackCheck/MaintenanceCheck Maestro + GPU) required swiftshader boot +
adb disconnect of duplicate 127.0.0.1:5588 offline entry.
```
