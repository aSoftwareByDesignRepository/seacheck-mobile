import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  onOpenDownloads?: () => void;
};

export function MapOfflineBanner({ onOpenDownloads }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const netInfo = useNetInfo();
  const hydrated = useOfflinePackStore((s) => s.hydrated);
  const hasReady = useOfflinePackStore((s) => s.hasReadyPack());

  const offline = netInfo.isConnected === false || netInfo.isInternetReachable === false;
  if (!hydrated || !offline || hasReady) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.warningBg,
          borderColor: colors.warningBorder,
          marginHorizontal: spacing.md,
          minHeight: minTouch,
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: colors.warningText }]}>{t('map.offlineNoTiles')}</Text>
      {onOpenDownloads ? (
        <Button
          label={t('map.openDownloads')}
          variant="secondary"
          onPress={onOpenDownloads}
          testID="map.offline.downloads"
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
});
