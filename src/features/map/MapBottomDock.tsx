import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFormFactor } from '../../hooks/useFormFactor';
import { formatCogDisplay } from '../../hooks/useNavigationInstruments';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatSog } from '../../lib/geo/units';
import { t } from '../../i18n';
import { isFixStale, isLowSog, type LocationFix } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { mapChromeInsets } from './mapChromeInsets';
import { MapActions } from './MapActions';

type Props = {
  fix: LocationFix | null;
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
};

/**
 * Minimal layout bottom dock — SOG/COG and safety actions in one non-overlapping row.
 * Re-centre is in the top GPS status strip.
 */
export function MapBottomDock({
  fix,
  showRangeRings,
  onToggleRangeRings,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const chrome = mapChromeInsets(insets, spacing.lg);
  const bottom = useMapBottomLayout();
  const { instrumentHeroSize } = useFormFactor();
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);

  const stale = isFixStale(fix);
  const declination = fix ? magneticDeclinationDeg(fix.latitude, fix.longitude) : 0;
  const sogText = stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const cogText = stale ? '—' : formatCogDisplay(fix, bearingReference, declination);
  const courseLabel = isLowSog(fix) && !stale ? t('map.hdg') : t('map.cog');

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          bottom: bottom.minimalStripBottom,
          left: chrome.left,
          right: chrome.right,
          minHeight: minTouch,
        },
      ]}
      testID="map.minimalDock"
    >
      <View style={styles.dockRow}>
        <View
          style={[styles.instruments, { marginRight: spacing.sm, gap: spacing.sm }]}
          accessibilityLabel={`${t('map.sog')} ${sogText}, ${courseLabel} ${cogText}`}
        >
          <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('map.sog')}</Text>
            <Text style={[styles.value, { color: colors.text, fontSize: instrumentHeroSize }]}>{sogText}</Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>{sogUnit}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{courseLabel}</Text>
            <Text style={[styles.value, { color: colors.text, fontSize: instrumentHeroSize }]}>{cogText.split(' ')[0]}</Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>{cogText.includes(' ') ? cogText.split(' ')[1] : ''}</Text>
          </View>
        </View>
        <MapActions showRangeRings={showRangeRings} onToggleRangeRings={onToggleRangeRings} inline />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', zIndex: 30 },
  dockRow: { flexDirection: 'row', alignItems: 'flex-end' },
  instruments: { flex: 1, flexDirection: 'row', minWidth: 0 },
  chip: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', minWidth: 0 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 4 },
  unit: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
