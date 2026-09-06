# SeaCheck — Test Execution Log (Momos 2026-09-06)

Raw command outputs from the Momos engagement. Times are UTC.

## 1. RED proof — followMode / anchor / route hydrates (before+after)

### 1a. Initial RED (followMode string/number) — 2026-09-06 ~17:33Z
```
FAIL __tests__/momosFollowMode.red.test.ts
  Momos followMode hydrate attack
    ✕ must not treat string "false" as follow ON (truthy string) (5 ms)
    ✕ must not treat numeric 1 as a valid followMode boolean (1 ms)

  ● Momos followMode hydrate attack › must not treat string "false" as follow ON (truthy string)

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: "false"

      16 |     (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: 'false' }));
      17 |     await useSettingsStore.getState().hydrate();
    > 18 |     expect(useSettingsStore.getState().followMode).toBe(false);
         |                                                    ^
      19 |   });
      20 |
      21 |   it('must not treat numeric 1 as a valid followMode boolean', async () => {

      at Object.toBe (__tests__/momosFollowMode.red.test.ts:18:52)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

  ● Momos followMode hydrate attack › must not treat numeric 1 as a valid followMode boolean

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: 1

      23 |     await useSettingsStore.getState().hydrate();
      24 |     // Default cruise followMode is true — corrupt number must fall back to default, not coerce
    > 25 |     expect(useSettingsStore.getState().followMode).toBe(true);
         |                                                    ^
      26 |     expect(typeof useSettingsStore.getState().followMode).toBe('boolean');
      27 |   });
      28 | });

      at Object.toBe (__tests__/momosFollowMode.red.test.ts:25:52)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

Test Suites: 1 failed, 1 total
Tests:       2 failed, 2 total
Snapshots:   0 total
Time:        0.799 s
Ran all test suites matching /__tests__\/momosFollowMode.red.test.ts/i.
```

### 1b. Combined RED (anchor + follow + route) — /tmp/momos-red3.log
```
    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: "false"

      16 |     (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ followMode: 'false' }));
      17 |     await useSettingsStore.getState().hydrate();
    > 18 |     expect(useSettingsStore.getState().followMode).toBe(false);
         |                                                    ^
      19 |   });
      20 |
      21 |   it('must not treat numeric 1 as a valid followMode boolean', async () => {

      at Object.toBe (__tests__/momosFollowMode.red.test.ts:18:52)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

  ● Momos followMode hydrate attack › must not treat numeric 1 as a valid followMode boolean

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: 1

      23 |     await useSettingsStore.getState().hydrate();
      24 |     // Default cruise followMode is true — corrupt number must fall back to default, not coerce
    > 25 |     expect(useSettingsStore.getState().followMode).toBe(true);
         |                                                    ^
      26 |     expect(typeof useSettingsStore.getState().followMode).toBe('boolean');
      27 |   });
      28 | });

      at Object.toBe (__tests__/momosFollowMode.red.test.ts:25:52)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

PASS __tests__/momosAllowRouteEdits.red.test.ts
FAIL __tests__/momosAnchorAlarm.red.test.ts
  ● Momos anchor alarm hydrate attack › must not revive an anchor alarm when active is string "false"

    expect(received).toBeNull()

    Received: {"active": true, "armedLimited": false, "latitude": 54.5, "longitude": 10.1, "radiusNm": 0.05, "triggered": false}

      30 |     );
      31 |     await useNavigationStore.getState().hydrate();
    > 32 |     expect(useNavigationStore.getState().anchorAlarm).toBeNull();
         |                                                       ^
      33 |   });
      34 |
      35 |   it('must not treat triggered string "false" as true (false alarm)', async () => {

      at Object.toBeNull (__tests__/momosAnchorAlarm.red.test.ts:32:55)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

  ● Momos anchor alarm hydrate attack › must not treat triggered string "false" as true (false alarm)

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      49 |     const alarm = useNavigationStore.getState().anchorAlarm;
      50 |     expect(alarm).not.toBeNull();
    > 51 |     expect(alarm!.triggered).toBe(false);
         |                              ^
      52 |     expect(typeof alarm!.triggered).toBe('boolean');
      53 |   });
      54 | });

      at Object.toBe (__tests__/momosAnchorAlarm.red.test.ts:51:30)
      at asyncGeneratorStep (node_modules/@babel/runtime/helpers/asyncToGenerator.js:3:17)
      at _next (node_modules/@babel/runtime/helpers/asyncToGenerator.js:17:9)

Test Suites: 2 failed, 1 passed, 3 total
Tests:       4 failed, 2 passed, 6 total
Snapshots:   0 total
Time:        0.808 s, estimated 1 s
Ran all test suites matching /__tests__\/momosAnchorAlarm.red.test.ts|__tests__\/momosAllowRouteEdits.red.test.ts|__tests__\/momosFollowMode.red.test.ts/i.
```

