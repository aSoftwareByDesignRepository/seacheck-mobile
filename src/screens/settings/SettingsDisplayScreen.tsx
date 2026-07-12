import { View } from 'react-native';

import { useEffectiveLayoutPreset, useLayoutContext } from '../../hooks/useEffectiveLayoutPreset';
import { settingsStyles } from '../../features/settings/settingsStyles';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { type ThemeMode, useTheme } from '../../theme/ThemeContext';
import { CoordFormatPicker } from '../../ui/CoordFormatPicker';
import { FilterChip } from '../../ui/FilterChip';
import { LayoutPresetPicker } from '../../ui/LayoutPresetPicker';
import { PanelSidePicker } from '../../ui/PanelSidePicker';
import { Card, Screen, SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'redNight', 'highContrast'];

export function SettingsDisplayScreen() {
  const { colors, mode, setMode, minTouch } = useTheme();
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const gloveMode = useSettingsStore((s) => s.gloveMode);
  const panelSide = useSettingsStore((s) => s.panelSide);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const setLayoutOverride = useSettingsStore((s) => s.setLayoutOverride);
  const layoutPreset = useEffectiveLayoutPreset();
  const layoutContext = useLayoutContext();

  return (
    <Screen testID="screen.settings.display">
      <Card>
        <SettingsGroup title={t('settings.themeLabel')} first>
          <View style={settingsStyles.chipRow}>
            {THEME_MODES.map((m) => (
              <FilterChip
                key={m}
                label={t(`settings.themes.${m}` as 'settings.themes.system')}
                selected={mode === m}
                onPress={() => setMode(m)}
                testID={`settings.theme.${m}`}
              />
            ))}
          </View>
        </SettingsGroup>

        <SettingsGroup title={t('settings.layoutTitle')} hint={t('settings.layoutSummary')}>
          <LayoutPresetPicker value={layoutPreset} onChange={(preset) => void setLayoutOverride(preset, layoutContext)} />
        </SettingsGroup>

        <SettingsGroup title={t('settings.panelSide')} hint={t('settings.panelSideHint')}>
          <PanelSidePicker value={panelSide} onChange={(side) => void patchSettings({ panelSide: side })} />
        </SettingsGroup>

        <SettingsGroup title={t('settings.coordFormat')} hint={t('settings.coordFormatHint')}>
          <CoordFormatPicker value={coordFormat} onChange={(f) => void patchSettings({ coordFormat: f })} />
        </SettingsGroup>

        <ToggleRow
          label={t('settings.gloveMode')}
          hint={t('settings.gloveModeHint')}
          value={gloveMode}
          onChange={(v) => void patchSettings({ gloveMode: v })}
          testID="settings.gloveMode"
          colors={colors}
          minTouch={minTouch}
        />
      </Card>
    </Screen>
  );
}
