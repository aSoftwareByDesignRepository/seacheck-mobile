import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { t } from '../i18n';
import { applyLocalePreference, loadStoredLocale } from '../i18n';
import { useNavigationStore } from '../store/navigationStore';
import { useOfflinePackStore } from '../store/offlinePackStore';
import { usePassageStore } from '../store/passageStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';
import { useWaypointStore } from '../store/waypointStore';
import { useTheme } from '../theme/ThemeContext';
import { ensureChartStyleFile } from '../map/chartStyle';

export function BootGate({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.all([
        useSettingsStore.getState().hydrate(),
        loadStoredLocale().then(applyLocalePreference),
        ensureChartStyleFile().then((uri) => {
          useOfflinePackStore.setState({ chartStyleUri: uri });
        }),
        useOfflinePackStore.getState().hydrate(),
        useWaypointStore.getState().hydrate(),
        usePassageStore.getState().hydrate(),
        useTrackStore.getState().hydrate(),
        useNavigationStore.getState().hydrate(),
        import('../services/barometerService').then((m) => m.hydrateBarometer()),
      ]);
      const passageId = usePassageStore.getState().activePassageId;
      const nav = useNavigationStore.getState();
      if (passageId) {
        if (!nav.legTimerStartedAtMs) await nav.resetLegTimer();
        if (!nav.goToTarget) {
          await usePassageStore.getState().setPassageActiveLeg(nav.activeLegIndex, { resetTimer: false });
        }
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.background }]} accessibilityLabel={t('common.loading')}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
