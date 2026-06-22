import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { validateDownloadBounds } from '../../lib/map/bounds';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { t } from '../../i18n';
import type { RootTabParamList } from '../../navigation/types';
import { useLocationStore } from '../../services/locationService';
import { useCustomDownloadStore } from '../../store/customDownloadStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/SectionHeader';

const CUSTOM_DELTA = 0.12;

export function CustomDownloadSection() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors, spacing, minTouch } = useTheme();
  const fix = useLocationStore((s) => s.fix);
  const startSelecting = useCustomDownloadStore((s) => s.startSelecting);
  const startCustomDownload = useOfflinePackStore((s) => s.startCustomDownload);
  const [busy, setBusy] = useState(false);

  const quickBounds = useMemo(() => {
    if (!fix) return null;
    return [
      fix.longitude - CUSTOM_DELTA,
      fix.latitude - CUSTOM_DELTA,
      fix.longitude + CUSTOM_DELTA,
      fix.latitude + CUSTOM_DELTA,
    ] as [number, number, number, number];
  }, [fix]);

  const quickEstimate = quickBounds ? formatStorageSize(estimateDownloadKb(estimateTileCount(quickBounds, 10, 14))) : null;
  const quickValid = quickBounds ? validateDownloadBounds(quickBounds, 10, 14).ok : false;

  function openMapPicker() {
    startSelecting();
    navigation.navigate('Map');
  }

  async function handleQuickDownload() {
    if (!quickBounds || !fix || !quickValid) {
      Alert.alert(t('downloads.customNoGpsTitle'), t('downloads.customNoGpsBody'));
      return;
    }
    const name = t('downloads.customDefaultName', {
      lat: fix.latitude.toFixed(2),
      lon: fix.longitude.toFixed(2),
    });
    setBusy(true);
    try {
      await startCustomDownload(name, quickBounds, 10, 14);
    } finally {
      setBusy(false);
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
          disabled={busy || !quickBounds || !quickValid}
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
