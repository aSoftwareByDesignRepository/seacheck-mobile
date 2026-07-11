import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { promiseWithTimeout } from '../lib/async/promiseWithTimeout';
import { t, applyLocalePreference, loadStoredLocale } from '../i18n';
import { useNavigationStore } from '../store/navigationStore';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { usePassageStore } from '../store/passageStore';
import { usePassageMapPlanningStore } from '../store/passageMapPlanningStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';
import { useWaypointStore } from '../store/waypointStore';
import { useTheme } from '../theme/ThemeContext';
import { OfflineMapBootstrap } from './OfflineMapBootstrap';

const OPTIONAL_BOOT_TASKS = new Set(['offline']);

const BOOT_CRITICAL_TIMEOUT_MS = 15_000;
const BOOT_OPTIONAL_TIMEOUT_MS = 22_000;
const BOOT_RECONCILE_TIMEOUT_MS = 8_000;

const BOOT_WARNING_KEYS: Record<string, string> = {
  offline: 'boot.partialWarningOffline',
  waypoints: 'boot.partialWarningWaypoints',
  passages: 'boot.partialWarningPassages',
  tracks: 'boot.partialWarningTracks',
  navigation: 'boot.partialWarningNavigation',
  locale: 'boot.partialWarningLocale',
  'navigation-reconcile': 'boot.partialWarningNavigation',
};

function bootWarningMessage(warnings: string[]): string {
  if (warnings.length === 1) {
    const key = BOOT_WARNING_KEYS[warnings[0]];
    if (key) return t(key as 'boot.partialWarningOffline');
  }
  const labels = warnings.map((w) => {
    const key = BOOT_WARNING_KEYS[w];
    return key ? t(key as 'boot.partialWarningOffline') : w;
  });
  return t('boot.partialWarningMultiple', { items: labels.join(' · ') });
}

async function runHydrateTask(name: string, run: () => Promise<void>, timeoutMs: number): Promise<void> {
  await promiseWithTimeout(run(), timeoutMs, `${name} hydrate`);
}

async function runStartupHydrate(): Promise<string[]> {
  const warnings: string[] = [];

  const tasks: { name: string; run: () => Promise<void>; timeoutMs: number }[] = [
    { name: 'settings', run: () => useSettingsStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'locale', run: () => loadStoredLocale().then(applyLocalePreference), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'offline', run: () => useOfflinePackStore.getState().hydrate(), timeoutMs: BOOT_OPTIONAL_TIMEOUT_MS },
    { name: 'waypoints', run: () => useWaypointStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'passages', run: () => usePassageStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'tracks', run: () => useTrackStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'navigation', run: () => useNavigationStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
    { name: 'passageMapPlanning', run: () => usePassageMapPlanningStore.getState().hydrate(), timeoutMs: BOOT_CRITICAL_TIMEOUT_MS },
  ];

  const results = await Promise.allSettled(
    tasks.map((task) => runHydrateTask(task.name, task.run, task.timeoutMs)),
  );
  if (results[0]?.status === 'rejected') {
    throw results[0].reason;
  }
  if (results[1]?.status === 'rejected') {
    throw results[1].reason;
  }
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const task = tasks[index];
      const optional = OPTIONAL_BOOT_TASKS.has(task.name);
      const log = optional ? console.warn : console.error;
      log(`[BootGate] ${task.name} hydrate failed`, result.reason);
      warnings.push(task.name);
    }
  });

  try {
    await promiseWithTimeout(
      (async () => {
        const nav = useNavigationStore.getState();
        if (nav.goToTarget?.kind === 'waypoint') {
          const exists = useWaypointStore.getState().items.some((w) => w.id === nav.goToTarget!.id);
          if (!exists) await nav.setGoTo(null);
        }
        const passageId = usePassageStore.getState().activePassageId;
        if (passageId) {
          const detail = await usePassageStore.getState().getPassageDetail(passageId);
          if (!detail || detail.waypoints.length < 2) {
            await usePassageStore.getState().deactivatePassage();
          } else {
            const legIdx = Math.min(nav.activeLegIndex, detail.legs.length - 1);
            const leg = detail.legs[legIdx];
            if (!nav.goToTarget) {
              await usePassageStore.getState().setPassageActiveLeg(legIdx);
            } else if (nav.goToTarget.kind === 'waypoint' && leg && nav.goToTarget.id !== leg.to.id) {
              await usePassageStore.getState().setPassageActiveLeg(legIdx);
            }
          }
        }

        const planning = usePassageMapPlanningStore.getState();
        if (planning.passageId) {
          const exists = usePassageStore.getState().passages.some((p) => p.id === planning.passageId);
          if (!exists) {
            planning.stopPlanning();
          } else if (planning.passageId === passageId && !planning.allowRouteEdits) {
            /* restored view-only session for active passage */
          } else if (planning.passageId === passageId && planning.allowRouteEdits) {
            planning.startPlanning(planning.passageId, { allowRouteEdits: false });
          }
        }
      })(),
      BOOT_RECONCILE_TIMEOUT_MS,
      'navigation reconcile',
    );
  } catch (error) {
    console.warn('[BootGate] navigation reconcile failed', error);
    warnings.push('navigation-reconcile');
  }

  const { ensureSeamarkIndexQueueListening } = await import('../lib/seamarks/seamarkIndexQueue');
  ensureSeamarkIndexQueueListening();

  if (!useOfflinePackStore.getState().hydrated) {
    await useOfflinePackStore.getState().ensureHydratedForUi();
    if (!warnings.includes('offline')) {
      warnings.push('offline');
    }
  }

  return warnings;
}

