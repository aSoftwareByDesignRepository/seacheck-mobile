import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { publishBackgroundLocationRunning } from '../lib/geo/backgroundLocationHealth';
import { reinforceLimitedForegroundSafetyNet } from '../lib/geo/limitedForegroundSafetyNet';
import { needsForegroundGpsWhileBackgrounded } from '../lib/geo/foregroundGpsDemand';
import { syncForegroundLocationWatch, needsUnifiedBackgroundGps } from '../lib/geo/syncForegroundLocationWatch';
import { subscribeMapScreenFocus } from '../lib/map/mapScreenFocus';
import { isBackgroundLocationRunning } from '../services/backgroundLocationService';
import { useLocationStore } from '../services/locationService';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageStore } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';

const SAFETY_WATCHDOG_MS = 5_000;

function needsSafetyLocationWatchdog(): boolean {
  if (needsUnifiedBackgroundGps()) return true;
  return needsForegroundGpsWhileBackgrounded();
}

/**
 * Adaptive foreground GPS — high accuracy on the map tab; idle elsewhere; paused when the
 * unified background task can supply fixes. Foreground-only safety scenarios keep navigation
 * accuracy when backgrounded (best-effort on Android).
 */
export function useAppLocationWatch() {
  const refreshPermission = useLocationStore((s) => s.refreshPermission);
  const permission = useLocationStore((s) => s.permission);

  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const goToTarget = useNavigationStore((s) => s.goToTarget);
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);

  const reconcileRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    reconcileRef.current = () => {
      void syncForegroundLocationWatch({ requestIfUndetermined: false });
    };
  }, [
    anchorAlarm?.active,
    backgroundTrackRecording,
    goToTarget,
    mobTarget,
    permission,
    recordingTrackId,
  ]);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (permission === 'denied') {
      useLocationStore.getState().stopWatching({ clearFixHistory: true });
      return;
    }
    reconcileRef.current();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshPermission().then(() => reconcileRef.current());
        return;
      }
      void reinforceLimitedForegroundSafetyNet().then(() => reconcileRef.current());
    });
    const unsubscribers = [
      useNavigationStore.subscribe(() => reconcileRef.current()),
      usePassageStore.subscribe(() => reconcileRef.current()),
      useTrackStore.subscribe(() => reconcileRef.current()),
      useSettingsStore.subscribe(() => reconcileRef.current()),
      subscribeMapScreenFocus(() => reconcileRef.current()),
    ];
    return () => {
      appStateSub.remove();
      for (const unsub of unsubscribers) unsub();
    };
  }, [permission, refreshPermission]);

  /** Detect native background task loss and keep limited foreground safety alive. */
  useEffect(() => {
    if (permission === 'denied') return;
    if (!needsSafetyLocationWatchdog()) return;

    let cancelled = false;
    let lastRunning: boolean | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const running = await isBackgroundLocationRunning();
        if (lastRunning === null) {
          lastRunning = running;
          if (!running) reconcileRef.current();
          return;
        }
        if (lastRunning !== running) {
          lastRunning = running;
          reconcileRef.current();
        }
      } catch {
        publishBackgroundLocationRunning(false);
        if (lastRunning !== false) {
          lastRunning = false;
          reconcileRef.current();
        }
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), SAFETY_WATCHDOG_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background' || state === 'inactive') {
        void tick();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [
    permission,
    anchorAlarm?.active,
    backgroundTrackRecording,
    goToTarget,
    mobTarget,
    recordingTrackId,
  ]);
}
