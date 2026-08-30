import { StyleSheet, Text } from 'react-native';

import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

type Props = {
  first?: boolean;
};

/**
 * Chart data — what offline packs include, plus the optional online-only depth overlay.
 */
export function ChartDataSettingsGroup({ first }: Props) {
  const { colors, minTouch, spacing } = useTheme();
  const mapShowDepthOverlay = useSettingsStore((s) => s.mapShowDepthOverlay);
  const patchSettings = useSettingsStore((s) => s.patchSettings);

  return (
    <SettingsGroup title={t('settings.chartDataTitle')} hint={t('settings.chartDataSummary')} first={first}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartDataLayersBody')}</Text>

      <Text
        style={[styles.sectionLabel, { color: colors.text, marginTop: spacing.md }]}
        accessibilityRole="header"
      >
        {t('settings.depthOverlaySection')}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        {t('settings.depthOverlayIntro')}
      </Text>

      <ToggleRow
        label={t('settings.mapShowDepthOverlay')}
        hint={t('settings.mapShowDepthOverlayHint')}
        value={mapShowDepthOverlay}
        onChange={(v) => void patchSettings({ mapShowDepthOverlay: v })}
        testID="settings.mapShowDepthOverlay"
        colors={colors}
        minTouch={minTouch}
      />

      <Text
        style={[
          styles.warning,
          {
            color: colors.warningText,
            backgroundColor: colors.warningBg,
            borderColor: colors.warningBorder,
            marginTop: spacing.sm,
          },
        ]}
        accessibilityRole="text"
        testID="settings.depthOverlayWarning"
      >
        {t('settings.depthOverlayWarning')}
      </Text>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
  warning: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
