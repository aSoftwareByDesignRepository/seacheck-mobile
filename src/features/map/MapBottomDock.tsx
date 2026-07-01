import { StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { formatCogDisplay } from '../../hooks/useNavigationInstruments';
import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { usePassageFollow } from '../../hooks/usePassageFollow';
import { magneticDeclinationDeg } from '../../lib/geo/magnetic';
import { formatSog } from '../../lib/geo/units';
import { t } from '../../i18n';
import { isFixStale, isLowSog, type LocationFix } from '../../services/locationService';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { InstrumentChip } from '../../ui/InstrumentChip';
import { PassageInstrumentBlock } from './PassageInstrumentBlock';

type Props = {
  fix: LocationFix | null;
  onOpenPassage: () => void;
};

/**
 * Minimal layout bottom dock — SOG/COG and active passage follow visible together without scrolling.
 * Lock, anchor, and MOB stay on the map edge (MapChrome).
 */
export function MapBottomDock({ fix, onOpenPassage }: Props) {
  const { colors, spacing } = useTheme();
  const bottom = useMapBottomLayout();
  const { instrumentHeroSize } = useFormFactor();
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const follow = usePassageFollow();

  const stale = isFixStale(fix);
  const declination = fix ? magneticDeclinationDeg(fix.latitude, fix.longitude) : 0;
  const sogText = stale ? '—' : formatSog(fix?.speedMs ?? null, sogUnit);
  const cogText = stale ? '—' : formatCogDisplay(fix, bearingReference, declination);
  const courseLabel = isLowSog(fix) && !stale ? t('map.hdg') : t('map.cog');
  const cogParts = cogText.split(' ');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottom.instrumentDockBottom }]}
      testID="map.minimalDock"
    >
      <View
        style={[
          styles.shell,
          {
            height: bottom.instrumentDockHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.content,
            {
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              justifyContent: follow.following ? 'space-between' : 'center',
            },
          ]}
        >
          {follow.following ? (
            <PassageInstrumentBlock fix={fix} density="dock" followDetail="minimal" onOpenPassage={onOpenPassage} />
          ) : null}

          <View
            style={[styles.instruments, { gap: spacing.sm }]}
            accessibilityLabel={`${t('map.sog')} ${sogText}, ${courseLabel} ${cogText}`}
          >
            <InstrumentChip label={t('map.sog')} value={sogText} unit={sogUnit} hero heroSize={instrumentHeroSize} />
            <InstrumentChip
              label={courseLabel}
              value={cogParts[0] ?? '—'}
              unit={cogParts.length > 1 ? cogParts.slice(1).join(' ') : undefined}
              hero
              heroSize={instrumentHeroSize}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 30, elevation: 30 },
  shell: { borderTopWidth: StyleSheet.hairlineWidth * 2 },
  content: { flex: 1, minHeight: 0 },
  instruments: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0, flexShrink: 0 },
});
