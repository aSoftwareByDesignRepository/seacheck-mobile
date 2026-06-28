import { StyleSheet, Text, View } from 'react-native';

import { ANCHOR_RADIUS_NM_OPTIONS, type AnchorRadiusNm } from '../../lib/settings/mapSettings';
import { distanceUnitLabel, formatDistanceNm } from '../../lib/geo/units';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';
import { SettingsGroup } from '../../ui/Screen';

type Props = {
  first?: boolean;
};

export function AnchorWatchSettingsGroup({ first }: Props) {
  const { colors, minTouch } = useTheme();
  const anchorRadiusNm = useSettingsStore((s) => s.anchorRadiusNm);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const patchAnchorRadiusNm = useNavigationStore((s) => s.patchAnchorRadiusNm);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const unitLabel = distanceUnitLabel(distanceUnit);

  async function setAnchorRadius(nm: AnchorRadiusNm) {
    if (anchorRadiusNm === nm && !anchorAlarm?.active) return;
    await patchSettings({ anchorRadiusNm: nm });
    if (anchorAlarm?.active) {
      await patchAnchorRadiusNm(nm);
      showInfo(
        t('map.anchorRadiusUpdated', {
          value: formatDistanceNm(nm, distanceUnit, 2),
          unit: unitLabel,
        }),
      );
    }
  }

  const activeNm = anchorAlarm?.active ? anchorAlarm.radiusNm : anchorRadiusNm;

  return (
    <SettingsGroup title={t('settings.anchorWatchTitle')} hint={t('settings.anchorWatchHint')} first={first}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('map.anchorRadiusHint')}</Text>
      <View style={[styles.chipRow, { minHeight: minTouch }]}>
        {ANCHOR_RADIUS_NM_OPTIONS.map((nm) => (
          <FilterChip
            key={nm}
            label={t('map.anchorRadiusOption', {
              value: formatDistanceNm(nm, distanceUnit, 2),
              unit: unitLabel,
            })}
            selected={Math.abs(activeNm - nm) < 0.001}
            onPress={() => void setAnchorRadius(nm)}
            testID={`settings.anchorRadius.${nm}`}
          />
        ))}
      </View>
      {anchorAlarm?.active ? (
        <Text style={[styles.active, { color: colors.success }]} accessibilityRole="text">
          {t('map.anchorRadiusActive', {
            value: formatDistanceNm(anchorAlarm.radiusNm, distanceUnit, 2),
            unit: unitLabel,
          })}
        </Text>
      ) : null}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  active: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