### 1c. GREEN after fixes — hydrate suites
```
PASS __tests__/momosFollowMode.red.test.ts
PASS __tests__/momosAnchorAlarm.red.test.ts
PASS __tests__/momosAllowRouteEdits.red.test.ts
PASS __tests__/passageMapPlanning.test.ts
PASS __tests__/settingsStore.booleanHydrate.test.ts

Test Suites: 5 passed, 5 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        2.356 s
Ran all test suites matching /__tests__\/momosFollowMode.red.test.ts|__tests__\/momosAnchorAlarm.red.test.ts|__tests__\/momosAllowRouteEdits.red.test.ts|__tests__\/settingsStore.booleanHydrate.test.ts|__tests__\/passageMapPlanning.test.ts/i.
```

## 2. Full Jest + typecheck — 2026-09-06T17:38:02Z
```
=== MOMOS EXECUTION 2026-09-06T17:38:02Z ===
--- typecheck ---
TSC_EXIT:0
--- jest ---
PASS __tests__/mapChromeLayout.test.ts
...
TSC_EXIT:0
Test Suites: 151 passed, 151 total
Tests:       707 passed, 707 total
Time:        11.264 s
JEST_EXIT:0
```

## 3. Mutation gauntlet #1 (19 mutants) — 2026-09-06T17:38:47Z
```
=== MUTATE 2026-09-06T17:38:47Z ===

> seacheck-mobile@0.1.5 mutate:core
> node scripts/run-safety-core-mutations.cjs

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
Killed: followMode-loose-hydrate
Killed: anchor-alarm-truthy-active
Killed: anchor-triggered-Boolean-coerce
Killed: online-ops-unknown-ok

Result: 19 killed, 0 survived of 19
MUTATE_EXIT:0
```

