import { StyleSheet, Text, View } from 'react-native';

import type { SeamarkHit } from '../../lib/seamarks/querySeamark';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/tokens';
import { BottomSheet, SheetDismissFooter } from '../../ui/BottomSheet';
import { CoordinateBlock } from '../../ui/CoordinateBlock';

type Props = {
  hit: SeamarkHit | null;
  onClose: () => void;
  onCopied?: () => void;
};

export function SeamarkDetailSheet({ hit, onClose, onCopied }: Props) {
  const { colors, spacing } = useTheme();

  if (!hit) return null;

  const isUnknown = hit.source === 'unknown';
  const isOfflineCached = hit.source === 'local';
  const title = isUnknown ? t('map.seamarkUnknownTitle') : hit.name || t('map.seamarkUnknownTitle');
  const subtitle = isUnknown ? t('map.seamarkUnknownBody') : hit.type;

  return (
    <BottomSheet visible onClose={onClose} title={title} subtitle={subtitle} testID="seamark.sheet">
      {!isUnknown && hit.distanceM > 0 ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {isOfflineCached ? t('map.seamarkOfflineCached') : t('map.seamarkDistance', { m: Math.round(hit.distanceM) })}
        </Text>
      ) : null}
      <CoordinateBlock latitude={hit.latitude} longitude={hit.longitude} onCopied={onCopied} />
      <View style={{ marginTop: spacing.lg }}>
        <SheetDismissFooter onClose={onClose} testID="seamark.dismiss" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.caption, marginTop: 4, marginBottom: 4 },
});