function startPostBootServices(): void {
  void import('../lib/permissions/initializeAppServices')
    .then(async ({ initializeAppServices }) => {
      if (useSettingsStore.getState().onboardingCompleted) {
        await initializeAppServices();
        return;
      }
      const { shouldRunBackgroundLocation } = await import('../lib/alarms/alarmCoordinator');
      if (await shouldRunBackgroundLocation()) {
        await initializeAppServices();
      }
    })
    .catch((error) => {
      console.warn('[BootGate] background services init failed', error);
    });
}

export function BootGate({ children }: PropsWithChildren) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [bootWarnings, setBootWarnings] = useState<string[]>([]);
  const [bootError, setBootError] = useState(false);
  const [warnDismissed, setWarnDismissed] = useState(false);

  const boot = useCallback(async () => {
    setBootError(false);
    setReady(false);
    try {
      const warnings = await runStartupHydrate();
      setBootWarnings(warnings);
    } catch (error) {
      console.error('[BootGate] startup failed', error);
      setBootError(true);
    } finally {
      setReady(true);
      startPostBootServices();
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!ready) {
    return (
      <View style={styles.root}>
        <OfflineMapBootstrap />
        <SafeAreaView style={[styles.boot, { backgroundColor: colors.background }]} accessibilityLabel={t('common.loading')}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.bootText, { color: colors.textMuted }]}>{t('boot.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (bootError) {
    return (
      <SafeAreaView style={[styles.boot, { backgroundColor: colors.background, padding: spacing.xl }]} accessibilityRole="alert">
        <Text style={[styles.bootTitle, { color: colors.text }]}>{t('boot.failedTitle')}</Text>
        <Text style={[styles.bootText, { color: colors.textMuted }]}>{t('boot.failedBody')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          onPress={() => void boot()}
          style={[styles.retryBtn, { backgroundColor: colors.primary, minHeight: minTouch }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryText }]}>{t('common.retry')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {bootWarnings.length > 0 && !warnDismissed ? (
        <View
          style={[
            styles.warnStrip,
            {
              backgroundColor: colors.warningBg,
              borderColor: colors.warningBorder,
              paddingTop: insets.top + spacing.sm,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.warnText, { color: colors.warningText, flex: 1 }]}>{bootWarningMessage(bootWarnings)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            accessibilityHint={t('boot.partialWarningDismissHint')}
            onPress={() => setWarnDismissed(true)}
            hitSlop={8}
            style={[styles.warnDismiss, { minHeight: minTouch, minWidth: minTouch, borderColor: colors.warningBorder }]}
            testID="boot.partialWarning.dismiss"
          >
            <Text style={[styles.warnDismissText, { color: colors.warningText }]} accessibilityElementsHidden importantForAccessibility="no">
              ×
            </Text>
          </Pressable>
        </View>
      ) : null}
      <OfflineMapBootstrap />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  bootText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryBtn: { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, justifyContent: 'center' },
  retryText: { fontSize: 16, fontWeight: '700' },
  warnStrip: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  warnDismiss: { borderLeftWidth: 1, marginVertical: -10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  warnDismissText: { fontSize: 22, fontWeight: '300', lineHeight: 24 },
});