## 4. a11y + i18n
```
PASS 13.65:1 (min 4.5) text on light bg
PASS 14.64:1 (min 4.5) text on light card
PASS 5.18:1 (min 4.5) white on light primary
PASS 16.49:1 (min 4.5) text on dark bg
PASS 14.08:1 (min 4.5) text on dark card
PASS 7.36:1 (min 4.5) dark on dark primary
PASS 21.00:1 (min 4.5) high contrast text
PASS 19.56:1 (min 4.5) high contrast primary
PASS 5.67:1 (min 3) muted text on light bg
PASS 11.12:1 (min 3) muted text on dark bg
PASS 6.44:1 (min 4.5) danger button light
PASS 6.57:1 (min 4.5) danger button dark
PASS 6.42:1 (min 4.5) danger button high contrast
PASS 6.26:1 (min 4.5) warning text on light
PASS 9.84:1 (min 4.5) text on red night bg
PASS 5.42:1 (min 3) muted on red night bg
PASS 5.90:1 (min 4.5) primary text on red night primary
CONTRAST:0
PASS src/ui/Button.tsx
PASS src/ui/Screen.tsx
PASS src/ui/GlobalFeedback.tsx
PASS src/ui/BottomSheet.tsx
PASS src/ui/ActionSheet.tsx
PASS src/ui/SheetSection.tsx
PASS src/screens/OnboardingScreen.tsx
PASS src/ui/SettingsMenuRow.tsx
PASS src/screens/settings/SettingsDisplayScreen.tsx
PASS src/ui/PanelSidePicker.tsx
PASS src/screens/settings/SettingsMapScreen.tsx
PASS src/features/map/NavigationMap.tsx
PASS src/features/map/MapInstruments.tsx
PASS src/features/map/MapInstrumentDock.tsx
PASS src/features/map/InstrumentDockFrame.tsx
PASS src/features/map/InstrumentCoordsLine.tsx
PASS src/features/map/MapActions.tsx
PASS src/features/map/MapBottomPanelFrame.tsx
PASS src/features/map/MapBottomDock.tsx
PASS src/features/map/ScreenLockOverlay.tsx
PASS src/features/map/GpsStatusStrip.tsx
PASS src/features/map/MapTopAlertBanner.tsx
PASS src/features/map/AnchorLimitedBanner.tsx
PASS src/features/map/MapTopChrome.tsx
PASS src/features/map/MobNavigateBackOverlay.tsx
PASS src/features/map/MapPreviewTrackBanner.tsx
PASS src/features/map/PassageInstrumentBlock.tsx
PASS src/features/map/MapRecordingChip.tsx
PASS src/navigation/AdaptiveTabBar.tsx
PASS src/ui/CoordinateBlock.tsx
PASS src/features/downloads/RegionPackMapPreview.tsx
PASS src/features/downloads/CustomDownloadSection.tsx
PASS src/features/downloads/CustomDownloadMapPanel.tsx
PASS src/features/downloads/RegionPackCard.tsx
PASS src/features/downloads/CollapsibleDownloadsSection.tsx
PASS src/features/downloads/CustomPackCard.tsx
PASS src/features/downloads/LegacyPackCard.tsx
PASS src/screens/DownloadsScreen.tsx
PASS src/screens/TracksScreen.tsx
PASS src/features/tracks/TrackDetailPanel.tsx
PASS src/ui/ToggleRow.tsx
PASS src/features/passage/PassageListCard.tsx
PASS src/features/passage/PassageDeactivateButton.tsx
PASS src/screens/passage/PassageDetailScreen.tsx
PASS src/features/passage/PassageMapPreviewPanel.tsx
PASS src/features/passage/PassageCoverageCard.tsx
PASS src/features/passage/PassagePackSuggestionRow.tsx
PASS src/features/passage/PassageWaypointSection.tsx
PASS src/features/passage/PassageMetaSection.tsx
PASS src/features/passage/PassageMapPlanningPanel.tsx
PASS src/features/passage/PassageMapPlanningGuideBanner.tsx
PASS src/ui/FilterChip.tsx
PASS src/ui/InstrumentCell.tsx
Touch-target audit passed.
TOUCH:0
PASS i18n parity (901 keys × 11 locales)
I18N:0
```

## 5. Coverage summary
```
=============================== Coverage summary ===============================
Statements   : 61.69% ( 3781/6129 )
Branches     : 54.89% ( 2259/4115 )
Functions    : 62.85% ( 792/1260 )
Lines        : 64.44% ( 3422/5310 )
================================================================================

```

## 6. downloadNetwork timeout GREEN
```
PASS __tests__/downloadNetwork.test.ts
  assertNetworkForDownload
    ✓ allows connected network with unknown reachability (3 ms)
    ✓ blocks when disconnected (2 ms)
    ✓ blocks when NetInfo.fetch never resolves (timeout fail-closed) (4 ms)
    ✓ allows connected network when reachability probe failed
  assertChartDownloadNetworkReady
    ✓ runs NetInfo and tile reachability checks
    ✓ skips tile probe when offline

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        0.929 s, estimated 1 s
Ran all test suites matching /__tests__\/downloadNetwork.test.ts/i.
```

## 7. Final gates — 2026-09-06T17:43:10Z (708 tests, 20 mutations)
```
=== FINAL GATES 2026-09-06T17:43:10Z ===
TSC:0
PASS __tests__/offlinePackStore.durableDownload.test.ts (7.957 s)
PASS __tests__/chartTileReachability.test.ts (9.098 s)

Test Suites: 151 passed, 151 total
Tests:       708 passed, 708 total
Snapshots:   0 total
Time:        9.695 s, estimated 13 s
Ran all test suites.
JEST:0

> seacheck-mobile@0.1.5 mutate:core
> node scripts/run-safety-core-mutations.cjs

SeaCheck safety/offline core mutations
Baseline: PASS
Killed: gps-outlier-never-rejects
Killed: gps-gap-keeps-stale-baseline
Killed: safety-unknown-accuracy-ok
Killed: anchor-drag-ignores-accuracy
Killed: anchor-defer-gap-ignored
Killed: download-offline-allowed
Killed: download-netinfo-timeout-fail-open
Killed: download-wifi-netinfo-fail-open
Killed: download-wifi-offline-as-cellular
Killed: download-parallel-allowed
Killed: stale-callback-accepted
Killed: persist-index-accepts-arrays
Killed: tile-budget-disabled
Killed: mmsi-always-valid
Killed: mayday-invents-fresh
Killed: persist-bool-truthy-strings
Killed: followMode-loose-hydrate
Killed: anchor-alarm-truthy-active
Killed: anchor-triggered-Boolean-coerce
Killed: online-ops-unknown-ok

Result: 20 killed, 0 survived of 20
MUT:0
  Tap on id: tab.more... COMPLETED
```

