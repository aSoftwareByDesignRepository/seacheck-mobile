import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { ensureDownloadAllowed } from '../../lib/network/downloadPolicy';
import { runLockedChartDownloadPreflight } from '../../lib/offline/downloadPreflight';
import { reportDownloadFailureFromError } from '../../lib/offline/reportDownloadFailure';
import { reportDownloadOutcome } from '../../lib/offline/reportDownloadOutcome';
import { CUSTOM_DOWNLOAD_CORNER_COUNT } from '../../lib/map/customDownloadCorners';
import { boundsCenter, boundsDimensionsNm, validateDownloadBounds } from '../../lib/map/bounds';
import { formatDistanceNm } from '../../lib/geo/units';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';
import { MapBottomPanelFrame } from '../map/MapBottomPanelFrame';
import { CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX } from '../map/mapChromeLayout';
import { CustomDownloadAreaPreview } from './CustomDownloadAreaPreview';

export function CustomDownloadMapPanel() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const corners = useCustomDownloadStore((s) => s.corners);
  const phase = useCustomDownloadStore((s) => s.phase);
  const relocateCornerId = useCustomDownloadStore((s) => s.relocateCornerId);
  const minZoom = useCustomDownloadStore((s) => s.minZoom);
  const maxZoom = useCustomDownloadStore((s) => s.maxZoom);
  const packName = useCustomDownloadStore((s) => s.packName);
  const getBounds = useCustomDownloadStore((s) => s.getBounds);
  const getPreviewBounds = useCustomDownloadStore((s) => s.getPreviewBounds);
  const resetCorners = useCustomDownloadStore((s) => s.resetCorners);
  const setZoomRange = useCustomDownloadStore((s) => s.setZoomRange);
  const cancelSelecting = useCustomDownloadStore((s) => s.cancelSelecting);
  const startCustomDownload = useOfflinePackStore((s) => s.startCustomDownload);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const showError = useFeedbackStore((s) => s.showError);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [busy, setBusy] = useState(false);

  const bounds = getBounds();
  const previewBounds = getPreviewBounds();
  const activeBounds = bounds ?? previewBounds;
  const isPreview = bounds == null && previewBounds != null;
  const isComplete = phase === 'complete';

  const validation = activeBounds ? validateDownloadBounds(activeBounds, minZoom, maxZoom) : null;
  const estimate =
    validation?.ok === true
      ? formatStorageSize(estimateDownloadKb(validation.tileCount))
      : activeBounds
        ? formatStorageSize(estimateDownloadKb(estimateTileCount(activeBounds, minZoom, maxZoom)))
        : null;

  const relocateCorner = relocateCornerId ? corners.find((c) => c.id === relocateCornerId) : null;

  const stepHint = useMemo(() => {
    if (relocateCorner) {
      return t('downloads.customRelocateHint', { index: relocateCorner.index });
    }
    if (isComplete) {
      return t('downloads.customStepEdit');
    }
    if (corners.length === 0) {
      return t('downloads.customStepOne');
    }
    return t('downloads.customStepCorner', {
      current: corners.length + 1,
      total: CUSTOM_DOWNLOAD_CORNER_COUNT,
    });
  }, [corners.length, isComplete, relocateCorner]);

  const areaLabel = useMemo(() => {
    if (!activeBounds) return null;
    const { widthNm, heightNm } = boundsDimensionsNm(activeBounds);
    return t('downloads.customAreaSize', {
      width: formatDistanceNm(widthNm, distanceUnit, 1),
      height: formatDistanceNm(heightNm, distanceUnit, 1),
    });
  }, [activeBounds, distanceUnit]);

  async function handleDownload() {
    if (!bounds || !validation?.ok) {
      const code = validation && !validation.ok ? validation.code : 'too_small';
      showError(t(`downloads.customInvalid.${code}` as 'downloads.customInvalid.too_small'));
      return;
    }
    const store = useOfflinePackStore.getState();
    if (store.activeDownloadRegionId != null || store.downloadMapTeardownRegionId != null) {
      showError(t('downloads.errorDownloadBusy'));
      return;
    }
    setBusy(true);
    const regionId = `custom_${Date.now().toString(36)}`;
    try {
      const allowed = await ensureDownloadAllowed();
      if (!allowed) {
        showInfo(t('downloads.cellularCancelledBody'));
        return;
      }
      const center = boundsCenter(bounds);
      const name =
        packName.trim() ||
        t('downloads.customDefaultName', { lat: center.latitude.toFixed(2), lon: center.longitude.toFixed(2) });
      await runLockedChartDownloadPreflight(regionId, ensureChartStyle, center);
      await startCustomDownload(name, bounds, minZoom, maxZoom, regionId);
      cancelSelecting();
      reportDownloadOutcome(regionId, { showInfo, showError });
      navigation.navigate('Downloads');
    } catch (err) {
      useOfflinePackStore.getState().releasePreflightDownloadLock(regionId);
      reportDownloadFailureFromError(regionId, err, 'preflight');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MapBottomPanelFrame maxContentHeight={CUSTOM_DOWNLOAD_PANEL_CONTENT_MAX} testID="downloads.custom.mapPanel">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('downloads.customMapTitle')}
      </Text>

      <View style={styles.progressRow} accessibilityRole="text">
        <Text style={[styles.progress, { color: colors.textMuted }]}>
          {t('downloads.customCornerProgress', { current: corners.length, total: CUSTOM_DOWNLOAD_CORNER_COUNT })}
        </Text>
      </View>

      <View
        style={[styles.hintBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="text"
      >
        <Text style={[styles.hint, { color: colors.text }]}>{stepHint}</Text>
      </View>

      <CustomDownloadAreaPreview />

      {activeBounds ? (
        <View style={styles.metaSection} accessibilityRole="summary">
          {areaLabel ? (
            <Text style={[styles.meta, { color: colors.text }]}>{areaLabel}</Text>
          ) : null}
          <Text style={[styles.metaMuted, { color: colors.textMuted }]}>
            {isPreview
              ? t('downloads.customEstimatePreview', { size: estimate ?? '—' })
              : t('downloads.customEstimate', { size: estimate ?? '—' })}
          </Text>
        </View>
      ) : null}

      {validation && !validation.ok && activeBounds ? (
        <View
          style={[styles.warnBox, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.warnTitle, { color: colors.danger }]}>{t('downloads.customInvalidTitle')}</Text>
          <Text style={[styles.warn, { color: colors.danger }]}>
            {t(`downloads.customInvalid.${validation.code}` as 'downloads.customInvalid.too_small')}
          </Text>
        </View>
      ) : null}

      <View style={styles.zoomSection}>
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
      </View>

      <View style={[styles.actions, { minHeight: minTouch, marginBottom: spacing.xs }]}>
        {isComplete ? (
          <Button
            label={t('downloads.customConfirmDownload')}
            onPress={() => void handleDownload()}
            loading={busy}
            disabled={busy || validation?.ok !== true || relocateCornerId != null}
            testID="downloads.custom.confirm"
          />
        ) : null}
        <View style={styles.secondaryActions}>
          <Button
            label={t('downloads.customResetCorners')}
            variant="secondary"
            onPress={resetCorners}
            disabled={corners.length === 0 || relocateCornerId != null}
            testID="downloads.custom.reset"
          />
          <Button label={t('common.dismiss')} variant="secondary" onPress={cancelSelecting} testID="downloads.custom.cancel" />
        </View>
      </View>
    </MapBottomPanelFrame>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  progressRow: { marginTop: 2 },
  progress: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  hintBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  hint: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  metaSection: { gap: 4 },
  meta: { fontSize: 15, fontWeight: '700' },
  metaMuted: { fontSize: 14, lineHeight: 20 },
  warnBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  warnTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  warn: { fontSize: 14, lineHeight: 20 },
  zoomSection: { gap: 8, marginTop: 4 },
  groupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { gap: 10, marginTop: 4 },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
