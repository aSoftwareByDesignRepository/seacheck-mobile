# SeaCheck — Test Execution Log (Momos re-audit)

All timestamps UTC. Host: developer workstation. App path: `nextcloud-dev/mobile/seacheck`.  
No Docker Compose for this app — commands run natively.

---

## 2026-08-30T13:42:41Z — Engagement start

```
git log -5 --oneline
b79d7b3 Harden optional depth overlay for safe opt-in use.
ce89de6 Note optional depth WMS in Play Data Safety copy.
7f886d7 Add optional online OpenSeaMap/GEBCO depth overlay.
c87713e Seal offline packs with OfflineManager and close QA High gaps.
dc072b6 Repo hygiene, feedback UX, CSS cleanup, and l10n alignment
## main...origin/main (clean)
```

Environment: no `docker-compose.yml` in app root.

---

## 2026-08-30T13:45:xxZ — Full Jest baseline (pre-honesty-fixes)

```
Command: npm test -- --no-coverage --forceExit
Result: Test Suites: 127 passed, 127 total
        Tests:       608 passed, 608 total
```

(Timer leak warnings from offlinePackStore suites — non-fatal with --forceExit.)

---

## 2026-08-30T13:46:xxZ — a11y + i18n

```
Command: npm run a11y:contrast
Result: PASS (all listed pairs)

Command: npm run a11y:touch
Result: Touch-target audit passed.

Command: npm run i18n:parity
Result: PASS i18n parity (891 keys × 11 locales)
```

---

## 2026-08-30T13:47:xxZ — Mutation core

```
Command: npm run mutate:core
Result: 16 killed, 0 survived of 16
```

Includes: `download-wifi-netinfo-fail-open`, `download-wifi-offline-as-cellular`, GPS/anchor mutants, download exclusivity.

---

## 2026-08-30T13:48:xxZ — RED: downloadWifiOnly corrupt hydrate

```
Command: npx jest __tests__/settingsStore.downloadWifiOnly.test.ts --forceExit
Result: FAIL
  Expected: true
  Received: 0
  Received: "false"
```

Proves `parsed.downloadWifiOnly ?? true` keeps falsy non-booleans.

---

## 2026-08-30T13:50:xxZ — GREEN after honesty fixes

Fixes landed:
- `parsePersistedBoolean(parsed.downloadWifiOnly, true)`
- cancel seal race (no Ready restore for cache:* UI + native index)
- sweep-complete → seal-pending reattach
- `useOnlineLayersAllowed` for depth
- `handleDownloadAll` counts only `state === 'ready'`

```
Command: npx jest __tests__/settingsStore.downloadWifiOnly.test.ts __tests__/offlinePackStore.durableDownload.test.ts --forceExit
Result: PASS — 10 tests

Command: npm test -- --no-coverage --forceExit
Result: Test Suites: 128 passed, 128 total
        Tests:       613 passed, 613 total
```

---

## Live depth WMS probes (manual)

```
GEBCO GWC GetMap Kiel-ish bbox → HTTP/2 200, geowebcache-cache-result: HIT
depth.openseamap.org tracks_100m → HTTP/2 200 image/png
```

---

## Not executed (explicit gaps)

- Device E2E kill-mid-download (Maestro/Detox) — Jest sims only  
- Native MapLibre WMS visual render on device  
- Playwright/Axe on RN — N/A; contrast + touch scripts used  
- Live load test against OpenSeaMap CDN — intentionally avoided  

---

## 2026-08-30T14:05:xxZ — Limited-anchor + residual gaps

Fixes landed:
- Persist `anchorAlarm.armedLimited`; non-dismissible banner / warning FAB / instrument / settings
- Overpass tap lat/lon in privacy EN/DE + Data Safety
- README publisher HTTPS
- `storageCheck` fail-closed; downloads blocked with unavailable error
- ConfirmSheet unmount fail-closes hung `requestConfirm`
- Offline pack hydrate single-flight mutex

```
Command: npm test -- --forceExit
Result: Test Suites: 129 passed, 129 total
        Tests:       618 passed, 618 total

Command: npm run i18n:parity
Result: PASS i18n parity (898 keys × 11 locales)

Command: npm run a11y:contrast && npm run a11y:touch
Result: PASS

Command: npm run mutate:core
Result: 16 killed, 0 survived of 16
```  
