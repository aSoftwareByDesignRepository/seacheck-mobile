#!/usr/bin/env node
/**
 * Static touch-target audit.
 * Ensures interactive UI primitives declare minHeight >= 48 or use theme minTouch.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = [
  'src/ui/Button.tsx',
  'src/ui/Screen.tsx',
  'src/ui/GlobalFeedback.tsx',
  'src/ui/BottomSheet.tsx',
  'src/ui/ActionSheet.tsx',
  'src/ui/SheetSection.tsx',
  'src/screens/OnboardingScreen.tsx',
  'src/screens/SettingsScreen.tsx',
  'src/features/map/NavigationMap.tsx',
  'src/features/map/MapInstruments.tsx',
  'src/features/map/MapChrome.tsx',
  'src/features/map/MapActions.tsx',
  'src/features/map/MapBottomDock.tsx',
  'src/features/map/ScreenLockOverlay.tsx',
  'src/features/map/GpsStatusStrip.tsx',
  'src/features/map/MapTopAlertBanner.tsx',
  'src/features/map/MapTopChrome.tsx',
  'src/features/map/MobNavigateBackOverlay.tsx',
  'src/features/map/MapPreviewTrackBanner.tsx',
  'src/navigation/AdaptiveTabBar.tsx',
  'src/features/waypoints/WaypointDetailPanel.tsx',
  'src/ui/CoordinateBlock.tsx',
  'src/features/downloads/RegionPackMapPreview.tsx',
  'src/features/downloads/CustomDownloadSection.tsx',
  'src/features/downloads/CustomDownloadMapPanel.tsx',
  'src/features/downloads/RegionPackCard.tsx',
  'src/screens/DownloadsScreen.tsx',
  'src/screens/WaypointsScreen.tsx',
  'src/screens/TracksScreen.tsx',
  'src/features/tracks/TrackDetailPanel.tsx',
  'src/features/passage/UtcDeparturePickerModal.tsx',
  'src/ui/ToggleRow.tsx',
  'src/screens/PassageScreen.tsx',
  'src/features/passage/PassageCoverageCard.tsx',
  'src/features/passage/PassageWaypointSection.tsx',
  'src/features/passage/PassageLegTable.tsx',
  'src/features/passage/PassageEditorPanel.tsx',
  'src/features/passage/PassageMetaSection.tsx',
  'src/features/passage/PassageMapPreview.tsx',
  'src/features/racing/StartLineSection.tsx',
  'src/features/racing/RacePackSection.tsx',
  'src/features/racing/RaceCountdownBanner.tsx',
  'src/ui/FilterChip.tsx',
  'src/ui/InstrumentCell.tsx',
];

let fail = 0;

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`FAIL ${rel}: file missing`);
    fail += 1;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  const ok =
    /minHeight:\s*48/.test(src) ||
    /minHeight:\s*minTouch/.test(src) ||
    /minTouch/.test(src);
  if (!ok) {
    console.error(`FAIL ${rel}: missing minHeight 48 or minTouch`);
    fail += 1;
  } else {
    console.log(`PASS ${rel}`);
  }
}

if (fail > 0) {
  process.exit(1);
}

console.log('Touch-target audit passed.');
