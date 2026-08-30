# SeaCheck — Test Execution Log

All timestamps UTC. Host: developer workstation. App path: `nextcloud-dev/mobile/seacheck`.  
No Docker Compose for this app — commands run natively.

---

## 2026-08-30T10:01:41Z — Full Jest (pre-policy-fix baseline)

```
Command: npm test -- --no-coverage
Result: Test Suites: 123 passed, 123 total
        Tests:       590 passed, 590 total
```

---

## 2026-08-30T10:04:xxZ — downloadPolicy RED (adversarial tests vs old code)

```
Command: npm test -- --testPathPattern='downloadPolicy' --no-coverage
Result: FAIL — ensureDownloadAllowed returned bare `true` when NetInfo threw;
        offline path invoked cellular confirm expectations failed.
```

(See engagement transcript / Jest output: Expected `{ ok: false, reason: 'cancelled' }`, Received `true`.)

---

## 2026-08-30T10:04:06Z — Policy + reachability GREEN after fix

```
Command: npm test -- --testPathPattern='downloadPolicy|chartTileReachability|basemapMigration' --no-coverage
Result: Test Suites: 3 passed, 3 total
        Tests:       20 passed, 20 total
```

---

## 2026-08-30T10:04:06Z — a11y touch targets

```
Command: npm run a11y:touch
Result: Touch-target audit passed.
```

---

## 2026-08-30T10:05:xxZ — Mutation core (pre +2 policy mutants)

```
Command: npm run mutate:core
Result: 14 killed, 0 survived of 14
```

---

## 2026-08-30T10:08:21Z — Full Jest after fixes

```
Command: npm test -- --no-coverage
Result: Test Suites: 124 passed, 124 total
        Tests:       597 passed, 597 total
        Time:        13.12 s
```

Also:

```
Command: npm run a11y:contrast
Result: all PASS (WCAG contrast script)

Command: npm run i18n:parity
Result: PASS i18n parity (873 keys × 11 locales)
```

---

## 2026-08-30T10:10:41Z — Mutation core including downloadPolicy mutants

```
Command: npm run mutate:core
SeaCheck safety/offline core mutations
Baseline: PASS
Killed: gps-outlier-never-rejects
Killed: gps-gap-keeps-stale-baseline
Killed: safety-unknown-accuracy-ok
Killed: anchor-drag-ignores-accuracy
Killed: anchor-defer-gap-ignored
Killed: download-offline-allowed
Killed: download-wifi-netinfo-fail-open
Killed: download-wifi-offline-as-cellular
Killed: download-parallel-allowed
Killed: stale-callback-accepted
Killed: persist-index-accepts-arrays
Killed: tile-budget-disabled
Killed: mmsi-always-valid
Killed: mayday-invents-fresh
Killed: persist-bool-truthy-strings
Killed: online-ops-unknown-ok

Result: 16 killed, 0 survived of 16
```

---

## Live tile probes (manual, non-Jest)

```
curl -sI https://t1.openseamap.org/tile/12/2170/1310.png  → HTTP/2 200
curl -sI https://t2.openseamap.org/tile/12/2170/1310.png  → HTTP/2 200
curl -sI https://tiles.openseamap.org/seamark/12/2170/1310.png → HTTP/2 200
curl -sI -H 'Range: bytes=0-511' https://t1.openseamap.org/tile/10/540/327.png → HTTP/2 206
```

CARTO Voyager tile sample previously showed watermark text “API KEY REQUIRED” (basemap migration context).

---

## Not executed (explicit gaps)

- Device E2E kill-mid-download (Maestro/Detox) — not in CI; Jest process-death hydrate sims cover sweep + seal resume  
- Playwright/Axe on RN native UI — N/A; contrast + touch scripts used instead  
- Live load test against OpenSeaMap CDN — intentionally avoided (abuse)

---

## 2026-08-30 — Durable Ready + kill-mid-download resume

```
Command: npm run test:downloads
Result: 13 suites / 67 tests passed (includes offlinePackStore.durableDownload)

Command: npm test -- --no-coverage
Result: Test Suites: 125 passed, 125 total
        Tests:       602 passed, 602 total

Command: npm run i18n:parity
Result: PASS i18n parity (874 keys × 11 locales)

Changes:
- Ready requires OfflineManager.createPack seal after tile sweep
- Legacy ambient-only Ready demoted on hydrate
- Process-death resume for mid-sweep and mid-seal
- Play Store terms EN/DE aligned to AGPL-3.0-or-later
```
