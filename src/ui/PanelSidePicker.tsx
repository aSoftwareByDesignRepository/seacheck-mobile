import { View } from 'react-native';

import { settingsStyles } from '../features/settings/settingsStyles';
import { t } from '../i18n';
import type { PanelSide } from '../settings/defaults';
import { useTheme } from '../theme/ThemeContext';
import { FilterChip } from './FilterChip';

const PANEL_SIDES: PanelSide[] = ['auto', 'port', 'starboard'];

type Props = {
  value: PanelSide;
  onChange: (side: PanelSide) => void;
  testIDPrefix?: string;
};

/** Port / starboard / auto — instrument panel edge in landscape split map layout. */
export function PanelSidePicker({ value, onChange, testIDPrefix = 'settings.panelSide' }: Props) {
  const { minTouch } = useTheme();

  return (
    <View
      style={[settingsStyles.chipRow, { minHeight: minTouch }]} accessibilityRole="radiogroup" accessibilityLabel={t('settings.panelSide')}>
      {PANEL_SIDES.map((side) => (
        <FilterChip
          key={side}
          label={t(`settings.panelSide${side === 'auto' ? 'Auto' : side === 'port' ? 'Port' : 'Starboard'}` as 'settings.panelSideAuto')}
          selected={value === side}
          onPress={() => onChange(side)}
          testID={`${testIDPrefix}.${side}`}
        />
      ))}
    </View>
  );
}
