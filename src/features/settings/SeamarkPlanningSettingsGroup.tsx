import { StyleSheet, Text, View } from 'react-native';

import {
  patchSeamarkPlanningCategory,
  SEAMARK_PLANNING_ZOOM_OPTIONS,
  type SeamarkPlanningConfig,
} from '../../lib/settings/seamarkSettings';
import { SEAMARK_PLANNING_CATEGORY_ORDER, type SeamarkPlanningCategory } from '../../lib/seamarks/seamarkCategories';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';
import { SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

type Props = {
  config: SeamarkPlanningConfig;
  onChange: (next: SeamarkPlanningConfig) => void;
};

const CATEGORY_KEYS: Record<SeamarkPlanningCategory, string> = {
  harbour: 'settings.seamarkPlanningHarbour',
  anchorage: 'settings.seamarkPlanningAnchorage',
  navigation: 'settings.seamarkPlanningNavigation',
  hazard: 'settings.seamarkPlanningHazard',
};

export function SeamarkPlanningSettingsGroup({ config, onChange }: Props) {
  const { colors, minTouch } = useTheme();

  return (
    <SettingsGroup title={t('settings.seamarkPlanningTitle')} hint={t('settings.seamarkPlanningHint')}>
      <ToggleRow
        label={t('settings.seamarkPlanningEnabled')}
        hint={t('settings.seamarkPlanningEnabledHint')}
        value={config.enabled}
        onChange={(enabled) => onChange({ ...config, enabled })}
        testID="settings.seamarkPlanning.enabled"
        colors={colors}
        minTouch={minTouch}
      />
      {config.enabled ? (
        <>
          {SEAMARK_PLANNING_CATEGORY_ORDER.map((category) => {
            const cat = config[category];
            return (
              <View key={category} style={[styles.categoryBlock, { borderColor: colors.border }]}>
                <ToggleRow
                  label={t(CATEGORY_KEYS[category] as 'settings.seamarkPlanningHarbour')}
                  value={cat.enabled}
                  onChange={(enabled) => onChange(patchSeamarkPlanningCategory(config, category, { enabled }))}
                  testID={`settings.seamarkPlanning.${category}.enabled`}
                  colors={colors}
                  minTouch={minTouch}
                />
                {cat.enabled ? (
                  <View style={styles.zoomRow}>
                    <Text style={[styles.zoomLabel, { color: colors.textMuted }]}>{t('settings.seamarkPlanningFromZoom')}</Text>
                    <View style={styles.chipRow}>
                      {SEAMARK_PLANNING_ZOOM_OPTIONS.map((zoom) => (
                        <FilterChip
                          key={zoom}
                          label={String(zoom)}
                          selected={cat.fromZoom === zoom}
                          onPress={() => onChange(patchSeamarkPlanningCategory(config, category, { fromZoom: zoom }))}
                          testID={`settings.seamarkPlanning.${category}.zoom.${zoom}`}
                        />
                      ))}
                    </View>
                    <Text style={[styles.zoomHint, { color: colors.textMuted }]}>
                      {t('settings.seamarkPlanningFromZoomHint')}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  categoryBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4, gap: 4 },
  zoomRow: { gap: 6, marginBottom: 8 },
  zoomLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoomHint: { fontSize: 12, lineHeight: 16 },
});
