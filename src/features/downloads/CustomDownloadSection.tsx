import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ensureDownloadAllowed } from '../../lib/network/downloadPolicy';
import { validateDownloadBounds } from '../../lib/map/bounds';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { isFixStale, useLocationStore } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/SectionHeader';

const CUSTOM_DELTA = 0.12;

type Props = {
  downloadLocked?: boolean;
  actionBusyId?: string | null;
  onActionBusyChange?: (id: string | null) => void;
};

export function CustomDownloadSection({ downloadLocked = false, actionBusyId, onActionBusyChange }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const fix = useLocationStore((s) => s.fix);
  const lastGoodFix = useLocationStore((s) => s.lastGoodFix);
  const posFix = fix && !isFixStale(fix) ? fix : lastGoodFix && !isFixStale(lastGoodFix) ? lastGoodFix : null;
  const startSelecting = useCustomDownloadStore((s) => s.startSelecting);
  const startCustomDownload = useOfflinePackStore((s) => s.startCustomDownload);
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

  function openMapPicker() {
    startSelecting();
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
    setBusy(true);
    onActionBusyChange?.('custom_quick');
    try {
      await startCustomDownload(name, quickBounds, 10, 14);
      showInfo(t('downloads.customStartedBody'));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('downloads.downloadFailed'));
    } finally {
      setBusy(false);
      const stillDownloading = useOfflinePackStore.getState().activeDownloadRegionId != null;
      if (!stillDownloading) onActionBusyChange?.(null);
    }
  }

  return (
    <View style={{ marginTop: spacing.lg }}>
      <SectionHeader title={t('downloads.customTitle')} description={t('downloads.customBody')} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.md }]}>
        <Text style={[styles.lead, { color: colors.text }]}>{t('downloads.customMapLead')}</Text>
        <Button label={t('downloads.customSelectOnMap')} onPress={openMapPicker} testID="downloads.custom.selectMap" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('downloads.customQuickTitle')}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {quickBounds
            ? t('downloads.customEstimate', { size: quickEstimate ?? '—' })
            : t('downloads.customAwaitingGps')}
        </Text>
        <Button
          label={t('downloads.customQuickDownload')}
          variant="secondary"
          onPress={() => void handleQuickDownload()}
          loading={busy}
          disabled={busy || downloadLocked || actionBusyId != null || !quickBounds || !quickValid}
          testID="downloads.custom.quick"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 48 },
  lead: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  meta: { fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
