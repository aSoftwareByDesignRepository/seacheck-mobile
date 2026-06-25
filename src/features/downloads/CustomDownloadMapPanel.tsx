import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ensureDownloadAllowed } from '../../lib/network/downloadPolicy';
import { validateDownloadBounds } from '../../lib/map/bounds';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { t } from '../../i18n';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';

export function CustomDownloadMapPanel() {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const cornerA = useCustomDownloadStore((s) => s.cornerA);
  const cornerB = useCustomDownloadStore((s) => s.cornerB);
  const minZoom = useCustomDownloadStore((s) => s.minZoom);
  const maxZoom = useCustomDownloadStore((s) => s.maxZoom);
  const packName = useCustomDownloadStore((s) => s.packName);
  const getBounds = useCustomDownloadStore((s) => s.getBounds);
  const resetCorners = useCustomDownloadStore((s) => s.resetCorners);
  const setZoomRange = useCustomDownloadStore((s) => s.setZoomRange);
  const cancelSelecting = useCustomDownloadStore((s) => s.cancelSelecting);
  const startCustomDownload = useOfflinePackStore((s) => s.startCustomDownload);
  const showError = useFeedbackStore((s) => s.showError);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [busy, setBusy] = useState(false);

  const bounds = getBounds();
  const validation = bounds ? validateDownloadBounds(bounds, minZoom, maxZoom) : null;
  const estimate =
    validation?.ok === true
      ? formatStorageSize(estimateDownloadKb(validation.tileCount))
      : bounds
        ? formatStorageSize(estimateDownloadKb(estimateTileCount(bounds, minZoom, maxZoom)))
        : null;

  const stepHint = useMemo(() => {
    if (!cornerA) return t('downloads.customStepOne');
    if (!cornerB) return t('downloads.customStepTwo');
    return t('downloads.customStepConfirm');
  }, [cornerA, cornerB]);

  async function handleDownload() {
    if (!bounds || !validation?.ok) {
      const code = validation && !validation.ok ? validation.code : 'too_small';
      showError(t(`downloads.customInvalid.${code}` as 'downloads.customInvalid.too_small'));
      return;
    }
    setBusy(true);
    try {
      const allowed = await ensureDownloadAllowed();
      if (!allowed) {
        showInfo(t('downloads.cellularCancelledBody'));
        return;
      }
      const name = packName.trim() || t('downloads.customDefaultName', { lat: bounds[1].toFixed(2), lon: bounds[0].toFixed(2) });
      await startCustomDownload(name, bounds, minZoom, maxZoom);
      cancelSelecting();
      showInfo(t('downloads.customStartedBody'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      testID="downloads.custom.mapPanel"
    >
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('downloads.customMapTitle')}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{stepHint}</Text>

        {bounds ? (
          <Text style={[styles.meta, { color: colors.text }]}>
            {t('downloads.customEstimate', { size: estimate ?? '—' })}
          </Text>
        ) : null}

        {validation && !validation.ok ? (
          <Text style={[styles.warn, { color: colors.danger }]} accessibilityLiveRegion="polite">
            {t(`downloads.customInvalid.${validation.code}` as 'downloads.customInvalid.too_small')}
          </Text>
        ) : null}

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('downloads.customMaxZoom')}</Text>
        <View style={styles.chipRow}>
          {[12, 13, 14].map((z) => (
            <FilterChip
              key={z}
              label={`z${z}`}
              selected={maxZoom === z}
              onPress={() => setZoomRange(minZoom, z)}
              testID={`downloads.custom.zoom.${z}`}
            />
          ))}
        </View>

        <View style={[styles.actions, { minHeight: minTouch }]}>
          <Button label={t('downloads.customResetCorners')} variant="secondary" onPress={resetCorners} disabled={!cornerA} testID="downloads.custom.reset" />
          {bounds ? (
            <Button
              label={t('downloads.customConfirmDownload')}
              onPress={() => void handleDownload()}
              loading={busy}
              disabled={busy || validation?.ok !== true}
              testID="downloads.custom.confirm"
            />
          ) : null}
          <Button label={t('common.dismiss')} variant="secondary" onPress={cancelSelecting} testID="downloads.custom.cancel" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, bottom: 0, zIndex: 40 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 14, fontWeight: '600' },
  warn: { fontSize: 14, lineHeight: 20 },
  groupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { gap: 8, marginTop: 4 },
});
