import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { stopPassageMapPlanning, isPassageMapPlanningActive } from '../../lib/passage/passageMapPlanning';
import { ensureDownloadAllowed } from '../../lib/network/downloadPolicy';
import { runLockedChartDownloadPreflight } from '../../lib/offline/downloadPreflight';
import { reportDownloadFailureFromError } from '../../lib/offline/reportDownloadFailure';
import { reportDownloadOutcome } from '../../lib/offline/reportDownloadOutcome';
import { validateDownloadBounds, boundsCenter } from '../../lib/map/bounds';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { ButtonStack } from '../../ui/Screen';
import { downloadsStyles } from './downloadsStyles';

const CUSTOM_DELTA = 0.12;

type PassagePrefill = {
  bounds: [number, number, number, number];
  defaultName: string;
  passageLabel: string;
};

type Props = {
  downloadLocked?: boolean;
  actionBusyId?: string | null;
  onActionBusyChange?: (id: string | null) => void;
  passagePrefill?: PassagePrefill | null;
};

export function CustomDownloadSection({
  downloadLocked = false,
  actionBusyId,
  onActionBusyChange,
  passagePrefill = null,
}: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const posFix = fix && !isFixStale(fix) ? fix : lastGoodFix && !isFixStale(lastGoodFix) ? lastGoodFix : null;
  const startSelecting = useCustomDownloadStore((s) => s.startSelecting);
  const startCustomDownload = useOfflinePackStore((s) => s.startCustomDownload);
  const ensureChartStyle = useOfflinePackStore((s) => s.ensureChartStyle);
  const showError = useFeedbackStore((s) => s.showError);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [busy, setBusy] = useState(false);

  const quickBounds = useMemo(() => {
    if (!posFix) return null;
    return [
      posFix.longitude - CUSTOM_DELTA,
      posFix.latitude - CUSTOM_DELTA,
      posFix.longitude + CUSTOM_DELTA,
      posFix.latitude + CUSTOM_DELTA,
    ] as [number, number, number, number];
  }, [posFix]);

  const quickEstimate = quickBounds ? formatStorageSize(estimateDownloadKb(estimateTileCount(quickBounds, 10, 14))) : null;
  const quickValid = quickBounds ? validateDownloadBounds(quickBounds, 10, 14).ok : false;

  function openMapPicker(prefill?: PassagePrefill) {
    if (isPassageMapPlanningActive()) {
      showInfo(t('passage.mapPlanningPaused'));
    }
    stopPassageMapPlanning();
    if (prefill) {
      useCustomDownloadStore.getState().prefillFromBounds(prefill.bounds, prefill.defaultName);
    } else {
      startSelecting();
    }
    navigation.navigate('Map');
  }

  async function handleQuickDownload() {
    if (!quickBounds || !posFix || !quickValid) {
      showError(t('downloads.customNoGpsBody'));
      return;
    }
    if (useOfflinePackStore.getState().activeDownloadRegionId) {
      showError(t('downloads.errorDownloadBusy'));
      return;
    }
    const allowed = await ensureDownloadAllowed();
    if (!allowed) {
      showInfo(t('downloads.cellularCancelledBody'));
      return;
    }
    const name = t('downloads.customDefaultName', {
      lat: posFix.latitude.toFixed(2),
      lon: posFix.longitude.toFixed(2),
    });
    const regionId = `custom_${Date.now().toString(36)}`;
    setBusy(true);
    onActionBusyChange?.('custom_quick');
    try {
      await runLockedChartDownloadPreflight(regionId, ensureChartStyle, boundsCenter(quickBounds));
      await startCustomDownload(name, quickBounds, 10, 14, regionId);
      reportDownloadOutcome(regionId, { showInfo, showError });
    } catch (err) {
      useOfflinePackStore.getState().releasePreflightDownloadLock(regionId);
      reportDownloadFailureFromError(regionId, err, 'preflight');
    } finally {
      setBusy(false);
      const stillDownloading = useOfflinePackStore.getState().activeDownloadRegionId != null;
      if (!stillDownloading) onActionBusyChange?.(null);
    }
  }

  return (
    <View testID="downloads.customSection" style={{ gap: spacing.md }}>
      {passagePrefill ? (
        <View
          testID="downloads.passageCustomBanner"
          style={[styles.passageCallout, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}
          accessibilityRole="summary"
        >
          <Text style={[downloadsStyles.optionTitle, { color: colors.warningText }]} accessibilityRole="header">
            {t('downloads.passageCustomTitle')}
          </Text>
          <Text style={[downloadsStyles.optionBody, { color: colors.text }]}>
            {t('downloads.passageCustomBody', { name: passagePrefill.passageLabel })}
          </Text>
          <Button
            label={t('downloads.passageCustomOpenMap')}
            variant="secondary"
            onPress={() => openMapPicker(passagePrefill)}
            testID="downloads.passageCustomOpenMap"
          />
        </View>
      ) : null}

      <View style={[styles.option, { borderTopColor: passagePrefill ? colors.border : 'transparent', borderTopWidth: passagePrefill ? StyleSheet.hairlineWidth : 0, paddingTop: passagePrefill ? spacing.md : 0 }]}>
        <Text style={[downloadsStyles.optionTitle, { color: colors.text }]}>{t('downloads.customMapOptionTitle')}</Text>
        <Text style={[downloadsStyles.optionBody, { color: colors.textMuted }]}>{t('downloads.customMapLead')}</Text>
        <Button label={t('downloads.customSelectOnMap')} onPress={() => openMapPicker()} testID="downloads.custom.selectMap" />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no" />

      <View style={styles.option}>
        <Text style={[downloadsStyles.optionTitle, { color: colors.text }]}>{t('downloads.customQuickTitle')}</Text>
        <Text style={[downloadsStyles.optionBody, { color: colors.textMuted }]}>
          {quickBounds
            ? t('downloads.customEstimate', { size: quickEstimate ?? '—' })
            : t('downloads.customAwaitingGps')}
        </Text>
        <ButtonStack>
          <Button
            label={t('downloads.customQuickDownload')}
            variant="secondary"
            onPress={() => void handleQuickDownload()}
            loading={busy}
            disabled={busy || downloadLocked || actionBusyId != null || !quickBounds || !quickValid}
            testID="downloads.custom.quick"
          />
        </ButtonStack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  passageCallout: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  option: { gap: 8 },
  divider: { height: StyleSheet.hairlineWidth },
});
