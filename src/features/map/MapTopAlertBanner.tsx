import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { ChartMapAlertKind } from '../../lib/map/chartRasterVisibility';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  kind: ChartMapAlertKind;
  onOpenDownloads: () => void;
  onDismiss: () => void;
};

export function MapTopAlertBanner({ kind, onOpenDownloads, onDismiss }: Props) {
  const { colors, minTouch } = useTheme();

  const copy =
    kind === 'cacheOnly'
      ? {
          title: t('map.offlineCacheOnly'),
          hint: t('map.offlineCacheOnlyHint'),
          onPress: onOpenDownloads,
          dismissHint: t('map.offlineChartAlertDismissHint'),
          tone: 'warning' as const,
        }
      : kind === 'coverage'
        ? {
            title: t('map.chartsNotHere'),
            hint: t('map.chartsNotHereHint'),
            onPress: onOpenDownloads,
            dismissHint: t('map.offlineChartAlertDismissHint'),
            tone: 'warning' as const,
          }
        : {
            title: t('map.downloadHint'),
            hint: t('map.downloadHintOpenHint'),
            onPress: onOpenDownloads,
            dismissHint: t('map.downloadHintDismissHint'),
            tone: 'info' as const,
          };

  const isInfo = copy.tone === 'info';

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isInfo ? colors.surface : colors.warningBg,
          borderColor: isInfo ? colors.border : colors.warningBorder,
        },
      ]}
      testID={`map.topAlert.${kind}`}
      accessibilityRole="alert"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.title}
        accessibilityHint={copy.hint}
        onPress={copy.onPress}
        style={styles.message}
      >
        <Text
          style={[styles.title, { color: isInfo ? colors.text : colors.warningText, flexShrink: 1 }]}
          numberOfLines={3}
        >
          {copy.title}
        </Text>
        <Text
          style={[styles.hint, { color: isInfo ? colors.textMuted : colors.warningText }]}
          numberOfLines={2}
        >
          {copy.hint}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        accessibilityHint={copy.dismissHint}
        onPress={onDismiss}
        hitSlop={8}
        style={[styles.closeBtn, { minHeight: minTouch, minWidth: minTouch, borderColor: colors.border }]}
        testID="map.topAlert.dismiss"
      >
        <Text style={[styles.closeText, { color: colors.text }]} accessibilityElementsHidden importantForAccessibility="no">
          ×
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  message: { flex: 1, flexShrink: 1, justifyContent: 'center', minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  closeBtn: {
    borderLeftWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  closeText: { fontSize: 22, fontWeight: '300', lineHeight: 24 },
});
