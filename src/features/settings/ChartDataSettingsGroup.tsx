import { StyleSheet, Text, View } from 'react-native';

import type { ChartBaseStyle } from '../../lib/settings/chartBaseStyle';
import { CHART_BASE_STYLE_OPTIONS } from '../../lib/settings/chartBaseStyle';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';
import { SettingsGroup } from '../../ui/Screen';

type Props = {
  baseStyle: ChartBaseStyle;
  onBaseStyleChange: (style: ChartBaseStyle) => void;
  first?: boolean;
};

/**
 * Honest chart-data settings — only options SeaCheck fully controls.
 * Depth contours and satellite imagery are explained but not offered as fake toggles.
 */
export function ChartDataSettingsGroup({ baseStyle, onBaseStyleChange, first }: Props) {
  const { colors, spacing } = useTheme();

  return (
    <SettingsGroup title={t('settings.chartDataTitle')} hint={t('settings.chartDataSummary')} first={first}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartDataLayersBody')}</Text>

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.subLabel, { color: colors.textMuted }]}>{t('settings.chartBaseStyleLabel')}</Text>
        <View style={styles.chipRow}>
          {CHART_BASE_STYLE_OPTIONS.map((style) => (
            <FilterChip
              key={style}
              label={t(`settings.chartBaseStyles.${style}` as 'settings.chartBaseStyles.voyager')}
              selected={baseStyle === style}
              onPress={() => onBaseStyleChange(style)}
              testID={`settings.chartBase.${style}`}
            />
          ))}
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t(`settings.chartBaseDescriptions.${baseStyle}` as 'settings.chartBaseDescriptions.voyager')}
        </Text>
        <Text style={[styles.hint, { color: colors.warningText }]} accessibilityRole="text">
          {t('settings.chartBaseRedownloadHint')}
        </Text>
      </View>

      <View style={[styles.noteBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>{t('settings.chartSeamarkRasterTitle')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartSeamarkRasterBody')}</Text>
      </View>

      <View style={[styles.noteBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>{t('settings.chartDepthTitle')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartDepthBody')}</Text>
      </View>

      <View style={[styles.noteBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>{t('settings.chartSatelliteTitle')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartSatelliteBody')}</Text>
      </View>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
  hint: { fontSize: 13, lineHeight: 19 },
  subLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noteBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  noteTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
});