## 8. Maestro cancel — emulator-5562
```
  Assert that id: tab.more.sheet is visible... COMPLETED
  Tap on id: tab.downloads... COMPLETED
  Assert that id: screen.downloads is visible... COMPLETED
  Wait for animation to end within 30000 ms... COMPLETED
Run 01b-open-downloads.yaml... COMPLETED
Tap on (Optional) id: confirm.proceed... WARNED


 Warning: Element not found: Id matching regex: confirm.proceed
Tap on (Optional) id: downloadFailure.dismiss... WARNED


 Warning: Element not found: Id matching regex: downloadFailure.dismiss
Scrolling DOWN until id: downloads.download.kiel-bay is visible with speed 40, visibility percentage 100%, timeout 30000 ms, with centering disabled... COMPLETED
Tap on id: downloads.download.kiel-bay... COMPLETED
Tap on (Optional) id: confirm.proceed... WARNED


 Warning: Element not found: Id matching regex: confirm.proceed
Assert that id: downloads\.statusBanner\.active|downloads\.cancel\.kiel-bay|downloads\.globalSessionChrome is visible... COMPLETED
Assert that id: downloads.statusBanner.ready is not visible... COMPLETED
Tap on (Optional) id: downloads.statusBanner.cancel... WARNED


 Warning: Element not found: Id matching regex: downloads.statusBanner.cancel
Tap on (Optional) id: downloads.cancel.kiel-bay... COMPLETED
Tap on (Optional) id: downloads.globalSessionChrome.cancel... WARNED


 Warning: Element not found: Id matching regex: downloads.globalSessionChrome.cancel
Assert that id: downloads\.statusBanner\.active|downloads\.cancel\.kiel-bay|downloads\.globalSessionChrome is not visible... COMPLETED
Assert that (Optional) id: downloads.statusBanner.completing is not visible... COMPLETED
Tap on (Optional) id: downloadFailure.dismiss... WARNED


 Warning: Element not found: Id matching regex: downloadFailure.dismiss
Assert that id: downloads.statusBanner.ready is not visible... COMPLETED
Take screenshot download-cancel-mid... COMPLETED
==> OK
==> re-enabled rival packages
```

## 9. Maestro kill — emulator-5562
```
  Tap on (Optional) id: onboarding.disclaimer.continue... WARNED
  Tap on (Optional) id: onboarding.location.skip... WARNED
  Tap on (Optional) id: onboarding.battery.ack... WARNED
  Tap on (Optional) id: onboarding.finish... WARNED
  Tap on (Optional) "Allow"... WARNED
  Tap on (Optional) "While using the app"... WARNED
  Tap on (Optional) "Allow only while using the app"... WARNED
  Assert that id: tab.map is visible... COMPLETED
Run 01-onboarding-skip.yaml... COMPLETED
Run 01b-open-downloads.yaml...
  Tap on id: tab.more... COMPLETED
  Assert that id: tab.more.sheet is visible... COMPLETED
  Tap on id: tab.downloads... COMPLETED
  Assert that id: screen.downloads is visible... COMPLETED
  Wait for animation to end within 30000 ms... COMPLETED
Run 01b-open-downloads.yaml... COMPLETED
Wait for animation to end within 5000 ms... COMPLETED
Tap on (Optional) id: downloadFailure.dismiss... WARNED


 Warning: Element not found: Id matching regex: downloadFailure.dismiss
Assert that id: downloads.statusBanner.ready is not visible... COMPLETED
Take screenshot download-kill-mid... COMPLETED
==> OK
==> re-enabled rival packages
```
