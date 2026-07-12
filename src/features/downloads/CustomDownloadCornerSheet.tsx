import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCoordinates } from '../../map/coords';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { type DownloadCorner } from '../../lib/map/customDownloadCorners';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { BottomSheet } from '../../ui/BottomSheet';

type Props = {
  visible: boolean;
  corner: DownloadCorner | null;
  onClose: () => void;
  onMoveOnMap: (cornerId: string) => void;
  onDelete: (cornerId: string) => void;
};

export function CustomDownloadCornerSheet({ visible, corner, onClose, onMoveOnMap, onDelete }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const coordFormat = useSettingsStore((s) => s.coordFormat);

  if (!corner) return null;

  const coordLabel = formatCoordinates(coordFormat, corner.latitude, corner.longitude);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('downloads.customCornerSheetTitle', { index: corner.index })}
      subtitle={t('downloads.customCornerSheetBody')}
      testID="downloads.custom.cornerSheet"
    >
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, spacing.sm), gap: spacing.sm }]}>
        <Text style={[styles.coords, { color: colors.text }]} accessibilityRole="text">
          {coordLabel}
        </Text>
        <View style={styles.actions}>
          <Button
            label={t('downloads.customCornerMove')}
            onPress={() => onMoveOnMap(corner.id)}
            testID="downloads.custom.cornerMove"
            style={{ minHeight: minTouch }}
          />
          <Button
            label={t('downloads.customCornerDelete')}
            variant="danger"
            onPress={() => onDelete(corner.id)}
            testID="downloads.custom.cornerDelete"
            style={{ minHeight: minTouch }}
          />
          <Button
            label={t('common.close')}
            variant="secondary"
            onPress={onClose}
            testID="downloads.custom.cornerClose"
            style={{ minHeight: minTouch }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 4 },
  coords: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  actions: { gap: 8, marginTop: 4 },
});
