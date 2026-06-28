import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useNavigationInstruments, formatCogDisplay } from '../../hooks/useNavigationInstruments';
import { magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatSog, formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { formatElapsedMs } from '../../lib/time/formatElapsed';
import { t } from '../../i18n';
import { useConfirmStore } from '../../store/confirmStore';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

/** Full-screen MOB navigate-back mode — hero bearing, distance, elapsed time. */
export function MobNavigateBackOverlay() {
  const { colors, spacing, minTouch } = useTheme();
  const { instrumentHeroSize } = useFormFactor();
  const insets = useSafeAreaInsets();
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const mobDroppedAtMs = useNavigationStore((s) => s.mobDroppedAtMs);
  const clearMob = useNavigationStore((s) => s.clearMob);
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const nav = useNavigationInstruments();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!mobDroppedAtMs) return;
    const tick = () => setElapsedMs(Date.now() - mobDroppedAtMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mobDroppedAtMs]);

  if (!mobTarget) return null;

  const stale = isFixStale(fix);
  const navFix = fix && !stale ? fix : lastGoodFix;
  const declination = navFix ? magneticDeclinationDeg(navFix.latitude, navFix.longitude) : 0;
  const brg = nav.bearingToTarget != null ? `${Math.round(nav.bearingToTarget)}° ${nav.bearingSuffix}` : '—';
  const dist =
    nav.distanceToTargetNm != null
      ? `${formatDistanceNm(nav.distanceToTargetNm, distanceUnit)} ${distanceUnitLabel(distanceUnit)}`
      : '—';
  const sog = !navFix || stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const cog = !navFix || stale ? '—' : formatCogDisplay(fix, bearingReference, declination);

  async function confirmClearMob() {
    const confirmed = await useConfirmStore.getState().requestConfirm({
      title: t('map.mobClearTitle'),
      message: t('map.mobClearBody'),
      confirmLabel: t('map.mobClearConfirm'),
      cancelLabel: t('common.dismiss'),
      destructive: true,
    });
    if (confirmed) await clearMob();
  }

  return (
    <View
      style={[styles.overlay, { backgroundColor: `${colors.dangerBg}F2`, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}
      testID="map.mobNavigateBack"
      accessibilityViewIsModal
    >
      <Text style={[styles.title, { color: colors.danger }]} accessibilityRole="header">
        {t('map.mobNavigateBackTitle')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('map.mobNavigateBackHint')}</Text>

      <View style={styles.heroRow}>
        <View style={[styles.heroCell, { borderColor: colors.dangerBorder }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{t('map.brgMob')}</Text>
          <Text style={[styles.heroValue, { color: colors.danger, fontSize: instrumentHeroSize + 12 }]}>{brg}</Text>
        </View>
        <View style={[styles.heroCell, { borderColor: colors.dangerBorder }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{t('map.distTo')}</Text>
          <Text style={[styles.heroValue, { color: colors.danger, fontSize: instrumentHeroSize + 12 }]}>{dist}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: colors.text }]}>
          {t('map.mobElapsed')}: {formatElapsedMs(elapsedMs)}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('map.sog')}: {sog} · {t('map.cog')}: {cog}
        </Text>
      </View>

      <Button
        label={t('map.mobClear')}
        variant="secondary"
        onPress={() => void confirmClearMob()}
        testID="map.mobClear"
        style={{ minHeight: minTouch, marginTop: spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 120,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  heroRow: { flexDirection: 'row', gap: 12 },
  heroCell: { flex: 1, borderWidth: 2, borderRadius: 16, padding: 16, alignItems: 'center' },
  heroLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  heroValue: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  metaRow: { marginTop: 20, gap: 6, alignItems: 'center' },
  meta: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
