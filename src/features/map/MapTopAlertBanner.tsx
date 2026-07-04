import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';

type AlertKind = 'offline' | 'coverage' | 'download';

type Props = {
  kind: AlertKind;
  onOpenDownloads: () => void;
  onDismissDownloadHint: () => void;
};

export function MapTopAlertBanner({ kind, onOpenDownloads, onDismissDownloadHint }: Props) {
  const { colors, spacing, minTouch } = useTheme();

  const copy =
    kind === 'offline'
      ? { title: t('map.offlineNoTiles'), hint: t('map.openDownloads'), onPress: onOpenDownloads, dismiss: null as (() => void) | null }
      : kind === 'coverage'
        ? { title: t('map.chartsNotHere'), hint: t('map.chartsNotHereHint'), onPress: onOpenDownloads, dismiss: null }
        : { title: t('map.downloadHint'), hint: t('map.downloadHintOpenHint'), onPress: onOpenDownloads, dismiss: onDismissDownloadHint };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: kind === 'download' ? colors.surface : colors.warningBg,
          borderColor: kind === 'download' ? colors.border : colors.warningBorder,
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
          style={[styles.title, { color: kind === 'download' ? colors.text : colors.warningText, flexShrink: 1 }]}
          numberOfLines={3}
        >
          {copy.title}
        </Text>
        {kind !== 'download' ? (
          <Text style={[styles.hint, { color: colors.warningText }]} numberOfLines={2}>
            {copy.hint}
          </Text>
        ) : null}
      </Pressable>
      {copy.dismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          accessibilityHint={t('map.downloadHintDismissHint')}
          onPress={copy.dismiss}
          hitSlop={8}
          style={[styles.closeBtn, { minHeight: minTouch, minWidth: minTouch, borderColor: colors.border }]}
          testID="map.topAlert.dismiss"
        >
          <Text style={[styles.closeText, { color: colors.text }]} accessibilityElementsHidden importantForAccessibility="no">
            ×
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.openDownloads')}
          onPress={onOpenDownloads}
          style={[styles.actionBtn, { minHeight: minTouch, borderColor: colors.border, marginLeft: spacing.xs }]}
          testID="map.topAlert.action"
        >
          <Text style={[styles.actionText, { color: colors.primary }]} numberOfLines={2}>
            {t('map.openDownloadsShort')}
          </Text>
        </Pressable>
      )}
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
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  actionText: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
});
