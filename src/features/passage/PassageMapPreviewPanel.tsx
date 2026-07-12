import { StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { PassageMapPreview } from './PassageMapPreview';

type Props = {
  waypoints: WaypointRow[];
  onPlanOnMap: () => void;
  onShowOnMap: () => void;
};

/** Map preview + chart hand-off — right pane in passage editor split layout. */
export function PassageMapPreviewPanel({ waypoints, onPlanOnMap, onShowOnMap }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const tall = formFactor !== 'compact';

  return (
    <View
      style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.md }]}
      testID="passage.mapPreviewPanel"
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.mapPreviewTitle')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('passage.mapPreviewHint')}</Text>
      <PassageMapPreview waypoints={waypoints} tall={tall} />
      <View style={[styles.actions, { gap: spacing.sm, minHeight: minTouch }]}>
        {waypoints.length > 0 ? (
          <Button
            label={t('passage.showPassageOnMap')}
            onPress={onShowOnMap}
            testID="passage.preview.showOnMap"
            accessibilityHint={t('passage.showPassageOnMapHint')}
          />
        ) : null}
        <Button
          label={t('passage.planOnMap')}
          variant={waypoints.length > 0 ? 'secondary' : 'primary'}
          onPress={onPlanOnMap}
          testID="passage.preview.planOnMap"
          accessibilityHint={t('passage.planOnMapHint')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignSelf: 'stretch',
  },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 24 },
  hint: { fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 4 },
});
